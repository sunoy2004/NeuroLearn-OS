/**
 * Cleans raw transcription text by:
 * 1. Removing speech filler words (um, uh, like, you know, sort of)
 * 2. Removing successive duplicate words (e.g., "database database" -> "database")
 * 3. Restoring punctuation and sentence capitalization
 * 4. Normalizing spacing
 */
export function cleanTranscriptText(text: string): string {
  if (!text) return "";

  let cleaned = text.trim();

  // 1. Remove speech artifacts/fillers
  const fillers = /\b(uh|um|er|ah|like|you know|sort of|kind of|basically|actually)\b/gi;
  cleaned = cleaned.replace(fillers, "");

  // 2. Remove consecutive duplicate words (case-insensitive)
  // E.g., "database database" -> "database"
  cleaned = cleaned.replace(/\b([a-zA-Z0-9_'\-]+)\s+\1\b/gi, "$1");
  cleaned = cleaned.replace(/\b([a-zA-Z0-9_'\-]+)\s+\1\b/gi, "$1"); // Run twice to catch nested duplicates

  // 3. Normalize spacing
  cleaned = cleaned.replace(/\s+/g, " ");

  // 4. Basic punctuation and sentence casing restoration
  // Ensure the text starts with a capital letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Split by potential sentence boundaries to restore capitalization
  const sentenceEndings = /(?<=[.!?])\s+/;
  const sentences = cleaned.split(sentenceEndings);
  
  const casedSentences = sentences.map((sentence) => {
    let s = sentence.trim();
    if (s.length === 0) return "";
    
    // Capitalize first letter of sentence
    s = s.charAt(0).toUpperCase() + s.slice(1);
    
    // Add trailing period if missing and not ending with other punctuation
    if (!/[.!?]$/.test(s)) {
      s += ".";
    }
    return s;
  });

  return casedSentences.filter(Boolean).join(" ");
}
