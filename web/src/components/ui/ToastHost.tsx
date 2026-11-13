import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { dismiss, subscribe, type Toast, type ToastKind } from "../../lib/toast";
import { useApp } from "../../hooks/useApp";
import { cn } from "../../lib/cn";

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

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Snackbars.
 *
 * The store owns which toasts are live; this host keeps a second list of the
 * ones it removed in order to play their exit animation. Rendering straight
 * from the store would unmount them on the same frame the close happened, so
 * the exit never ran — and under reduced motion there is no animation event to
 * wait for, so the entry is dropped immediately.
 */
export function ToastHost() {
  const { t } = useApp();
  const [items, setItems] = useState<Toast[]>([]);
  const [leaving, setLeaving] = useState<Toast[]>([]);

  useEffect(
    () =>
      subscribe((next) => {
        setItems((prev) => {
          const gone = prev.filter((p) => !next.some((n) => n.id === p.id));
          if (gone.length === 0) return next;
          if (!reducedMotion()) setLeaving((l) => [...l, ...gone.filter((g) => !l.some((x) => x.id === g.id))]);
          return next;
        });
      }),
    [],
  );

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2">
      {[...leaving, ...items].map((toast) => {
        const tone = TONE[toast.kind];
        const isLeaving = leaving.some((l) => l.id === toast.id);
        return (
          <div
            key={toast.id}
            role="status"
            onAnimationEnd={(e) => {
              if (e.animationName !== "toast-out") return;
              setLeaving((l) => l.filter((x) => x.id !== toast.id));
            }}
            className={cn(
              "pointer-events-auto flex w-fit min-w-[288px] max-w-[420px] items-start gap-3 rounded-[var(--radius-sm)] px-4 py-3.5 shadow-[var(--shadow-md)]",
              tone.container,
              isLeaving ? "toast-out" : "toast-in",
            )}
          >
            <span className="mt-px shrink-0">{tone.icon}</span>
            <div className="min-w-0 flex-1">
              {toast.title && <div className="text-[13px] font-medium leading-5">{toast.title}</div>}
              {toast.detail && (
                <div className="mt-0.5 break-words text-[12px] leading-5 opacity-80">{toast.detail}</div>
              )}
            </div>
            <button
              type="button"
              aria-label={t.common.close}
              className="-mr-1 shrink-0 rounded-full p-1.5 opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100"
              onClick={() => dismiss(toast.id)}
            >
              <X size={15} strokeWidth={2.4} strokeLinecap="round" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
