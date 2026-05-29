export interface AppAction {
  name: string;
  handler: (payload?: any) => void;
}

class ActionRegistry {
  private actions: Map<string, AppAction> = new Map();

  public register(action: AppAction) {
    this.actions.set(action.name, action);
    console.log(`[ActionRegistry] Registered action: ${action.name}`);
  }

  public get(name: string): AppAction | undefined {
    return this.actions.get(name);
  }

  public getAllNames(): string[] {
    return Array.from(this.actions.keys());
  }
}

export const actionRegistry = new ActionRegistry();
