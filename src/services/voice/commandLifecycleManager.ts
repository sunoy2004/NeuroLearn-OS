import { persistentVoiceSessionManager } from "./sessionManager";
import { useAppStore } from "@/store/appStore";

export class CommandLifecycleManager {
  private stopCommands = [
    "stop voice companion",
    "stop listening",
    "disable assistant",
    "end voice mode",
    "close companion",
    "shut down companion",
    "stop companion"
  ];

  public isStopCommand(text: string): boolean {
    if (!text) return false;
    const cleanText = text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    return this.stopCommands.some(cmd => cleanText.includes(cmd));
  }

  /** Soft close — UI mic toggle. Keeps WebSocket alive for unlimited reopen cycles. */
  public executeStop() {
    console.log("[CommandLifecycleManager] Soft-closing companion.");
    useAppStore.getState().setCompanionExpanded(false);
    persistentVoiceSessionManager.closeSession();
  }

  /** Hard shutdown — voice command triggered. Closes WebSocket entirely. */
  public executeHardStop() {
    console.log("[CommandLifecycleManager] Hard shutdown of voice session.");
    useAppStore.getState().setCompanionExpanded(false);
    persistentVoiceSessionManager.terminateSession();
  }
}

export const commandLifecycleManager = new CommandLifecycleManager();
