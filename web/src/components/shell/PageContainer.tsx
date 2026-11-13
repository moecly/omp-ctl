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
  // `scrollbar-gutter: stable` reserves the scrollbar width up front. Without it
  // the content reflows by ~10px whenever the scrollbar appears or disappears
  // (switching pages, expanding a card), which reads as the layout jumping.
  return (
    <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-medium leading-tight tracking-[-0.015em] text-[var(--color-fg)]">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-fg-subtle)]">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
