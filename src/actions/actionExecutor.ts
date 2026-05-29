import { actionRegistry } from "./actionRegistry";
import { useAppStore } from "@/store/appStore";

// Navigation helper
const navigateTo = (pageName: any) => {
  useAppStore.getState().setPage(pageName);
};

export function registerDefaultActions() {
  const store = useAppStore.getState();

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

  // Quiz Workflow Registry
  actionRegistry.register({
    name: "open_quiz",
    handler: (payload) => {
      navigateTo("revision");
      const topic = payload?.topic || "General";
      window.dispatchEvent(new CustomEvent("revision_quiz_topic", { detail: { topic } }));
      useAppStore.getState().fetchQuizQuestions(topic, { count: 10, forceRegenerate: true });
      useAppStore.getState().addAgentNotification(
        `Generating quiz on ${topic} from your lecture materials...`,
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
  // Normalize action name (e.g. "navigate" with target "tutor" becomes "navigate_tutor")
  let targetAction = actionName;
  if (actionName === "navigate" && payload?.target) {
    targetAction = `navigate_${payload.target.replace(/^\//, "")}`;
  }

  const registered = actionRegistry.get(targetAction);
  if (registered) {
    console.log(`[ActionExecutor] Executing: ${targetAction}`, payload);
    try {
      registered.handler(payload);
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
  if (actionName === "open_modal") mappedAction = "open_modal";
  if (actionName === "display_summary") mappedAction = "display_summary";

  if (mappedAction) {
    const regFallback = actionRegistry.get(mappedAction);
    if (regFallback) {
      console.log(`[ActionExecutor] Executing mapped action: ${mappedAction}`, payload);
      try {
        regFallback.handler(payload);
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
