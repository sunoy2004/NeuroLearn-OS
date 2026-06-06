/** True for phones/tablets — used for voice UX (push-to-talk, no auto-resume). */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const narrowViewport =
    typeof window !== "undefined" &&
    window.matchMedia?.("(max-width: 768px)")?.matches === true;
  return mobileUa || narrowViewport;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** iOS Safari/Chrome lack reliable continuous SpeechRecognition — prefer MediaRecorder + server STT. */
export function supportsBrowserSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  const hasApi = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  if (!hasApi) return false;
  if (isIOS()) return false;
  return true;
}
