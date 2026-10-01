import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Inbox,
  Loader2,
  Search,
  X,
  Check,
} from "lucide-react";

import { cn } from "../../lib/cn";
import { useApp } from "../../hooks/useApp";

type Variant = "default" | "primary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const BUTTON_VARIANT: Record<Variant, string> = {
  default:
    "border border-[var(--color-border)] bg-transparent text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]",
  primary: "bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]",
  danger: "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]",
  ghost: "text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]",
};

const BUTTON_SIZE = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3 text-[13px]",
  lg: "h-9 px-4 text-[13px]",
};

export function Button({ variant = "default", size = "md", className = "", ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] font-medium",
        "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]",
        BUTTON_SIZE[size],
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

export function IconButton({ active, label, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      data-active={active}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-muted)]",
        "hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)] active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active && "bg-[var(--color-active)] text-[var(--color-fg)]",
        className,
      )}
      {...rest}
    />
  );
}

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-[12px] text-[var(--color-fg-muted)]">{label}</span>}
      {children}
      {error ? (
        <span className="text-[11px] text-[var(--color-danger)]">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-[var(--color-fg-subtle)]">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL_BASE =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className = "", mono, ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={cn(CONTROL_BASE, "h-8 px-2.5", mono && "font-mono", className)} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_BASE, "min-h-[80px] resize-y px-2.5 py-2", className)} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL_BASE, "h-8 cursor-pointer px-2.5", className)} {...rest}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full bg-[var(--color-accent-fg)] shadow-[var(--shadow-sm)] transition-transform duration-150",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-[var(--color-fg)]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
          checked
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
            : "border-[var(--color-border-strong)] bg-[var(--color-surface-2)]",
        )}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={cn(
            "h-6 rounded-[var(--radius-sm)] px-2.5 text-[12px] font-medium",
            o.value === value
              ? "bg-[var(--color-surface)] text-[var(--color-fg)] shadow-[var(--shadow-sm)]"
              : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]",
          )}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "accent";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "border-[var(--color-border)] text-[var(--color-fg-muted)]",
  ok: "border-[var(--color-success)]/25 bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warn: "border-[var(--color-warning)]/25 bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  danger: "border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  accent: "border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-[var(--radius-sm)] border px-1.5 text-[11px] font-medium",
        BADGE_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1 font-mono text-[11px] text-[var(--color-fg-muted)]">
      {children}
    </kbd>
  );
}

export function Spinner() {
  return <Loader2 size={14} className="animate-spin text-[var(--color-fg-subtle)]" role="status" />;
}

export function Skeleton({ width = "100%", height = 14 }: { width?: number | string; height?: number | string }) {
  return (
    <span
      className="block animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-2)]"
      style={{ width, height }}
    />
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-[11px] text-[var(--color-fg)] shadow-[var(--shadow-md)] group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-[var(--color-fg-subtle)]">
      <Inbox size={22} className="opacity-60" />
      <div className="text-[13px] font-medium text-[var(--color-fg-muted)]">{title}</div>
      {desc && <div className="text-[12px]">{desc}</div>}
      {action}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "warn";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-[12px]",
        tone === "warn"
          ? "border-[var(--color-warning)]/25 bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
          : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]",
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  flush,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            {title && <div className="text-[13px] font-medium text-[var(--color-fg)]">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[12px] text-[var(--color-fg-subtle)]">{subtitle}</div>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <span className="relative block">
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]"
      />
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="pl-7"
      />
    </span>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-[var(--color-border)]" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-2.5 py-2 text-[13px]",
              isActive ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
            )}
          >
            {tab.label}
            {isActive && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-[var(--color-fg)]" />}
          </button>
        );
      })}
    </div>
  );
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <div className="text-[var(--color-fg-subtle)]">{k}</div>
          <div className="min-w-0 break-words">{v}</div>
        </div>
      ))}
    </div>
  );
}

const OVERLAY = "fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-[2px]";

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={OVERLAY} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal
        className={cn(
          "flex max-h-[85vh] w-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]",
          wide ? "max-w-[720px]" : "max-w-[480px]",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <span className="text-[15px] font-medium text-[var(--color-fg)]">{title}</span>
          <IconButton label="close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useApp();
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t.common.cancel}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-[var(--color-fg-muted)]">{message}</p>
    </Dialog>
  );
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: { label: string; danger?: boolean; onSelect: () => void }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[160px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-md)]"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={cn(
            "block w-full px-3 py-1.5 text-left text-[13px] hover:bg-[var(--color-hover)]",
            item.danger ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]",
          )}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function CodeEditor({
  value,
  onChange,
  rows = 16,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  readOnly?: boolean;
}) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.split("\n").length;
  const [scrollTop, setScrollTop] = useState(0);
  const height = rows * 20 + 16;

  useEffect(() => {
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  }, [scrollTop]);

  return (
    <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] font-mono text-[var(--text-sm)] leading-[1.6]">
      <div
        ref={gutterRef}
        className="w-10 shrink-0 select-none overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-surface)] pr-3 text-right text-[var(--color-fg-subtle)]"
        style={{ height }}
      >
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        className="flex-1 resize-none border-0 bg-[var(--color-bg)] p-2 text-[var(--color-fg)] outline-none"
        style={{ height }}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => setScrollTop((e.target as HTMLTextAreaElement).scrollTop)}
      />
    </div>
  );
}
