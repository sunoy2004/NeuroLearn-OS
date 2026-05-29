export type ConversationIntent =
  | "GREETING"
  | "EDUCATIONAL_DISCUSSION"
  | "PLATFORM_ACTION"
  | "QUIZ_REQUEST"
  | "FLASHCARD_REQUEST"
  | "NOTES_REQUEST"
  | "LECTURE_REQUEST"
  | "UNKNOWN";

export interface ConversationClassificationResult {
  intent: ConversationIntent;
  confidence: number;
  entities: Record<string, string>;
  reasoning: string;
}

const intentPatterns: Record<ConversationIntent, RegExp[]> = {
  GREETING: [
    /^(?:hello|hi|hey|hiya|howdy|greetings)(?:\s|$|!|,)/i,
    /^good\s+(?:morning|afternoon|evening|day)/i,
    /^how\s+are\s+you/i,
    /^what(?:'s|\s+is)\s+up/i,
  ],
  EDUCATIONAL_DISCUSSION: [
    /can\s+you\s+help\s+me\s+study/i,
    /what\s+can\s+you\s+teach\s+me/i,
    /help\s+me\s+prepare\s+for\s+exams/i,
    /i\s+need\s+help\s+understanding/i,
    /explain\s+/i,
    /teach\s+me\s+/i,
    /what\s+is\s+/i,
    /how\s+does\s+/i,
    /why\s+does\s+/i,
    /help\s+me\s+understand/i,
  ],
  PLATFORM_ACTION: [
    /go\s+to\s+/i,
    /open\s+/i,
    /navigate\s+to\s+/i,
    /show\s+my\s+(?:stats|progress|analytics|dashboard)/i,
    /how\s+am\s+i\s+doing/i,
  ],
  QUIZ_REQUEST: [
    /(?:take|start|begin|open)\s+(?:a\s+)?quiz/i,
    /quiz\s+me/i,
    /test\s+me/i,
  ],
  FLASHCARD_REQUEST: [
    /(?:create|generate|make|show)\s+(?:some\s+)?flashcards/i,
    /flashcards\s+/i,
  ],
  NOTES_REQUEST: [
    /(?:generate|make|compile|write|create)\s+(?:study\s+)?notes/i,
    /notes\s+(?:for|from)/i,
  ],
  LECTURE_REQUEST: [
    /start\s+(?:recording\s+)?(?:the\s+)?(?:lecture|class|session)/i,
    /stop\s+(?:recording\s+)?(?:the\s+)?(?:lecture|class|session)/i,
    /begin\s+(?:recording\s+)?(?:lecture|class)/i,
    /end\s+(?:the\s+)?(?:lecture|class)/i,
    /record\s+(?:my\s+)?(?:lecture|class)/i,
  ],
  UNKNOWN: [],
};

const entityExtractionPatterns = {
  topic: [
    /(?:on|about|in|study|explain)\s+([A-Za-z0-9\s#\+\-]+)(?:\s|$|\.|\?|,)/i,
    /(?:quiz|test|teach)\s+([A-Za-z0-9\s#\+\-]+)(?:\s|$|\.|\?|,)/i,
  ],
  subject: [
    /(?:my\s+)?(DBMS|Operating System|OS|Data Structures|Algorithms|Computer Networks?|Database)/i,
  ],
};

function extractEntities(transcript: string, intent: ConversationIntent): Record<string, string> {
  const entities: Record<string, string> = {};

  for (const pattern of entityExtractionPatterns.topic) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const val = match[1].trim();
      if (val && !/^(me|a|the|topic|subject|class|lecture|session)$/i.test(val)) {
        entities.topic = val;
        break;
      }
    }
  }

  for (const pattern of entityExtractionPatterns.subject) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      entities.subject = match[1].trim();
      break;
    }
  }

  return entities;
}

export function classifyConversationIntent(transcript: string): ConversationClassificationResult {
  const normalized = transcript.toLowerCase().trim();

  let bestMatch: { intent: ConversationIntent; confidence: number; reasoning: string } = {
    intent: "UNKNOWN",
    confidence: 0,
    reasoning: "No matching pattern found",
  };

  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (intent === "UNKNOWN") continue;

    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        const match = normalized.match(pattern);
        const matchedText = match ? match[0] : "";
        
        // Boost confidence based on match specificity
        let confidence = 0.5;
        if (matchedText.length > 0) {
          confidence = Math.min((matchedText.length / normalized.length) * 1.5, 0.98);
        }
        
        // Exact matches or high-priority patterns get full confidence
        if (normalized === matchedText || (intent === "GREETING" && matchedText.length > 2)) {
          confidence = 0.99;
        }

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            intent: intent as ConversationIntent,
            confidence,
            reasoning: `Pattern "${pattern.source}" matched with ${(confidence * 100).toFixed(0)}% confidence`,
          };
        }
      }
    }
  }

  // Final heuristic tuning
  if (bestMatch.intent === "UNKNOWN") {
    // If it's a question, guess EDUCATIONAL_DISCUSSION
    if (normalized.endsWith("?") || /^(what|how|why|can\s+you|describe)/i.test(normalized)) {
      bestMatch = {
        intent: "EDUCATIONAL_DISCUSSION",
        confidence: 0.6,
        reasoning: "Question heuristic match",
      };
    }
  }

  const entities = extractEntities(transcript, bestMatch.intent);

  return {
    intent: bestMatch.intent,
    confidence: bestMatch.confidence,
    entities,
    reasoning: bestMatch.reasoning,
  };
}
