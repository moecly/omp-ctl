import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift"]);

const NAMED: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

function keyName(key: string): string {
  if (NAMED[key]) return NAMED[key];
  if (/^F([1-9]|1\d|2[0-4])$/.test(key)) return key;
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function chordFromEvent(e: Pick<
  ReactKeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Cmd");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(keyName(e.key));
  return parts.join("+");
}
