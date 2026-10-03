export const API_PRESETS = ["anthropic-messages", "openai-completions", "openai-responses", "openai-codex-responses", "azure-openai-responses", "bedrock-converse-stream", "google-generative-ai", "google-gemini-cli", "google-vertex", "openrouter-decisions", "typesafe"];

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"];

export function splitSelector(selector: string): [string, string] {
  const i = selector.lastIndexOf(":");
  if (i > 0 && THINKING_LEVELS.includes(selector.slice(i + 1))) return [selector.slice(0, i), selector.slice(i + 1)];
  return [selector, ""];
}

export function joinSelector(model: string, level: string): string {
  return level ? `${model}:${level}` : model;
}
