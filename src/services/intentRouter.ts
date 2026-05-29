import { classifyConversationIntent, type ConversationIntent } from "./conversationIntentClassifier";
import { executeAction } from "@/actions/actionExecutor";
import { useAppStore } from "@/store/appStore";

export interface RoutingResult {
  category: ConversationIntent;
  intent: string;
  handled: boolean;
}

/**
 * Route intent to appropriate frontend pages and actions.
 */
export function routeIntent(transcript: string): RoutingResult {
  const classification = classifyConversationIntent(transcript);
  const intent = classification.intent;
  const store = useAppStore.getState();

  console.log(`[IntentRouter] Routing conversation intent: ${intent} | Transcript: "${transcript}"`);

  let handled = false;

  switch (intent) {
    case "GREETING":
      store.setPage("tutor");
      handled = true;
      break;

    case "EDUCATIONAL_DISCUSSION":
      store.setPage("tutor");
      handled = true;
      break;

    case "PLATFORM_ACTION":
      const p = transcript.toLowerCase();
      let target = "dashboard";
      if (p.includes("tutor")) target = "tutor";
      else if (p.includes("revision") || p.includes("flashcard") || p.includes("quiz")) target = "revision";
      else if (p.includes("lecture") || p.includes("studio")) target = "lecture-studio";
      else if (p.includes("analytics") || p.includes("progress")) target = "analytics";
      else if (p.includes("graph") || p.includes("network")) target = "knowledge-graph";
      else if (p.includes("setting")) target = "settings";

      handled = executeAction("navigate", { target });
      break;

    case "LECTURE_REQUEST":
      store.setPage("lecture-studio");
      if (transcript.toLowerCase().includes("start") || transcript.toLowerCase().includes("begin")) {
        handled = executeAction("start_recording", { subject: classification.entities.subject || "General Study" });
      } else {
        handled = executeAction("stop_recording");
      }
      break;

    case "QUIZ_REQUEST":
      store.setPage("revision");
      handled = executeAction("open_quiz", { topic: classification.entities.topic || "General" });
      break;

    case "FLASHCARD_REQUEST":
      store.setPage("revision");
      handled = true;
      break;

    case "NOTES_REQUEST":
      store.setPage("lecture-studio");
      handled = true;
      break;

    default:
      handled = false;
      break;
  }

  return {
    category: intent,
    intent,
    handled
  };
}
