import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { dismiss, subscribe, type Toast, type ToastKind } from "../../lib/toast";
import { useApp } from "../../hooks/useApp";
import { cn } from "../../lib/cn";

/** M3 toast colouring: the icon and container carry the tone, not a side bar. */
const TONE: Record<ToastKind, { container: string; icon: React.ReactNode }> = {
  info: {
    container: "bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)]",
    icon: <Info size={18} strokeWidth={2.2} />,
  },
  success: {
    container: "bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]",
    icon: <CheckCircle2 size={18} strokeWidth={2.2} />,
  },
  warn: {
    container: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    icon: <AlertTriangle size={18} strokeWidth={2.2} />,
  },
  error: {
    container: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    icon: <XCircle size={18} strokeWidth={2.2} />,
  },
};

/**
 * Toasts with both enter and exit animation.
 *
 * `dismiss` removes the item immediately from the store, so the exit animation
 * needs a local copy that survives one frame; `leaving` holds those ids.
 */
export function ToastHost() {
  const { t } = useApp();
  const [items, setItems] = useState<Toast[]>([]);
  const [leaving, setLeaving] = useState<number[]>([]);

  useEffect(
    () =>
      subscribe((next) => {
        setItems((prev) => {
          const removed = prev.filter((p) => !next.some((n) => n.id === p.id)).map((p) => p.id);
          if (removed.length > 0) {
            setLeaving((l) => [...l, ...removed]);
            window.setTimeout(() => {
              setLeaving((l) => l.filter((id) => !removed.includes(id)));
            }, 180);
            // Keep the removed entries mounted until their animation finishes.
            return [...prev.filter((p) => removed.includes(p.id)), ...next];
          }
          return next;
        });
      }),
    [],
  );

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {items.map((toast) => {
        const tone = TONE[toast.kind];
        const isLeaving = leaving.includes(toast.id);
        return (
          <div
            key={toast.id}
            role="alert"
            className={cn(
              "pointer-events-auto flex min-w-[300px] max-w-[400px] items-start gap-3 rounded-[var(--radius-sm)] px-4 py-3 shadow-[var(--shadow-md)]",
              tone.container,
              isLeaving ? "toast-out" : "toast-in",
            )}
          >
            <span className="mt-px shrink-0">{tone.icon}</span>
            <div className="min-w-0 flex-1">
              {toast.title && <div className="text-[13px] font-medium">{toast.title}</div>}
              {toast.detail && <div className="mt-0.5 break-words text-[12px] opacity-80">{toast.detail}</div>}
            </div>
            <button
              type="button"
              aria-label={t.common.close}
              className="shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
              onClick={() => dismiss(toast.id)}
            >
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
