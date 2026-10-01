export interface Hotkey {
  id: string;
  keys: string;
  description: string;
  run: () => void;
}

const registry = new Map<string, Hotkey>();

export function register(hotkey: Hotkey): () => void {
  registry.set(hotkey.id, hotkey);
  return () => registry.delete(hotkey.id);
}

export function list(): Hotkey[] {
  return [...registry.values()];
}

function normalize(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  const key = e.key.toLowerCase();
  if (!["control", "meta", "alt", "shift"].includes(key)) parts.push(key);
  return parts.join("+");
}

export function install(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const combo = normalize(e);
    for (const hk of registry.values()) {
      if (hk.keys === combo) {
        e.preventDefault();
        hk.run();
        return;
      }
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
