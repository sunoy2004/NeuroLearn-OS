import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { persistentVoiceSessionManager } from "@/services/voice/sessionManager";
import { useAppStore } from "@/store/appStore";
import { agentRegistry } from "@/agents/agentRegistry";
import type { 
  ConnectionStatus, 
  VoiceStatus, 
  SessionMessage 
} from "@/services/voice/sessionManager";

interface AgentContextType {
  websocketStatus: ConnectionStatus;
  voiceStatus: VoiceStatus;
  transcript: string;
  aiResponseStream: string;
  messages: SessionMessage[];
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendTextMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  providerConfig: {
    llm_provider: string;
    voice_provider: string;
    memory_provider: string;
    orchestrator_provider: string;
  };
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [websocketStatus, setWebsocketStatus] = useState<ConnectionStatus>("disconnected");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [aiResponseStream, setAiResponseStream] = useState("");
  const [messages, setMessages] = useState<SessionMessage[]>([]);

  useEffect(() => {
    const unsubStatus = persistentVoiceSessionManager.subscribeStatus((newStatus) => {
      setWebsocketStatus(newStatus);
      if (newStatus === "connecting") {
        agentRegistry.processing("orchestrator", "Connecting to Agent Service...", 30);
      } else if (newStatus === "connected") {
        agentRegistry.idle("orchestrator", "Monitoring voice command streams");
      } else {
        agentRegistry.idle("orchestrator", "Agent Service offline");
      }
    });

    const unsubVoice = persistentVoiceSessionManager.subscribeVoiceStatus((newVoice) => {
      setVoiceStatus(newVoice);
      if (newVoice === "listening") {
        agentRegistry.activate("orchestrator", "Listening to microphone...", 50);
      } else if (newVoice === "thinking") {
        agentRegistry.processing("orchestrator", "Thinking / Decoding cognitive intent...", 80);
      } else if (newVoice === "responding") {
        agentRegistry.activate("orchestrator", "Responding to student...", 90);
      } else if (newVoice === "executing") {
        agentRegistry.activate("orchestrator", "Orchestrating system action...", 95);
      } else if (newVoice === "idle") {
        agentRegistry.idle("orchestrator", "Monitoring voice command streams");
      }
    });

    const unsubTranscript = persistentVoiceSessionManager.subscribeTranscript((text) => {
      setTranscript(text);
      if (text) {
        agentRegistry.activate("orchestrator", `Hearing: "${text.slice(0, 30)}..."`, 60);
      }
    });

    const unsubStream = persistentVoiceSessionManager.subscribeStream((streamText) => {
      setAiResponseStream(streamText);
      if (streamText) {
        agentRegistry.processing("orchestrator", "Streaming companion response...", 90);
      }
    });

    const unsubMessages = persistentVoiceSessionManager.subscribeMessages((msg) => {
      setMessages((prev) => [...prev, msg]);
      setAiResponseStream("");

      if (msg.role === "assistant") {
        const agentId = agentRegistry.resolveAgentId(msg.agentName || "orchestrator");
        agentRegistry.complete(agentId, msg.intent ? `Processed: ${msg.intent}` : "Command processed");
      }
    });

    return () => {
      unsubStatus();
      unsubVoice();
      unsubTranscript();
      unsubStream();
      unsubMessages();
    };
  }, []);

  const startListening = useCallback(async () => {
    await persistentVoiceSessionManager.startMicrophone();
  }, []);

  const stopListening = useCallback(() => {
    persistentVoiceSessionManager.stopMicrophone();
  }, []);

  const sendTextMessage = async (text: string) => {
    await persistentVoiceSessionManager.submitTextCommand(text);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const providerConfig = useAppStore((s) => s.providerConfig);

  return (
    <AgentContext.Provider
      value={{
        websocketStatus,
        voiceStatus,
        transcript,
        aiResponseStream,
        messages,
        startListening,
        stopListening,
        sendTextMessage,
        clearMessages,
        providerConfig
      }}
    >
      {children}
    </AgentContext.Provider>
  );
};

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error("useAgent must be used within an AgentContextProvider");
  }
  return context;
};
