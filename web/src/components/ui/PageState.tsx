import { useApp } from "../../hooks/useApp";
import { Banner, Button, Skeleton } from "./index";

export function PageSkeleton({ rows = 3, rowHeight = 44 }: { rows?: number; rowHeight?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={rowHeight} />
      ))}
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useApp();
  return (
    <Banner
      tone="warn"
      action={
        onRetry && (
          <Button size="sm" onClick={onRetry}>
            {t.common.retry}
          </Button>
        )
      }
    >
      {message}
    </Banner>
  );
}
