export const API_PRESETS = ["anthropic-messages", "openai-chat", "openai-responses", "google-gemini"];

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"];

export function splitSelector(selector: string): [string, string] {
  const i = selector.lastIndexOf(":");
  if (i > 0 && THINKING_LEVELS.includes(selector.slice(i + 1))) return [selector.slice(0, i), selector.slice(i + 1)];
  return [selector, ""];
}

export function joinSelector(model: string, level: string): string {
  return level ? `${model}:${level}` : model;
}
