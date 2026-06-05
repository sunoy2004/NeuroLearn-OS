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
function extractTopicFromTranscript(transcript: string, kind: "quiz" | "flashcard"): string | null {
  const patterns = [
    new RegExp(`(?:generate|create|make)\\s+(?:a\\s+)?${kind}s?\\s+(?:on|about|for)\\s+(.+)`, "i"),
    new RegExp(`${kind}s?\\s+(?:on|about|for)\\s+(.+)`, "i"),
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[.!?]+$/, "");
    }
  }
  return null;
}

export function routeIntent(transcript: string): RoutingResult {
  const classification = classifyConversationIntent(transcript);
  const intent = classification.intent;
  const store = useAppStore.getState();

  console.log(`[IntentRouter] Routing conversation intent: ${intent} | Transcript: "${transcript}"`);

  let handled = false;

  switch (intent) {
    case "GREETING":
      // Respond in place — no navigation for casual greetings
      handled = true;
      break;

    case "EDUCATIONAL_DISCUSSION":
      // Only navigate when user explicitly asks to open tutor / study space
      if (/open\s+(the\s+)?(ai\s+)?tutor|go\s+to\s+tutor|take\s+me\s+to\s+tutor/i.test(transcript)) {
        store.setPage("tutor");
      }
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

    case "QUIZ_REQUEST": {
      store.setPage("revision");
      const quizTopic = classification.entities.topic || extractTopicFromTranscript(transcript, "quiz");
      if (!quizTopic) {
        handled = true;
        break;
      }
      handled = executeAction("open_quiz", { topic: quizTopic });
      break;
    }

    case "FLASHCARD_REQUEST": {
      store.setPage("revision");
      const fcTopic = classification.entities.topic || extractTopicFromTranscript(transcript, "flashcard");
      if (!fcTopic) {
        handled = true;
        break;
      }
      handled = executeAction("open_flashcards", { topic: fcTopic });
      break;
    }

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
