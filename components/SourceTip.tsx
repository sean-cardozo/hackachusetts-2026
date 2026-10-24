import type { ReactNode } from "react";
import { useId } from "react";

interface SourceTipProps {
  source: string;
  date?: string;
  children: ReactNode;
}

/** Shows source + effective date on hover and keyboard focus (CSS only, no client JS). */
export default function SourceTip({ source, date, children }: SourceTipProps) {
  const id = useId();
  return (
    <span className="group relative inline-block">
      <span
        tabIndex={0}
        aria-describedby={id}
        className="cursor-help border-b border-dotted border-line-strong"
      >
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-2 w-max max-w-[260px] rounded-[10px] bg-ink px-3 py-2 text-[12px] font-semibold leading-snug text-bg opacity-0 shadow-pp transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {source}
        {date ? ` · as of ${date}` : ""}
      </span>
    </span>
  );
}
