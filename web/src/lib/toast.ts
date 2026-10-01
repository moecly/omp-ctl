export type ToastKind = "info" | "success" | "warn" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

type Listener = (toasts: Toast[]) => void;

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  fn(toasts);
  return () => listeners.delete(fn);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function push(kind: ToastKind, title: string, detail?: string, ms = 4500) {
  const id = nextId++;
  toasts = [...toasts, { id, kind, title, detail }];
  emit();
  if (ms > 0) setTimeout(() => dismiss(id), ms);
  return id;
}

export const toast = {
  info: (t: string, d?: string) => push("info", t, d),
  success: (t: string, d?: string) => push("success", t, d),
  warn: (t: string, d?: string) => push("warn", t, d),
  error: (t: string, d?: string) => push("error", t, d, 8000),
};
