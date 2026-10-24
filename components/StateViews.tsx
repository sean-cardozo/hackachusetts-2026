import type { ReactNode } from "react";
import Button from "./Button";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <div className="section-title">{title}</div>
      {description ? <p className="m-0 max-w-md text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="h-16 rounded-[14px] bg-surface-2"
          style={{ animation: "ppShimmer 1.4s ease-in-out infinite" }}
        />
      ))}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-[16px] border-[1.5px] border-bad bg-bad-soft p-8 text-center"
    >
      <p className="m-0 font-bold text-bad">{message}</p>
      {onRetry ? (
        <Button variant="strong" small onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
