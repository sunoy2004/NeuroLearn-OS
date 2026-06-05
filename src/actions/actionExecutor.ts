import { actionRegistry } from "./actionRegistry";
import { useAppStore } from "@/store/appStore";
import { isGreetingTranscript } from "@/services/conversationIntentClassifier";
import { agentRegistry } from "@/agents/agentRegistry";

// Navigation helper
const navigateTo = (pageName: any) => {
  useAppStore.getState().setPage(pageName);
};

/** Flatten AgentAction shape `{ action, target, payload: { topic } }` for handlers. */
function normalizeActionPayload(raw?: Record<string, unknown>): Record<string, unknown> {
  if (!raw) return {};
  const nested =
    raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
      ? { ...(raw.payload as Record<string, unknown>) }
      : {};
  if (raw.target) nested.target = nested.target ?? raw.target;
  if (raw.transcript) nested.transcript = raw.transcript;
  if (raw.message) nested.message = raw.message;
  return nested;
}

export function registerDefaultActions() {
  // Navigation Registry
  actionRegistry.register({
    name: "navigate_dashboard",
    handler: () => navigateTo("dashboard")
  });
  actionRegistry.register({
    name: "navigate_lecture-studio",
    handler: () => navigateTo("lecture-studio")
  });
  actionRegistry.register({
    name: "navigate_tutor",
    handler: () => navigateTo("tutor")
  });
  actionRegistry.register({
    name: "navigate_knowledge-graph",
    handler: () => navigateTo("knowledge-graph")
  });
  actionRegistry.register({
    name: "navigate_analytics",
    handler: () => navigateTo("analytics")
  });
  actionRegistry.register({
    name: "navigate_revision",
    handler: () => navigateTo("revision")
  });
  actionRegistry.register({
    name: "navigate_voice",
    handler: () => navigateTo("voice")
  });

  // Lecture Workflow Registry
  actionRegistry.register({
    name: "start_lecture",
    handler: (payload) => {
      navigateTo("lecture-studio");
      agentRegistry.activate("lecture", `Recording — ${payload?.subject || "General Study"}`, 55);
      // prepareForLectureRecording already called by sessionManager before this action
      useAppStore.getState().clearLectureTranscript();
      useAppStore.getState().setRecordingTime(0);
      useAppStore.getState().setRecording(true);
      useAppStore.getState().addAgentNotification(
        `Lecture recording started — speak now (${payload?.subject || "General Study"})`,
        "success",
        "LectureAgent"
      );
    }
  });

  actionRegistry.register({
    name: "stop_lecture",
    handler: () => {
      useAppStore.getState().setRecording(false);
      agentRegistry.processing("notes", "Compiling lecture notes & summary...", 70);
      useAppStore.getState().addAgentNotification(
        "Lecture recording stopped. Processing dynamic note summaries...",
        "success",
        "LectureAgent"
      );
      // Dispatch event or call a window event to trigger backend saving in LectureStudio.tsx
      const stopEvent = new CustomEvent("lecture_stopped_trigger");
      window.dispatchEvent(stopEvent);
    }
  });

  actionRegistry.register({
    name: "pause_lecture",
    handler: () => {
      useAppStore.getState().addAgentNotification(
        "Lecture recording paused",
        "warning",
        "LectureAgent"
      );
    }
  });

  actionRegistry.register({
    name: "resume_lecture",
    handler: () => {
      useAppStore.getState().addAgentNotification(
        "Lecture recording resumed",
        "success",
        "LectureAgent"
      );
    }
  });

  actionRegistry.register({
    name: "open_flashcards",
    handler: (payload) => {
      navigateTo("revision");
      const topic = (payload?.topic as string) || "General";
      window.dispatchEvent(new CustomEvent("revision_flashcard_topic", { detail: { topic } }));
      agentRegistry.processing("flashcard", `Generating flashcards on ${topic}...`, 72);
      void useAppStore
        .getState()
        .fetchFlashcardsForTopic(topic, { count: 15, forceRegenerate: true })
        .then(() => agentRegistry.complete("flashcard", `Flashcards ready on ${topic}`))
        .catch(() => agentRegistry.idle("flashcard", "Flashcard generation failed"));
      useAppStore.getState().addAgentNotification(
        `Generating flashcards on ${topic}...`,
        "success",
        "FlashcardAgent"
      );
    }
  });

  // Quiz Workflow Registry
  actionRegistry.register({
    name: "open_quiz",
    handler: (payload) => {
      navigateTo("revision");
      const topic = (payload?.topic as string) || "General";
      window.dispatchEvent(new CustomEvent("revision_quiz_topic", { detail: { topic } }));
      agentRegistry.processing("quiz", `Generating quiz on ${topic}...`, 72);
      void useAppStore
        .getState()
        .fetchQuizQuestions(topic, { count: 10, forceRegenerate: true })
        .then(() => agentRegistry.complete("quiz", `Quiz ready on ${topic}`))
        .catch(() => agentRegistry.idle("quiz", "Quiz generation failed"));
      useAppStore.getState().addAgentNotification(
        `Generating quiz on ${topic}...`,
        "success",
        "QuizAgent"
      );
    }
  });

  // Modal Open Registry
  actionRegistry.register({
    name: "open_modal",
    handler: (payload) => {
      useAppStore.getState().addAgentNotification(
        `Opened study workspace modal: ${payload?.target || "cognitive_settings"}`,
        "info",
        "Orchestrator"
      );
    }
  });

  // Display Summary Registry
  actionRegistry.register({
    name: "display_summary",
    handler: (payload) => {
      navigateTo("lecture-studio");
      useAppStore.getState().addAgentNotification(
        `Rendered lecture summary outline: "${payload?.title || 'Summary'}"`,
        "success",
        "SummaryAgent"
      );
    }
  });
}

/**
 * Executes a frontend action by resolving it from the action registry
 */
export function executeAction(actionName: string, payload?: any): boolean {
  const transcript = payload?.transcript || payload?.message || "";
  if (
    actionName === "navigate" &&
    payload?.target === "tutor" &&
    transcript &&
    isGreetingTranscript(transcript)
  ) {
    console.log("[ActionExecutor] Skipping tutor navigation for greeting-only utterance");
    return true;
  }

  // Normalize action name (e.g. "navigate" with target "tutor" becomes "navigate_tutor")
  let targetAction = actionName;
  if (actionName === "navigate" && payload?.target) {
    targetAction = `navigate_${payload.target.replace(/^\//, "")}`;
  }

  const normalizedPayload = normalizeActionPayload(
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined
  );

  const registered = actionRegistry.get(targetAction);
  if (registered) {
    console.log(`[ActionExecutor] Executing: ${targetAction}`, normalizedPayload);
    try {
      registered.handler(normalizedPayload);
      return true;
    } catch (err) {
      console.error(`[ActionExecutor] Error executing ${targetAction}:`, err);
      return false;
    }
  }

  // Fallback map for direct string matches (e.g. if the actionName is "start_recording" or "stop_recording")
  let mappedAction: string | null = null;
  if (actionName === "start_recording") mappedAction = "start_lecture";
  if (actionName === "stop_recording") mappedAction = "stop_lecture";
  if (actionName === "open_quiz") mappedAction = "open_quiz";
  if (actionName === "open_flashcards") mappedAction = "open_flashcards";
  if (actionName === "open_modal") mappedAction = "open_modal";
  if (actionName === "display_summary") mappedAction = "display_summary";

  if (mappedAction) {
    const regFallback = actionRegistry.get(mappedAction);
    if (regFallback) {
      console.log(`[ActionExecutor] Executing mapped action: ${mappedAction}`, normalizedPayload);
      try {
        regFallback.handler(normalizedPayload);
        return true;
      } catch (err) {
        console.error(`[ActionExecutor] Error executing mapped ${mappedAction}:`, err);
        return false;
      }
    }
  }

  console.warn(`[ActionExecutor] Unrecognized action: ${actionName} / ${targetAction}`);
  return false;
}
