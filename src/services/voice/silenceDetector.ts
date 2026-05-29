export class SilenceDetector {
  private timeoutId: any = null;
  private silenceTimeout: number;
  private onSilenceCallback: () => void;

  constructor(onSilence: () => void, timeoutMs: number = 2500) {
    this.onSilenceCallback = onSilence;
    this.silenceTimeout = timeoutMs;
  }

  /**
   * Resets the silence timer. Call this whenever speech is active.
   */
  public reset() {
    this.cancel();
    this.timeoutId = setTimeout(() => {
      this.onSilenceCallback();
    }, this.silenceTimeout);
  }

  /**
   * Cancels any pending silence trigger.
   */
  public cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
