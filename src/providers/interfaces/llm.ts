export interface LLMProvider {
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
  stream(messages: Array<{ role: string; content: string }>): AsyncGenerator<string>;
  summarize(text: string): Promise<{ title: string; summary: string; concepts: string[] }>;
  embeddings(text: string): Promise<number[]>;
}

export interface AgentLLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  streaming: boolean;
}
