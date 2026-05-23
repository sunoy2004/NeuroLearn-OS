import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { WS_BASE } from "@/services/api";
import { createVoiceCommand } from "@/services/voiceIntentClassifier";
import { voiceSessionManager } from "@/services/voiceSessionManager";
import type { VoiceCommand, VoiceTranscript, VoiceIntent } from "@/types";

// Standard browser speech recognition typings
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function GlobalVoiceController() {
  const {
    voiceListening,
    setVoiceListening,
    setVoiceProcessing,
    setVoiceTranscript,
    setVoiceError,
    setLastVoiceCommand,
    setPage,
  } = useAppStore();

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if voice listening was activated from anywhere
    if (voiceListening) {
      startListeningSession();
    } else {
      stopListeningSession();
    }

    return () => {
      // Cleanup on unmount
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, [voiceListening]);

  const startListeningSession = () => {
    setVoiceError(null);
    setVoiceTranscript("");

    try {
      // 1. Initialize web socket connection
      const wsUrl = `${WS_BASE.replace("http", "ws")}/api/voice/ws/voice-stream`;
      console.log("Global voice socket connecting to:", wsUrl);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("Global voice socket connected.");
        ws.send("clear");

        // 2. Request mic permission and stream audio
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                ws.send(event.data); // stream raw binary chunk to FastAPI
              }
            };

            mediaRecorder.start(300); // 300ms chunks
          })
          .catch((err) => {
            console.error("Microphone permission denied:", err);
            setVoiceError("Microphone access denied.");
            setVoiceListening(false);
          });
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.event === "result") {
          setVoiceProcessing(false);
          setVoiceTranscript(data.transcript);

          // Play response TTS audio
          if (data.audioUrl) {
            try {
              const audio = new Audio(data.audioUrl);
              await audio.play();
            } catch (playErr) {
              console.warn("Autoplay blocked by browser:", playErr);
            }
          }

          // Build voice command object
          const command: VoiceCommand = {
            id: `cmd-${Date.now()}`,
            transcript: data.transcript,
            intent: data.intent as VoiceIntent,
            confidence: 0.95,
            entities: {},
            timestamp: Date.now(),
          };

          // Save to local session log
          voiceSessionManager.recordCommand(command);
          setLastVoiceCommand(command);

          // Route navigation based on the intent
          routeVoiceAction(data.intent, data.transcript);
        }
      };

      ws.onerror = (err) => {
        console.error("Voice WebSocket error:", err);
        setVoiceError("Speech connection error.");
        setVoiceListening(false);
      };

      // 3. Start client-side Web Speech Recognition for instant UI transcription updates
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onresult = (e: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
              finalTranscript += e.results[i][0].transcript;
            } else {
              interimTranscript += e.results[i][0].transcript;
            }
          }

          const currentText = finalTranscript || interimTranscript;
          if (currentText) {
            setVoiceTranscript(currentText);
          }
        };

        rec.onerror = (e: any) => {
          console.warn("Browser SpeechRecognition warning:", e.error);
        };

        recognitionRef.current = rec;
        rec.start();
      }
    } catch (err) {
      console.error("Global voice controller init failed:", err);
      setVoiceError("Failed to start voice capture.");
      setVoiceListening(false);
    }
  };

  const stopListeningSession = () => {
    // Stop mic stream
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Stop browser recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    // Trigger process trigger
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      setVoiceProcessing(true);
      socketRef.current.send("process_recording");
    }
  };

  const routeVoiceAction = (intent: string, transcript: string) => {
    console.log(`Global router executing voice action for intent: ${intent}`);
    
    switch (intent) {
      case "QUIZ_REQUEST":
      case "REVISION_START":
      case "WEAK_AREAS_QUERY":
        setPage("revision");
        break;
      case "TUTORING_REQUEST":
      case "EXPLANATION_REQUEST":
        setPage("tutor");
        break;
      case "LECTURE_START":
      case "LECTURE_STOP":
        setPage("lecture-studio");
        break;
      case "ANALYTICS_QUERY":
      case "PROGRESS_QUERY":
        setPage("analytics");
        break;
      default:
        // No page transition required, just play response in place
        break;
    }
  };

  return null; // This is a logic-only daemon component
}
