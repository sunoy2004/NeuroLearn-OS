/** Trim trailing slash from API roots */
function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** Resolve HTTP(S) base URL from env with localhost fallback */
function resolveHttpBase(envValue: string | undefined, fallback: string): string {
  return trimSlash(envValue?.trim() || fallback);
}

export const API_BASE = resolveHttpBase(
  import.meta.env.VITE_API_BASE,
  "http://localhost:8000"
);

export const AGENT_API_BASE = resolveHttpBase(
  import.meta.env.VITE_AGENT_API_BASE,
  "http://localhost:8001"
);

/** Backend voice WebSocket (legacy hook) */
export const WS_BASE = resolveHttpBase(
  import.meta.env.VITE_WS_BASE,
  "http://localhost:8000"
);

/** Build agent WebSocket URL — supports ws/wss/https/http env values */
export function getAgentWebSocketUrl(): string {
  const raw =
    import.meta.env.VITE_AGENT_WS_BASE?.trim() ||
    import.meta.env.VITE_AGENT_API_BASE?.trim() ||
    "http://localhost:8001";

  if (raw.startsWith("ws://") || raw.startsWith("wss://")) {
    return `${trimSlash(raw)}/ws/agent-stream`;
  }

  const wsBase = raw.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  return `${trimSlash(wsBase)}/ws/agent-stream`;
}

/** Build backend voice WebSocket URL */
export function getBackendVoiceWebSocketUrl(): string {
  const raw = import.meta.env.VITE_WS_BASE?.trim() || import.meta.env.VITE_API_BASE?.trim() || "http://localhost:8000";

  if (raw.startsWith("ws://") || raw.startsWith("wss://")) {
    return `${trimSlash(raw)}/api/voice/ws/voice-stream`;
  }

  const wsBase = raw.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  return `${trimSlash(wsBase)}/api/voice/ws/voice-stream`;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `HTTP error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function uploadFile<T = unknown>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = `HTTP error: ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail || body.message || message;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
