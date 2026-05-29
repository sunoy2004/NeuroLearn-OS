import { AGENT_WS_BASE } from "../api";
import { browserVoiceProvider } from "./BrowserVoiceProvider";
import { SilenceDetector } from "./silenceDetector";
import { useAppStore } from "@/store/appStore";
import { commandLifecycleManager } from "./commandLifecycleManager";
import { sessionLifecycleManager } from "./sessionLifecycleManager";
import { agentRegistry } from "@/agents/agentRegistry";
import { agentBootstrap } from "@/agents/bootstrap";
import { routeIntent } from "@/services/intentRouter";

export type ConnectionStatus = "connected" | "disconnected" | "connecting";
export type VoiceStatus = "idle" | "listening" | "thinking" | "responding" | "executing" | "stopped" | "disconnected";

export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  intent?: string;
  agentName?: string;
  isStreaming?: boolean;
}

export class PersistentVoiceSessionManager {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = "disconnected";
  private voiceStatus: VoiceStatus = "idle";
  private isManuallyStopped = false;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private reconnectTimeout: any = null;
  private heartbeatInterval: any = null;
  private reconnectDelay = 1000;
  private serverVoiceProvider = "browser";
  private activeAudio: HTMLAudioElement | null = null;
  private silenceDetector = new SilenceDetector(() => this.handleSilenceDetected(), 2500);
  
  // Callback registers
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private voiceStatusListeners: Set<(status: VoiceStatus) => void> = new Set();
  private messageListeners: Set<(msg: SessionMessage) => void> = new Set();
  private transcriptListeners: Set<(text: string) => void> = new Set();
  private streamListeners: Set<(text: string) => void> = new Set();

  private transcriptBuffer = "";
  private currentResponseStream = "";
  private audioChunks: Blob[] = [];
  private recorderMimeType = "audio/webm";

  constructor() {
    // Lazy initialize connection
    this.connect();
  }

  // Listener subscriptions
  public subscribeStatus(cb: (status: ConnectionStatus) => void) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  public subscribeVoiceStatus(cb: (status: VoiceStatus) => void) {
    this.voiceStatusListeners.add(cb);
    cb(this.voiceStatus);
    return () => this.voiceStatusListeners.delete(cb);
  }

  public subscribeMessages(cb: (msg: SessionMessage) => void) {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  public subscribeTranscript(cb: (text: string) => void) {
    this.transcriptListeners.add(cb);
    return () => this.transcriptListeners.delete(cb);
  }

  public subscribeStream(cb: (text: string) => void) {
    this.streamListeners.add(cb);
    return () => this.streamListeners.delete(cb);
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((cb) => cb(newStatus));
  }

  private setVoiceStatus(newStatus: VoiceStatus) {
    this.voiceStatus = newStatus;
    this.voiceStatusListeners.forEach((cb) => cb(newStatus));

    // Sync lifecycle state machine
    const lifecycleMap: Partial<Record<VoiceStatus, Parameters<typeof sessionLifecycleManager.transition>[0]>> = {
      idle: "IDLE",
      listening: "LISTENING",
      thinking: "THINKING",
      responding: "RESPONDING",
      executing: "EXECUTING",
      stopped: "STOPPED",
    };
    const target = lifecycleMap[newStatus];
    if (target && sessionLifecycleManager.getState() !== target) {
      if (target === "IDLE") sessionLifecycleManager.resetToIdle();
      else sessionLifecycleManager.transition(target);
    }
  }

  public connect() {
    this.isManuallyStopped = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus("connecting");
    const wsUrl = `${AGENT_WS_BASE.replace("http", "ws")}/ws/agent-stream`;
    console.log("[PersistentVoiceSessionManager] Connecting to WebSocket:", wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("[PersistentVoiceSessionManager] WebSocket connected.");
        this.setStatus("connected");
        this.reconnectDelay = 1000;
        this.startHeartbeat();
        this.ws?.send("clear");
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.event === "pong") {
            // Heartbeat response, ignore
            return;
          }

          if (data.event === "config") {
            this.serverVoiceProvider = data.voice_provider;
            console.log("[PersistentVoiceSessionManager] Server configured with voice provider:", this.serverVoiceProvider);
            useAppStore.getState().setProviderConfig({
              llm_provider: data.llm_provider || "",
              voice_provider: data.voice_provider || "",
              memory_provider: data.memory_provider || "",
              orchestrator_provider: data.orchestrator_provider || ""
            });
            if (data.agents) {
              agentRegistry.handleBackendRegistry(data.agents);
            }
            if (data.agent_health) {
              agentBootstrap.syncFromWebSocket(data.agent_health);
            }
            agentRegistry.idle("orchestrator", "Connected to Agent Service");
            return;
          }

          if (data.event === "agent_status") {
            if (data.agent_id) {
              agentRegistry.setAgent(data.agent_id, {
                status: data.status || "active",
                current_task: data.current_task || "Processing",
                progress: data.progress ?? 50,
              });
            }
            return;
          }

          if (data.event === "transcript_updated") {
            agentRegistry.processing("lecture", "Processing live transcript...", 60);
            return;
          }

          if (data.event === "flashcards_generated") {
            console.log("[PersistentVoiceSessionManager] Realtime Flashcards generated:", data.flashcards);
            agentRegistry.complete("flashcard", `Generated ${data.flashcards?.length || 0} flashcards`);
            useAppStore.getState().fetchFlashcards();
            useAppStore.getState().addAgentNotification("New flashcards generated from lecture!", "success", "Flashcard Agent");
            return;
          }

          if (data.event === "notes_generated") {
            console.log("[PersistentVoiceSessionManager] Realtime Notes generated:", data.notes);
            agentRegistry.complete("notes", "Study notes compiled");
            useAppStore.getState().fetchDashboardData();
            useAppStore.getState().addAgentNotification("Study notes compiled for lecture!", "success", "Notes Agent");
            return;
          }

          if (data.event === "quiz_generated") {
            console.log("[PersistentVoiceSessionManager] Realtime Quiz generated");
            agentRegistry.complete("quiz", `Quiz ready on ${data.topic || "topic"}`);
            useAppStore.getState().fetchQuizQuestions(data.topic || "General");
            useAppStore.getState().addAgentNotification("New quiz questions generated!", "success", "Quiz Agent");
            return;
          }

          if (data.event === "graph_updated") {
            console.log("[PersistentVoiceSessionManager] Realtime Graph updated");
            agentRegistry.complete("knowledge-graph", "Knowledge graph updated");
            useAppStore.getState().fetchConceptGraph();
            useAppStore.getState().addAgentNotification("Knowledge graph updated with new concepts!", "info", "Knowledge Graph Agent");
            return;
          }

          if (data.event === "analytics_updated") {
            console.log("[PersistentVoiceSessionManager] Realtime Analytics updated");
            agentRegistry.complete("analytics", "Analytics refreshed");
            useAppStore.getState().fetchDashboardData();
            return;
          }


          if (data.event === "concept_detected") {
            console.log("[PersistentVoiceSessionManager] Concept detected:", data.concept);
            const event = new CustomEvent("concept_detected", { detail: data });
            window.dispatchEvent(event);
            return;
          }

          if (data.event === "stream_start") {
            this.setVoiceStatus("responding");
            this.currentResponseStream = "";
            this.streamListeners.forEach((cb) => cb(""));
          } 
          
          else if (data.event === "stream_chunk") {
            this.currentResponseStream += data.chunk;
            this.streamListeners.forEach((cb) => cb(this.currentResponseStream));
          } 
          
          else if (data.event === "result") {
            this.currentResponseStream = "";
            
            // Intercept voice stop commands from result
            if (commandLifecycleManager.isStopCommand(data.transcript)) {
              this.setVoiceStatus("stopped");
              browserVoiceProvider.speak("Shutting down the voice assistant. Goodbye!", undefined, () => {
                commandLifecycleManager.executeHardStop();
              });
              return;
            }

            this.setVoiceStatus("idle");
            agentRegistry.complete(
              agentRegistry.resolveAgentId(data.agentExecuted || "orchestrator"),
              "Command processed"
            );
            
            const msg: SessionMessage = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              role: "assistant",
              content: data.response,
              timestamp: Date.now(),
              intent: data.intent,
              agentName: data.agentExecuted
            };

            this.messageListeners.forEach((cb) => cb(msg));
            this.transcriptListeners.forEach((cb) => cb(""));

            // Play voice synthesized audio locally if present
            let hasSpeechOutput = false;
            if (data.audioUrl) {
              try {
                hasSpeechOutput = true;
                const audio = new Audio(data.audioUrl);
                this.activeAudio = audio;
                audio.onended = () => {
                  console.log("[PersistentVoiceSessionManager] Playback ended.");
                  this.activeAudio = null;
                  if (!useAppStore.getState().isRecording) {
                    this.startMicrophone();
                  }
                };
                audio.onerror = () => {
                  this.activeAudio = null;
                  if (!useAppStore.getState().isRecording) {
                    this.startMicrophone();
                  }
                };
                await audio.play();
              } catch (audioErr) {
                console.warn("[PersistentVoiceSessionManager] Autoplay blocked or failed:", audioErr);
                hasSpeechOutput = false;
              }
            }

            // Sync with browser speech synthesis if in browser mode and audioUrl is empty
            if (!data.audioUrl && data.response) {
              hasSpeechOutput = true;
              browserVoiceProvider.speak(
                data.response,
                undefined, // onstart
                () => {
                  console.log("[PersistentVoiceSessionManager] Local speak ended.");
                  if (!useAppStore.getState().isRecording) {
                    this.startMicrophone();
                  }
                }
              );
            }

            if (!hasSpeechOutput && !useAppStore.getState().isRecording) {
              this.startMicrophone();
            }

            // Execute client-side action if returned
            if (data.action && data.action.action !== "none") {
              const lectureAction = ["start_recording", "stop_recording"].includes(data.action.action);
              if (lectureAction) {
                this.prepareForLectureRecording();
              }
              this.setVoiceStatus("executing");
              this.executeAction(data.action);
              setTimeout(() => {
                if (this.voiceStatus === "executing") {
                  this.setVoiceStatus("idle");
                }
              }, 1500);
            } else if (data.intent) {
              // Fallback to local routing if server processed intent but didn't emit a direct action
              routeIntent(data.transcript || "");
            }
          }
        } catch (err) {
          console.error("[PersistentVoiceSessionManager] Error parsing message:", err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn("[PersistentVoiceSessionManager] WebSocket error:", err);
        this.setStatus("disconnected");
      };

      this.ws.onclose = () => {
        console.log("[PersistentVoiceSessionManager] WebSocket closed.");
        this.setStatus("disconnected");
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
    } catch (e) {
      console.error("[PersistentVoiceSessionManager] WebSocket init crash:", e);
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isManuallyStopped) return;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    
    this.reconnectTimeout = setTimeout(() => {
      console.log(`[PersistentVoiceSessionManager] Attempting automatic reconnect...`);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  /** Release mic/TTS so Lecture Studio can use SpeechRecognition exclusively */
  public prepareForLectureRecording(): void {
    console.log("[PersistentVoiceSessionManager] Preparing for lecture recording...");
    this.silenceDetector.cancel();
    this.cancelSpeech();
    this.cleanupMedia();
    browserVoiceProvider.stopSTT();
    browserVoiceProvider.resetRecognition();
    sessionLifecycleManager.resetToIdle();
    this.setVoiceStatus("idle");
  }

  /** Soft close — stop mic but keep WebSocket alive for reopen */
  public closeSession() {
    console.log("[PersistentVoiceSessionManager] Soft-closing voice session...");
    this.silenceDetector.cancel();
    this.cancelSpeech();
    this.cleanupMedia();

    browserVoiceProvider.stopSTT();
    browserVoiceProvider.resetRecognition();

    sessionLifecycleManager.resetToIdle();
    this.setVoiceStatus("idle");
    this.transcriptBuffer = "";
    this.transcriptListeners.forEach((cb) => cb(""));
  }

  public terminateSession() {
    console.log("[PersistentVoiceSessionManager] Hard-terminating voice session...");
    this.isManuallyStopped = true;
    this.closeSession();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.stopHeartbeat();
    this.setVoiceStatus("stopped");
    this.setStatus("disconnected");
    sessionLifecycleManager.transition("STOPPED");
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 15000); // 15 seconds heartbeat
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }

  public cancelSpeech() {
    browserVoiceProvider.cancelSpeak();
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
      } catch {}
      this.activeAudio = null;
    }
  }

  private handleSilenceDetected() {
    if (this.voiceStatus === "listening" && this.transcriptBuffer.trim()) {
      console.log("[PersistentVoiceSessionManager] Inactivity detected. Auto-submitting transcript:", this.transcriptBuffer);
      this.stopMicrophone();
    }
  }

  private cleanupMedia() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private pickRecorderMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (const type of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "audio/webm";
  }

  private flushRecorder(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve();
        return;
      }
      const recorder = this.mediaRecorder;
      const onStop = () => {
        recorder.removeEventListener("stop", onStop);
        resolve();
      };
      recorder.addEventListener("stop", onStop);
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });
  }

  public async startMicrophone() {
    this.cancelSpeech();
    this.silenceDetector.cancel();
    this.isManuallyStopped = false;

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      console.log("[PersistentVoiceSessionManager] Re-opening connection before microphone starts.");
      this.connect();
    }

    if (useAppStore.getState().isRecording) {
      console.log("[PersistentVoiceSessionManager] Lecture recording is active. Suppressing global mic start.");
      return;
    }

    // Allow reopen from stopped/idle/disconnected states
    if (!["idle", "stopped", "disconnected"].includes(this.voiceStatus)) return;

    sessionLifecycleManager.resetToIdle();
    this.setVoiceStatus("listening");
    agentRegistry.activate("orchestrator", "Listening to microphone...", 50);
    this.transcriptBuffer = "";
    this.audioChunks = [];
    this.transcriptListeners.forEach((cb) => cb(""));

    browserVoiceProvider.resetRecognition();

    // Fallback: If socket is disconnected, use Browser Web Speech API
    if (this.status !== "connected") {
      console.log("[PersistentVoiceSessionManager] Offline fallback: Using browser voice recognition.");
      browserVoiceProvider.startSTT(
        (text) => {
          this.transcriptBuffer = text;
          this.transcriptListeners.forEach((cb) => cb(text));
          if (commandLifecycleManager.isStopCommand(text)) {
            console.log("[PersistentVoiceSessionManager] Instant voice stop in offline STT:", text);
            this.setVoiceStatus("stopped");
            browserVoiceProvider.speak("Shutting down the voice assistant. Goodbye!", undefined, () => {
              commandLifecycleManager.executeHardStop();
            });
            return;
          }
          if (text.trim()) {
            this.silenceDetector.reset();
          }
        },
        async (finalText) => {
          this.transcriptBuffer = finalText;
          await this.submitTextCommand(finalText);
        },
        (err) => {
          useAppStore.getState().addAgentNotification(
            `Microphone error: ${err}. Try English or use Chrome/Edge.`,
            "warning",
            "Orchestrator"
          );
          this.setVoiceStatus("idle");
        }
      );
      return;
    }

    // Omi + Deepgram: stream mic audio to agent service for cloud STT
    if (this.serverVoiceProvider === "browser") {
      console.log("[PersistentVoiceSessionManager] Server uses browser voice. Skipping audio recording, starting browser STT.");
      browserVoiceProvider.startSTT(
        (text) => {
          this.transcriptBuffer = text;
          this.transcriptListeners.forEach((cb) => cb(text));
          if (commandLifecycleManager.isStopCommand(text)) {
            console.log("[PersistentVoiceSessionManager] Instant voice stop in browser STT:", text);
            this.setVoiceStatus("stopped");
            browserVoiceProvider.speak("Shutting down the voice assistant. Goodbye!", undefined, () => {
              commandLifecycleManager.executeHardStop();
            });
            return;
          }
          if (text.trim()) {
            this.silenceDetector.reset();
          }
        },
        (finalText) => {
          this.transcriptBuffer = finalText;
        },
        (err) => {
          useAppStore.getState().addAgentNotification(
            `Microphone error: ${err}. Try selecting English in the language dropdown.`,
            "warning",
            "Orchestrator"
          );
          this.setVoiceStatus("idle");
        }
      );
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recorderMimeType = this.pickRecorderMimeType();
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: this.recorderMimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Collect audio locally — send as one valid WebM blob on stop (Deepgram rejects concatenated chunks)
      this.mediaRecorder.start(300);

      // Start browser speech recognition in parallel for instant client-side transcription preview
      browserVoiceProvider.startSTT(
        (text) => {
          this.transcriptBuffer = text;
          this.transcriptListeners.forEach((cb) => cb(text));
          if (commandLifecycleManager.isStopCommand(text)) {
            console.log("[PersistentVoiceSessionManager] Instant voice stop in parallel STT:", text);
            this.setVoiceStatus("stopped");
            browserVoiceProvider.speak("Shutting down the voice assistant. Goodbye!", undefined, () => {
              commandLifecycleManager.executeHardStop();
            });
            return;
          }
          if (text.trim()) {
            this.silenceDetector.reset();
          }
        },
        (finalText) => {
          this.transcriptBuffer = finalText;
        },
        (err) => {
          useAppStore.getState().addAgentNotification(
            `Microphone error: ${err}`,
            "warning",
            "Orchestrator"
          );
        }
      );
    } catch (err) {
      console.error("[PersistentVoiceSessionManager] Failed to start microphone capture:", err);
      this.setVoiceStatus("idle");
    }
  }

  public async stopMicrophone() {
    this.silenceDetector.cancel();
    if (this.voiceStatus !== "listening") return;

    await this.flushRecorder();
    // Allow browser STT to emit final results before stopping recognition
    await new Promise((r) => setTimeout(r, 350));
    browserVoiceProvider.stopSTT();

    const transcript = this.transcriptBuffer.trim();
    const ws = this.ws;

    this.cleanupMedia();

    if (ws && ws.readyState === WebSocket.OPEN) {
      this.setVoiceStatus("thinking");
      agentRegistry.processing("orchestrator", "Decoding intent...", 75);

      // Prefer browser STT transcript (runs in parallel for omi/deepgram mode)
      if (transcript) {
        console.log("[PersistentVoiceSessionManager] Sending transcript via text_command:", transcript);
        ws.send(JSON.stringify({ type: "text_command", transcript }));
      } else if (this.serverVoiceProvider === "browser") {
        ws.send(JSON.stringify({ type: "text_command", transcript: "" }));
      } else if (this.audioChunks.length > 0) {
        const blob = new Blob(this.audioChunks, { type: this.recorderMimeType });
        this.audioChunks = [];
        ws.send("clear");
        const buffer = await blob.arrayBuffer();
        ws.send(buffer);
        ws.send("process_recording");
      } else {
        ws.send(JSON.stringify({ type: "text_command", transcript: "" }));
      }
    } else {
      this.setVoiceStatus("idle");
      if (transcript) {
        await this.submitTextCommand(transcript);
      }
    }

    this.audioChunks = [];
  }

  public async submitTextCommand(text: string) {
    this.cancelSpeech();
    this.silenceDetector.cancel();
    if (!text.strip?.() && !text.trim()) return;

    // Intercept manual stop commands from text entry
    if (commandLifecycleManager.isStopCommand(text)) {
      this.setVoiceStatus("stopped");
      browserVoiceProvider.speak("Shutting down the voice assistant. Goodbye!", undefined, () => {
        commandLifecycleManager.executeStop();
      });
      return;
    }
    
    const userMsg: SessionMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    this.messageListeners.forEach((cb) => cb(userMsg));
    this.setVoiceStatus("thinking");

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "text_command",
        transcript: text
      }));
    } else {
      // Local Heuristics Fallback if completely offline
      console.log("[PersistentVoiceSessionManager] Local rule-based processing fallback.");
      setTimeout(() => {
        this.setVoiceStatus("idle");
        
        const routeResult = routeIntent(text);
        let response = "";
        
        if (routeResult.category === "GREETING") {
          const lowerText = text.toLowerCase().trim();
          if (lowerText.includes("good morning")) {
            response = "Good morning! Ready for another learning session? What topic would you like to explore today?";
          } else {
            response = "Hello! I'm your Neural Learn study companion. I can help explain concepts, generate quizzes, create revision notes, analyze lectures, and guide your learning. What would you like to study today?";
          }
        } else if (routeResult.category === "EDUCATIONAL_QUESTION") {
          response = `Opening the AI Tutor space to study: "${text}". Ask me any academic question.`;
        } else if (routeResult.category === "LECTURE_COMMAND") {
          response = `Handling lecture recording session for: "${text}".`;
        } else if (routeResult.category === "QUIZ_COMMAND") {
          response = "Setting up a revision quiz for you in the Revision Center.";
        } else if (routeResult.category === "REVISION_COMMAND") {
          response = "Opening your study materials and flashcards in the Revision Center.";
        } else if (routeResult.category === "PLATFORM_ACTION") {
          response = "Navigating to the requested workspace section.";
        } else {
          response = `I recorded your command: "${text}". (Offline fallback: Please start the Agent Service server on port 8001)`;
        }

        const replyMsg: SessionMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: response,
          timestamp: Date.now(),
          intent: routeResult.intent,
          agentName: "Orchestrator"
        };
        this.messageListeners.forEach((cb) => cb(replyMsg));
        browserVoiceProvider.speak(response);
      }, 1000);
    }
  }

  private executeAction(action: any) {
    console.log("[PersistentVoiceSessionManager] Executing action:", action);
    // Dispatched using custom events to the UI
    const event = new CustomEvent("agent_action", { detail: action });
    window.dispatchEvent(event);
  }

  public sendWebSocketMessage(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const persistentVoiceSessionManager = new PersistentVoiceVoiceSessionManagerWrapper();

// Wrapper class to ensure single global singleton instantiation
function PersistentVoiceVoiceSessionManagerWrapper() {
  if (!(window as any).__voiceSessionManager) {
    (window as any).__voiceSessionManager = new PersistentVoiceSessionManager();
  }
  return (window as any).__voiceSessionManager as PersistentVoiceSessionManager;
}
