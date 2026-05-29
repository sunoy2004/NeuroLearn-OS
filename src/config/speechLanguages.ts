export interface SpeechLanguageOption {
  code: string;
  label: string;
  bcp47?: string;
}

/** Browser speech recognition language options. "auto" uses navigator.language. */
export const SPEECH_LANGUAGES: SpeechLanguageOption[] = [
  { code: "auto", label: "Auto (Browser default)" },
  { code: "en", label: "English", bcp47: "en-US" },
  { code: "hi", label: "Hindi (हिन्दी)", bcp47: "hi-IN" },
  { code: "bn", label: "Bengali (বাংলা)", bcp47: "bn-IN" },
  { code: "fr", label: "French (Français)", bcp47: "fr-FR" },
  { code: "es", label: "Spanish (Español)", bcp47: "es-ES" },
  { code: "de", label: "German (Deutsch)", bcp47: "de-DE" },
  { code: "ta", label: "Tamil (தமிழ்)", bcp47: "ta-IN" },
  { code: "te", label: "Telugu (తెలుగు)", bcp47: "te-IN" },
  { code: "mr", label: "Marathi (मराठी)", bcp47: "mr-IN" },
  { code: "gu", label: "Gujarati (ગુજરાતી)", bcp47: "gu-IN" },
  { code: "pa", label: "Punjabi (ਪੰਜਾਬੀ)", bcp47: "pa-IN" },
  { code: "ar", label: "Arabic (العربية)", bcp47: "ar-SA" },
  { code: "pt", label: "Portuguese (Português)", bcp47: "pt-BR" },
  { code: "ja", label: "Japanese (日本語)", bcp47: "ja-JP" },
  { code: "ko", label: "Korean (한국어)", bcp47: "ko-KR" },
  { code: "zh", label: "Chinese (中文)", bcp47: "zh-CN" },
];

const STORAGE_KEY = "neurolearn_speech_language";

export function getStoredSpeechLanguageCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "auto";
  } catch {
    return "auto";
  }
}

export function setStoredSpeechLanguageCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

/** BCP-47 tag for Web Speech API `recognition.lang` */
export function getSpeechRecognitionLang(): string {
  const stored = getStoredSpeechLanguageCode();
  if (stored === "auto") {
    const nav = navigator.language || "en-US";
    // Chrome works best with full BCP-47 tags
    if (nav.includes("-")) return nav;
    const match = SPEECH_LANGUAGES.find((l) => l.code === nav);
    return match?.bcp47 || `${nav}-US`;
  }
  const match = SPEECH_LANGUAGES.find((l) => l.code === stored);
  return match?.bcp47 || "en-US";
}

export const SPEECH_RECOGNITION_FALLBACK = "en-US";

/** ISO code sent to backend for lecture processing hint */
export function getSpeechLanguageHint(): string {
  const stored = getStoredSpeechLanguageCode();
  if (stored === "auto") return "auto";
  return stored;
}
