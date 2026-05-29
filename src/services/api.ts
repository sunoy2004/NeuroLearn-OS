export const API_BASE = "http://localhost:8000";
export const WS_BASE = "ws://localhost:8000";
export const AGENT_WS_BASE = "ws://localhost:8001";


export async function apiRequest<T = any>(
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
