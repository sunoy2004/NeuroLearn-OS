import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { AGENT_WS_BASE } from "@/services/api";
import { createVoiceCommand } from "@/services/voiceIntentClassifier";
import { voiceSessionManager } from "@/services/voiceSessionManager";
import type { VoiceCommand, VoiceTranscript, VoiceIntent } from "@/types";
import { getSpeechRecognitionLang } from "@/config/speechLanguages";

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
    addAgentNotification,
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
    addAgentNotification("Opening voice control stream...", "info", "Orchestrator");

    try {
      // 1. Initialize web socket connection to the separate Agent Service
      const wsUrl = `${AGENT_WS_BASE.replace("http", "ws")}/ws/agent-stream`;
      console.log("Global voice socket connecting to:", wsUrl);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("Global voice socket connected.");
        ws.send("clear");
        addAgentNotification("Connected to Agent Service. Listening...", "success", "Orchestrator");

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
            addAgentNotification("Microphone permission denied.", "warning", "Orchestrator");
          });
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.event === "result") {
          setVoiceProcessing(false);
          setVoiceTranscript(data.transcript);

          const agentName = data.agentExecuted
            ? data.agentExecuted.charAt(0).toUpperCase() + data.agentExecuted.slice(1) + "Agent"
            : "Orchestrator";
          addAgentNotification(`Heard: "${data.transcript}"`, "agent", agentName);

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

          // Execute action emitted by the autonomous AI agent
          if (data.action && data.action.action !== "none") {
            executeAgentAction(data.action);
          } else {
            routeVoiceAction(data.intent, data.transcript);
          }

          if (data.response) {
            addAgentNotification(data.response, "info", agentName);
          }
        }
      };

      ws.onerror = (err) => {
        console.error("Voice WebSocket error:", err);
        setVoiceError("Speech connection error.");
        setVoiceListening(false);
        addAgentNotification("Speech connection failed. Verify Agent Service is running on port 8001.", "warning", "Orchestrator");
      };

      // 3. Start client-side Web Speech Recognition for instant UI transcription updates
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = getSpeechRecognitionLang();

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
      addAgentNotification("Processing voice command...", "info", "Orchestrator");
    }
  };

  const executeAgentAction = (action: any) => {
    console.log("Autonomous agent executing action:", action);
    
    switch (action.action) {
      case "navigate":
        if (action.target) {
          setPage(action.target);
          addAgentNotification(`Navigated to ${action.target}`, "success", "NavigationAgent");
        }
        break;
      case "start_recording":
        setPage("lecture-studio");
        useAppStore.getState().setRecording(true);
        addAgentNotification("Started lecture recording session", "success", "LectureAgent");
        break;
      case "stop_recording":
        useAppStore.getState().setRecording(false);
        addAgentNotification("Stopped lecture recording session", "success", "LectureAgent");
        break;
      case "open_quiz":
        setPage("revision");
        if (action.payload?.topic) {
          useAppStore.getState().fetchQuizQuestions(action.payload.topic);
          addAgentNotification(`Active quiz generated for ${action.payload.topic}`, "success", "QuizAgent");
        }
        break;
      case "open_modal":
        console.log(`Autonomous agent triggered modal: ${action.target}`);
        addAgentNotification(`Opened modal interface: ${action.target}`, "success", "Orchestrator");
        break;
      case "display_summary":
        console.log("Autonomous agent generated lecture summary:", action.payload);
        addAgentNotification(`Generated lecture summary outline`, "success", "SummaryAgent");
        break;
      default:
        break;
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
