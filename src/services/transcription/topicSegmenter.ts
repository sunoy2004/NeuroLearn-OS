import { cleanTranscriptText } from "./transcriptCleaner";

export interface TranscriptSection {
  title: string;
  content: string;
}

const transitionRegex = new RegExp(
  /\b(now let's (?:look at|talk about|discuss|explore|turn our attention to)|moving on to|next is|another key concept is|secondly,|firstly,|finally,|let's discuss|we will now examine|let's look at)\b/i
);

/**
 * Heuristically segments cleaned lecture transcripts into distinct sections based on transition phrases.
 */
export function segmentTranscript(text: string, subject: string = "Lecture"): TranscriptSection[] {
  const cleanedText = cleanTranscriptText(text);
  if (!cleanedText) return [];

  // Split by sentence boundaries first
  const sentences = cleanedText.match(/[^.!?]+[.!?]+(\s|$)/g) || [cleanedText];
  const sections: TranscriptSection[] = [];
  
  let currentTitle = `${subject} Fundamentals`;
  let currentContent: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;

    // Check for topic transition in this sentence
    if (transitionRegex.test(sentence) && currentContent.length >= 2) {
      // Finalize current section
      sections.push({
        title: currentTitle,
        content: currentContent.join(" "),
      });

      // Extract new title from the transition sentence
      let newTitle = "Related Concept";
      const topicMatch = sentence.match(/(?:about|discuss|examine|at|to)\s+([A-Za-z0-9\s]+)(?:\.|\?|!|$|,)/i);
      if (topicMatch && topicMatch[1] && topicMatch[1].trim().split(/\s+/).length <= 4) {
        newTitle = capitalizeWords(topicMatch[1].trim());
      } else {
        // Fallback: search for capitalized words or first few words
        const words = sentence.split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
          newTitle = capitalizeWords(words.slice(-2).join(" ").replace(/[.!?]/g, ""));
        }
      }

      currentTitle = newTitle;
      currentContent = [sentence];
    } else {
      currentContent.push(sentence);
    }
  }

  // Add the last remaining section
  if (currentContent.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentContent.join(" "),
    });
  }

  // Ensure sections aren't too small or empty
  return sections.filter(sec => sec.content.trim().length > 10);
}

function capitalizeWords(str: string): string {
  return str
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
