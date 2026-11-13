import {
  Children,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Inbox, Loader2, Search, X } from "lucide-react";

import { cn } from "../../lib/cn";
import { useApp } from "../../hooks/useApp";
import { useRipple } from "../../lib/ripple";

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
  const { ripple, rippleTarget } = useRipple();
  return (
    <button
      ref={rippleTarget as React.Ref<HTMLButtonElement>}
      type="button"
      onPointerDown={(e) => {
        ripple(e);
        rest.onPointerDown?.(e);
      }}
      className={cn(
        "relative isolate overflow-hidden",
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
  const { ripple, rippleTarget } = useRipple();
  return (
    <button
      ref={rippleTarget as React.Ref<HTMLButtonElement>}
      type="button"
      title={label}
      aria-label={label}
      data-active={active}
      onPointerDown={(e) => {
        ripple(e);
        rest.onPointerDown?.(e);
      }}
      className={cn(
        "relative isolate overflow-hidden",
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

/*
 * Outlined control.
 *
 * A filled field was invisible here: its fill was `surface-container`
 * (#ecedf4) on a `surface` (#f8f9ff) page, a 1.11:1 contrast ratio — the field
 * read as a barely-there smudge. M3's own filled variant is not much better on
 * this palette (`surface-container-highest` is 1.23:1), so the boundary has to
 * be drawn rather than implied by tone. A real outline at `outline` (1.9:1 or
 * better against every surface role) plus an accent ring on focus is legible
 * in both tones and does not depend on the palette's luck.
 */
const CONTROL_BASE =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-transparent " +
  "text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] " +
  "transition-[border-color,box-shadow,background-color] duration-[var(--dur-short)] " +
  "hover:border-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:outline-none " +
  "focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent)_24%,transparent)] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className = "", mono, ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={cn(CONTROL_BASE, "h-10 px-3.5", mono && "font-mono", className)} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_BASE, "min-h-[88px] resize-y px-3 py-2.5", className)} {...rest} />;
}

/**
 * M3 select: a filled anchor that opens a menu surface.
 *
 * The native `<select>` popup is drawn by the OS/GTK, so it ignores every token
 * and looks foreign next to the rest of the UI. This keeps the `<option>`
 * children API (so call sites are unchanged) but renders the list itself as an
 * M3 menu with a state layer, and anchors the menu to the trigger.
 */
export function Select({ className = "", children, value, onChange, disabled, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = Children.toArray(children)
    .filter(isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>)
    .map((child) => ({
      value: String(child.props.value ?? ""),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    }));
  const current = options.find((o) => o.value === String(value ?? ""));
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, top: 0, width: 0 });

  const toggle = () => {
    if (disabled) return;
    const r = anchor.current?.getBoundingClientRect();
    if (r) {
      // Flip above the trigger when there is not enough room below.
      const below = window.innerHeight - r.bottom;
      const estimated = Math.min(options.length * 40 + 12, 320);
      const top = below < estimated && r.top > below ? r.top - estimated - 6 : r.bottom + 6;
      setPlacement({ left: r.left, top, width: r.width });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled as boolean}
        onClick={toggle}
        className={cn(
          CONTROL_BASE,
          "flex h-10 cursor-pointer items-center gap-2 px-3 text-left disabled:cursor-not-allowed",
          className,
        )}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? <span className="opacity-50">—</span>}</span>
        <ChevronDown size={16} strokeWidth={2.3} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <MenuPopup
          anchor={anchor.current}
          left={placement.left}
          top={placement.top}
          width={placement.width}
          items={options.map((o) => ({
            value: o.value,
            label: o.label,
            selected: o.value === String(value ?? ""),
            disabled: o.disabled,
          }))}
          onSelect={(v) => {
            setOpen(false);
            anchor.current?.focus();
            onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>);
          }}
          onClose={() => {
            setOpen(false);
            anchor.current?.focus();
          }}
        />
      )}
    </>
  );
}

/** M3 menu surface, positioned in viewport coordinates. */
function MenuPopup({
  anchor,
  left,
  top,
  width,
  items,
  onSelect,
  onClose,
}: {
  anchor: HTMLElement | null;
  left: number;
  top: number;
  width: number;
  items: { value: string; label: ReactNode; selected: boolean; disabled: boolean }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() => Math.max(0, items.findIndex((i) => i.selected)));

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      const target = e.target as Element;
      if (ref.current?.contains(target)) return;
      // The click that opened this menu lands on its own trigger: ignore it,
      // but a *different* trigger must close this one before opening its own.
      if (anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => {
          let next = i;
          for (let n = 0; n < items.length; n++) {
            next = (next + step + items.length) % items.length;
            if (!items[next].disabled) break;
          }
          return next;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        const item = items[active];
        if (item && !item.disabled) {
          e.preventDefault();
          onSelect(item.value);
        }
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    // Viewport coordinates go stale as soon as anything scrolls or resizes, so
    // the menu closes instead of drifting away from its trigger. Attached one
    // frame late: focusing the menu can itself scroll it into view.
    const frame = requestAnimationFrame(() => {
      window.addEventListener("resize", onClose);
      window.addEventListener("scroll", onClose, true);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [anchor, items, active, onSelect, onClose]);

  return (
    <div
      ref={ref}
      role="listbox"
      tabIndex={-1}
      style={{ left, top, minWidth: Math.max(width, 168) }}
      className="menu-in fixed z-[60] max-h-[320px] overflow-y-auto rounded-[var(--radius-sm)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-lg)] outline-none"
    >
      {items.map((item, i) => (
        <button
          key={`${item.value}-${i}`}
          type="button"
          role="option"
          aria-selected={item.selected}
          disabled={item.disabled}
          onMouseEnter={() => setActive(i)}
          onClick={() => onSelect(item.value)}
          className={cn(
            "flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-[13px] transition-colors duration-[var(--dur-short)]",
            item.disabled && "cursor-not-allowed opacity-40",
            i === active && !item.disabled && "bg-[var(--color-hover)]",
            item.selected ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]",
          )}
        >
          <span className="flex w-4 shrink-0 justify-center">
            {item.selected && <Check size={15} strokeWidth={2.6} strokeLinecap="round" />}
          </span>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
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
  const { ripple, rippleTarget } = useRipple();
  return (
    <button
      ref={rippleTarget as React.Ref<HTMLButtonElement>}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={ripple}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative isolate inline-flex h-7 w-12 shrink-0 items-center overflow-hidden rounded-full",
        "transition-[background-color] duration-[var(--dur-medium)] ease-[var(--ease-emphasized)]",
        // M3 2024: unselected track is a filled surface role with an outline,
        // not a heavy 2px border; selected fills and drops the outline.
        checked
          ? "bg-[var(--color-accent)]"
          : "bg-[var(--color-surface-2)] outline outline-1 -outline-offset-1 outline-[var(--color-border-strong)]",
        disabled && "cursor-not-allowed opacity-38",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-full",
          "transition-[transform,width,height,background-color] duration-[var(--dur-medium)] ease-[var(--ease-emphasized)]",
          checked
            ? "h-5 w-5 translate-x-[25px] bg-[var(--color-accent-fg)]"
            : "h-4 w-4 translate-x-[15px] bg-[var(--color-fg-subtle)]",
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
  const { ripple, rippleTarget } = useRipple();
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-[var(--color-fg)]",
        disabled && "cursor-not-allowed opacity-38",
      )}
    >
      <span
        ref={rippleTarget as React.Ref<HTMLSpanElement>}
        onPointerDown={ripple}
        className="relative isolate flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
      >
        <span
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center transition-[background-color,border-color] duration-[var(--dur-short)]",
            checked
              ? "rounded-[4px] bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
              : "rounded-[3px] border-2 border-[var(--color-border-strong)] bg-transparent",
          )}
        >
          {checked && <Check size={13} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />}
        </span>
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
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
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
