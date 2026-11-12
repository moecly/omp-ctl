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
import { Check, Inbox, Loader2, Search, X } from "lucide-react";

import { cn } from "../../lib/cn";
import { useApp } from "../../hooks/useApp";

/*
 * Material Design 3 primitives.
 *
 * Every icon here is drawn with `strokeWidth >= 2` and `strokeLinecap`/`Join`
 * set to round, which is what makes the icon set read as M3 rather than as a
 * thin outline set. Shape follows the M3 scale: full radius for buttons and
 * chips, 12–16px for containers, 28px for dialogs.
 */

type Variant = "default" | "primary" | "danger" | "ghost" | "tonal" | "filled";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const BUTTON_VARIANT: Record<Variant, string> = {
  default:
    "border border-[var(--color-border-strong)] bg-transparent text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
  primary:
    "bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:brightness-105",
  tonal:
    "bg-[var(--color-accent-soft)] text-[var(--m3-on-primary-container)] hover:brightness-[0.97]",
  filled: "bg-[var(--color-active)] text-[var(--color-fg)] hover:brightness-[0.97]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] hover:brightness-[0.97]",
  ghost:
    "text-[var(--color-fg-muted)] hover:bg-[color-mix(in_srgb,var(--color-fg)_8%,transparent)] hover:text-[var(--color-fg)]",
};

const BUTTON_SIZE = {
  sm: "h-8 px-3 text-[12px] gap-1.5",
  md: "h-10 px-4 text-[13px] gap-2",
  lg: "h-12 px-6 text-[14px] gap-2",
};

export function Button({ variant = "default", size = "md", className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium",
        "transition-[background-color,box-shadow,transform,filter] duration-[var(--dur-short)]",
        "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        BUTTON_SIZE[size],
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

export function IconButton({ active, label, className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      data-active={active}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-fg-muted)]",
        "transition-[background-color,color,transform] duration-[var(--dur-short)]",
        "hover:bg-[color-mix(in_srgb,var(--color-fg)_8%,transparent)] hover:text-[var(--color-fg)]",
        "active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40",
        active && "bg-[var(--color-active)] text-[var(--color-fg)]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
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
      {label && (
        <span className="text-[12px] font-medium tracking-[0.01em] text-[var(--color-fg-muted)]">{label}</span>
      )}
      {children}
      {error ? (
        <span className="text-[11px] text-[var(--color-danger)]">{error}</span>
      ) : hint ? (
        <span className="text-[11px] leading-snug text-[var(--color-fg-subtle)]">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL_BASE =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] transition-[border-color,box-shadow,background-color] duration-[var(--dur-short)] focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className = "", mono, ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={cn(CONTROL_BASE, "h-10 px-3", mono && "font-mono", className)} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_BASE, "min-h-[88px] resize-y px-3 py-2.5", className)} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL_BASE, "h-10 cursor-pointer px-3", className)} {...rest}>
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
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-[background-color,border-color] duration-[var(--dur-medium)]",
        checked
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface-2)]",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "block rounded-full transition-[transform,width,height,background-color] duration-[var(--dur-medium)]",
          "ease-[var(--ease-emphasized)]",
          checked
            ? "h-5 w-5 translate-x-[24px] bg-[var(--color-accent-fg)]"
            : "h-3 w-3 translate-x-[5px] bg-[var(--color-fg-muted)]",
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
  children?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-[var(--color-fg)]",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-[background-color,border-color] duration-[var(--dur-short)]",
          checked
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
            : "border-[var(--color-border-strong)] bg-transparent",
        )}
      >
        {checked && <Check size={14} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
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
    <div className="inline-flex rounded-full border border-[var(--color-border-strong)] p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={cn(
            "h-8 rounded-full px-3.5 text-[12px] font-medium transition-colors duration-[var(--dur-short)]",
            o.value === value
              ? "bg-[var(--color-accent-soft)] text-[var(--m3-on-primary-container)]"
              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]",
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
  neutral: "border-[var(--color-border-strong)] text-[var(--color-fg-muted)]",
  ok: "border-transparent bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]",
  warn: "border-transparent bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  danger: "border-transparent bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  accent: "border-transparent bg-[var(--color-accent-soft)] text-[var(--m3-on-primary-container)]",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-medium",
        BADGE_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-6 items-center justify-center rounded-[6px] border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-1 font-mono text-[11px] text-[var(--color-fg-muted)]">
      {children}
    </kbd>
  );
}

export function Spinner() {
  return (
    <Loader2
      size={16}
      strokeWidth={2.5}
      className="animate-spin text-[var(--color-fg-subtle)]"
      role="status"
    />
  );
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
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--m3-inverse-surface)] px-2.5 py-1.5 text-[11px] text-[var(--m3-on-inverse-surface)] shadow-[var(--shadow-md)] group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-[var(--color-fg-subtle)]">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-2)]">
        <Inbox size={24} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-70" />
      </span>
      <div className="text-[14px] font-medium text-[var(--color-fg-muted)]">{title}</div>
      {desc && <div className="max-w-[360px] text-[12px] leading-relaxed">{desc}</div>}
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
        "flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-[12px]",
        tone === "warn"
          ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
          : "bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)]",
      )}
    >
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
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
    <section className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            {title && <div className="text-[14px] font-medium text-[var(--color-fg)]">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[12px] text-[var(--color-fg-subtle)]">{subtitle}</div>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "px-5 pb-5"}>{children}</div>
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
        size={16}
        strokeWidth={2.2}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fg-subtle)]"
      />
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
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
              "relative px-3 py-2.5 text-[13px] font-medium transition-colors duration-[var(--dur-short)]",
              isActive ? "text-[var(--color-accent)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-full bg-[var(--color-accent)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-2 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <div className="text-[var(--color-fg-subtle)]">{k}</div>
          <div className="min-w-0 break-words">{v}</div>
        </div>
      ))}
    </div>
  );
}

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
  const { t } = useApp();
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
    <div
      className="scrim-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        className={cn(
          "dialog-in flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]",
          wide ? "max-w-[760px]" : "max-w-[480px]",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-5">
          <span className="text-[17px] font-medium text-[var(--color-fg)]">{title}</span>
          <IconButton label={t.common.close} onClick={onClose}>
            <X size={18} strokeWidth={2.4} strokeLinecap="round" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-4">{footer}</div>}
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
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="pb-2 text-[14px] leading-relaxed text-[var(--color-fg-muted)]">{message}</p>
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
      className="dialog-in fixed z-50 min-w-[168px] rounded-[var(--radius-md)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-lg)]"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={cn(
            "block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] transition-colors duration-[var(--dur-short)] hover:bg-[var(--color-hover)]",
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
  const height = rows * 21 + 20;

  useEffect(() => {
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  }, [scrollTop]);

  return (
    <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] font-mono text-[var(--text-sm)] leading-[1.7]">
      <div
        ref={gutterRef}
        className="w-11 shrink-0 select-none overflow-hidden border-r border-[var(--color-border)] pr-3 pt-2.5 text-right text-[var(--color-fg-subtle)]"
        style={{ height }}
      >
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        className="flex-1 resize-none border-0 bg-transparent p-2.5 text-[var(--color-fg)] outline-none"
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
