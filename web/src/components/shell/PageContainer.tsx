import { type ReactNode } from "react";

export function PageContainer({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--color-fg)]">{title}</h1>
            {description && <p className="mt-0.5 text-[12px] text-[var(--color-fg-subtle)]">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
