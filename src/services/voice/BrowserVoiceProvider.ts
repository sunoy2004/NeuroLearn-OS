// Web Speech API wrapper for browser speech recognition and synthesis
import { getSpeechRecognitionLang, SPEECH_RECOGNITION_FALLBACK } from "@/config/speechLanguages";

function createRecognitionInstance(): any | null {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = getSpeechRecognitionLang();
  return rec;
}

export class BrowserVoiceProvider {
  private recognition: any = null;
  private synthesis: SpeechSynthesis = window.speechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isListening = false;
  private usedFallbackLang = false;

  constructor() {
    this.recognition = createRecognitionInstance();
  }

  public startSTT(
    onTranscriptChange: (text: string) => void,
    onFinalTranscript: (text: string) => void,
    onError?: (err: string) => void
  ) {
    if (!this.recognition) {
      if (onError) onError("SpeechRecognition not supported in this browser. Use Chrome or Edge.");
      return;
    }
    if (this.isListening) return;

    this.isListening = true;
    this.usedFallbackLang = false;
    this.recognition.lang = getSpeechRecognitionLang();

    this.recognition.onresult = (e: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interimTranscript += e.results[i][0].transcript;
        }
      }

      const currentText = finalTranscript || interimTranscript;
      if (currentText) {
        onTranscriptChange(currentText);
      }
      if (finalTranscript) {
        onFinalTranscript(finalTranscript);
      }
    };

    this.recognition.onerror = (e: any) => {
      const err = e?.error || "unknown";
      console.warn("Browser STT Error:", err);

      if (
        !this.usedFallbackLang &&
        (err === "language-not-supported" || err === "language-unavailable") &&
        this.recognition.lang !== SPEECH_RECOGNITION_FALLBACK
      ) {
        this.usedFallbackLang = true;
        console.warn(`Speech language ${this.recognition.lang} unsupported — falling back to ${SPEECH_RECOGNITION_FALLBACK}`);
        this.recognition.lang = SPEECH_RECOGNITION_FALLBACK;
        try {
          this.recognition.stop();
        } catch {}
        try {
          this.recognition.start();
        } catch {}
        return;
      }

      if (onError) onError(err);
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (restartErr) {
          console.warn("Failed to restart speech recognition:", restartErr);
        }
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      this.isListening = false;
      if (onError) onError("failed-to-start");
    }
  }

  public stopSTT() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.onresult = null;
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.stop();
      } catch {}
    }
  }

  /** Recreate SpeechRecognition instance to fix stale sessions after close/reopen */
  public resetRecognition() {
    this.stopSTT();
    this.recognition = createRecognitionInstance();
  }

  public speak(text: string, onStart?: () => void, onEnd?: () => void) {
    if (!this.synthesis) return;
    this.cancelSpeak();

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance.onstart = () => {
      if (onStart) onStart();
    };
    this.currentUtterance.onend = () => {
      if (onEnd) onEnd();
    };
    this.currentUtterance.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent)?.error;
      if (err !== "interrupted" && err !== "canceled") {
        console.error("Browser TTS error:", e);
      }
      if (onEnd) onEnd();
    };

    this.synthesis.speak(this.currentUtterance);
  }

  public cancelSpeak() {
    if (this.synthesis) {
      try {
        this.synthesis.cancel();
      } catch {}
    }
  }

  public isSupported(): boolean {
    return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
  }
}

export const browserVoiceProvider = new BrowserVoiceProvider();
