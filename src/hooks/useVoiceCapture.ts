import { useState, useCallback, useRef } from "react";
import { createVoiceCommand } from "@/services/voiceIntentClassifier";
import { voiceSessionManager } from "@/services/voiceSessionManager";
import type { VoiceCommand, VoiceTranscript } from "@/types";
import { WS_BASE } from "../services/api";

interface UseVoiceCaptureResult {
  isListening: boolean;
  transcript: string;
  isProcessing: boolean;
  lastCommand: VoiceCommand | null;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  processText: (text: string) => Promise<VoiceCommand>;
  simulatedMode: boolean;
}

export function useVoiceCapture(): UseVoiceCaptureResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulatedMode, setSimulatedMode] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const processText = useCallback(async (text: string): Promise<VoiceCommand> => {
    setIsProcessing(true);
    setTranscript(text);
    try {
      const command = createVoiceCommand(text);
      voiceSessionManager.recordCommand(command);
      setLastCommand(command);

      const voiceTranscript: VoiceTranscript = {
        text,
        isFinal: true,
        confidence: command.confidence,
        timestamp: Date.now(),
      };
      voiceSessionManager.addToTranscriptBuffer(voiceTranscript);
      return command;
    } catch (err) {
      setError("Failed to process voice command");
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    setIsListening(true);

    try {
      // Connect to WebSocket voice stream pipeline on FastAPI
      const wsUrl = `${WS_BASE.replace("http", "ws")}/api/voice/ws/voice-stream`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket voice stream connected.");
        ws.send("clear");

        // Ask for microphone permissions
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            streamRef.current = stream;
            
            // Record in webm chunk segments
            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                ws.send(event.data); // Send raw binary block to FastAPI
              }
            };

            // Stream chunk every 300ms
            mediaRecorder.start(300);
          })
          .catch((err) => {
            console.error("Microphone capture blocked:", err);
            setError("Microphone permission denied.");
            stopListening();
          });
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        if (data.event === "result") {
          setIsProcessing(false);
          setTranscript(data.transcript);
          
          // Play synthesized base64 vocal reply from server
          if (data.audioUrl) {
            try {
              const audio = new Audio(data.audioUrl);
              await audio.play();
            } catch (playErr) {
              console.warn("Audio auto-playback blocked by browser:", playErr);
            }
          }

          // Trigger state changes in the UI by simulating processCommand completion
          const cmd = await processText(data.transcript);
          // Overwrite parsed intent returned from server
          cmd.intent = data.intent;
          setLastCommand({ ...cmd });
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket audio stream error:", err);
        setError("Speech connection lost.");
      };

      ws.onclose = () => {
        console.log("Voice stream WebSocket closed.");
      };

    } catch (err) {
      setError("Failed to initialize voice channel.");
      setIsListening(false);
    }
  }, [processText]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setIsProcessing(true);

    // Stop microphone stream tracks
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Trigger process trigger to compile binary recording on backend
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send("process_recording");
    } else {
      setIsProcessing(false);
    }
  }, []);

  return {
    isListening,
    transcript,
    isProcessing,
    lastCommand,
    error,
    startListening,
    stopListening,
    processText,
    simulatedMode,
  };
}
