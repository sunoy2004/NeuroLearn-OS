import { useState, useCallback, useRef, useEffect } from "react";
import { createVoiceCommand } from "@/services/voiceIntentClassifier";
import { voiceSessionManager } from "@/services/voiceSessionManager";
import type { VoiceCommand, VoiceTranscript } from "@/types";

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

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export function useVoiceCapture(): UseVoiceCaptureResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulatedMode, setSimulatedMode] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRecognition;
        webkitSpeechRecognition?: new () => SpeechRecognition;
      }
    ).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      setSimulatedMode(false);

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          handleFinalTranscript(finalTranscript);
        }

        setTranscript(interimTranscript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening && recognitionRef.current) {
          recognitionRef.current.start();
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  const handleFinalTranscript = useCallback((text: string) => {
    const trimmedTranscript = text.trim();
    if (trimmedTranscript) {
      processText(trimmedTranscript);
    }
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");

    if (recognitionRef.current && !simulatedMode) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setError("Failed to start voice recognition");
        console.error(err);
      }
    } else {
      setIsListening(true);
    }
  }, [simulatedMode]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && !simulatedMode) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setTranscript("");
  }, [simulatedMode]);

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
