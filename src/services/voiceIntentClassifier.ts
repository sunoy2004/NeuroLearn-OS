import type { VoiceIntent, IntentClassificationResult, VoiceCommand } from "@/types";

const intentPatterns: Record<VoiceIntent, RegExp[]> = {
  LECTURE_START: [
    /start (?:recording )?(?:my )?(?:lecture|class|session)/i,
    /begin (?:recording )?(?:lecture|class)/i,
    /record (?:my )?(?:lecture|class)/i,
  ],
  LECTURE_STOP: [
    /stop (?:recording )?(?:the )?(?:lecture|class|session)/i,
    /end (?:the )?(?:lecture|class|recording)/i,
    /pause (?:the )?(?:lecture|recording)/i,
  ],
  QUIZ_REQUEST: [
    /(?:take|start|begin) (?:a )?quiz/i,
    /quiz me (?:on |about )?/i,
    /test me (?:on |about )?/i,
    /(?:i )?want (?:to take|a) (?:a )?quiz/i,
  ],
  TUTORING_REQUEST: [
    /explain (?:to me )?/i,
    /what is /i,
    /teach me (?:about )?/i,
    /help me understand/i,
    /how does /i,
    /why does /i,
    /can you (?:explain|teach|tell)/i,
  ],
  REVISION_START: [
    /start (?:a )?revision/i,
    /revision (?:session)?/i,
    /review (?:my )?(?:topics|concepts)/i,
    /revise (?:my )?(?:topics?)/i,
  ],
  ANALYTICS_QUERY: [
    /show (?:my )?(?:progress|analytics|stats)/i,
    /how (?:am i )?(?:doing|progressing)/i,
    /what (?:is |are )?my (?:scores?|results?|performance)/i,
    /analyze (?:my )?(?:learning|progress)/i,
  ],
  FLASHCARD_CREATE: [
    /create (?:some )?flashcards/i,
    /generate flashcards/i,
    /make flashcards/i,
    /flashcards (?:for|from)/i,
  ],
  ROADMAP_CREATE: [
    /create (?:a )?(?:study )?roadmap/i,
    /generate (?:a )?(?:learning )?plan/i,
    /make (?:a )?(?:study )?plan/i,
    /roadmap (?:for|to master)/i,
  ],
  GOAL_SET: [
    /(?:i )?want (?:to )?(?:master|learn|complete)/i,
    /set (?:a )?(?:learning )?goal/i,
    /my goal (?:is|to)/i,
  ],
  WEAK_AREAS_QUERY: [
    /(?:what are |show )?my (?:weak|struggling) (?:areas?|topics?)/i,
    /where (?:am i )?(?:struggling|weak)/i,
    /topics (?:i )?need (?:to )?(?:work on|improve)/i,
  ],
  PROGRESS_QUERY: [
    /(?:how much )?(?:have i )?(?:completed|covered|learned)/i,
    /what (?:have i )?(?:s done|completed|learned)/i,
    /my (?:overall|current) progress/i,
  ],
  EXPLANATION_REQUEST: [
    /can you explain/i,
    /explain (?:again|like before)/i,
    /tell me more (?:about )?/i,
    /elaborate on/i,
  ],
  UNKNOWN: [],
};

const entityExtractionPatterns = {
  topic: [
    /(?:on |about |in )?([A-Za-z\s]+?)(?:\s|$|\.|,)/,
    /(?:quiz|test|explain|teach) ([A-Za-z\s]+?)(?:\s|$|\.|,)/,
  ],
  subject: [
    /(?:my )?(DBMS|Operating System|OS|Data Structures|Algorithms|Computer Networks?|Database)/i,
  ],
  duration: [
    /(\d+)\s*(?:minutes?|mins?|hours?|hrs?)/i,
  ],
};

function extractEntities(transcript: string, intent: VoiceIntent): Record<string, string> {
  const entities: Record<string, string> = {};

  if (intent === "QUIZ_REQUEST" || intent === "TUTORING_REQUEST" || intent === "LECTURE_START") {
    for (const pattern of entityExtractionPatterns.topic) {
      const match = transcript.match(pattern);
      if (match && match[1]) {
        entities.topic = match[1].trim();
        break;
      }
    }
    for (const pattern of entityExtractionPatterns.subject) {
      const match = transcript.match(pattern);
      if (match) {
        entities.subject = match[1];
        break;
      }
    }
  }

  if (intent === "GOAL_SET") {
    const goalMatch = transcript.match(/(?:master|learn|complete)\s+([A-Za-z\s]+?)(?:\s+in|\s|$)/i);
    if (goalMatch) {
      entities.goal = goalMatch[1].trim();
    }
    const timeMatch = transcript.match(/in\s+(\d+)\s*(?:days?|weeks?|months?)/i);
    if (timeMatch) {
      entities.timeline = timeMatch[0];
    }
  }

  if (intent === "ANALYTICS_QUERY" || intent === "WEAK_AREAS_QUERY") {
    const subjectMatch = transcript.match(/(?:in |for )([A-Za-z\s]+?)(?:\s|$|\.|,)/);
    if (subjectMatch) {
      entities.subject = subjectMatch[1].trim();
    }
  }

  return entities;
}

export function classifyIntent(transcript: string): IntentClassificationResult {
  const normalizedTranscript = transcript.toLowerCase().trim();

  let bestMatch: { intent: VoiceIntent; confidence: number; reasoning: string } = {
    intent: "UNKNOWN",
    confidence: 0,
    reasoning: "No matching pattern found",
  };

  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (intent === "UNKNOWN") continue;

    for (const pattern of patterns) {
      if (pattern.test(normalizedTranscript)) {
        const matchedText = normalizedTranscript.match(pattern)?.[0] || "";
        const confidence = Math.min(
          (matchedText.length / normalizedTranscript.length) * 1.5,
          0.95
        );

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            intent: intent as VoiceIntent,
            confidence,
            reasoning: `Pattern "${pattern.source}" matched with ${(confidence * 100).toFixed(0)}% confidence`,
          };
        }
      }
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

export function createVoiceCommand(
  transcript: string,
  userId?: string
): VoiceCommand {
  const classification = classifyIntent(transcript);

  return {
    id: `vc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    transcript,
    intent: classification.intent,
    confidence: classification.confidence,
    entities: classification.entities,
    userId,
    timestamp: Date.now(),
  };
}

export function getIntentDescription(intent: VoiceIntent): string {
  const descriptions: Record<VoiceIntent, string> = {
    LECTURE_START: "Start recording a lecture or class session",
    LECTURE_STOP: "Stop the current lecture recording",
    QUIZ_REQUEST: "Start an interactive voice quiz session",
    TUTORING_REQUEST: "Request AI tutoring explanation",
    REVISION_START: "Begin a revision session",
    ANALYTICS_QUERY: "Query learning analytics and progress",
    FLASHCARD_CREATE: "Generate flashcards from content",
    ROADMAP_CREATE: "Create a learning roadmap",
    GOAL_SET: "Set a learning goal",
    WEAK_AREAS_QUERY: "Show weak areas needing improvement",
    PROGRESS_QUERY: "Check learning progress",
    EXPLANATION_REQUEST: "Request detailed explanation",
    UNKNOWN: "Unknown intent - please rephrase",
  };

  return descriptions[intent];
}

export function getSuggestedVoiceCommands(): Array<{ intent: VoiceIntent; example: string }> {
  return [
    { intent: "LECTURE_START", example: "Start recording my DBMS class" },
    { intent: "QUIZ_REQUEST", example: "Take a quiz on Operating Systems" },
    { intent: "TUTORING_REQUEST", example: "Explain B+ tree indexing" },
    { intent: "ANALYTICS_QUERY", example: "Show my progress" },
    { intent: "WEAK_AREAS_QUERY", example: "What are my weak topics?" },
    { intent: "FLASHCARD_CREATE", example: "Generate flashcards from my lecture" },
    { intent: "ROADMAP_CREATE", example: "Create a study roadmap for DBMS" },
    { intent: "GOAL_SET", example: "I want to master Data Structures in 2 weeks" },
  ];
}
