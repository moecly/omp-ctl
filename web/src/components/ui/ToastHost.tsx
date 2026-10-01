import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { dismiss, subscribe, type Toast, type ToastKind } from "../../lib/toast";
import { cn } from "../../lib/cn";

const BAR: Record<ToastKind, string> = {
  info: "bg-[var(--color-fg-subtle)]",
  success: "bg-[var(--color-success)]",
  warn: "bg-[var(--color-warning)]",
  error: "bg-[var(--color-danger)]",
};

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => subscribe(setItems), []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="pointer-events-auto flex min-w-[280px] max-w-[380px] items-start gap-2.5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] py-2.5 pl-3 pr-2 shadow-[var(--shadow-md)]"
        >
          <span className={cn("mt-0.5 h-4 w-0.5 shrink-0 rounded-full", BAR[t.kind])} />
          <div className="min-w-0 flex-1">
            {t.title && <div className="text-[13px] font-medium text-[var(--color-fg)]">{t.title}</div>}
            {t.detail && <div className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">{t.detail}</div>}
          </div>
          <button
            type="button"
            aria-label="dismiss"
            className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            onClick={() => dismiss(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
