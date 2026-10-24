import type { ReactNode } from "react";

/** Large Plus Jakarta Sans 800 number in ink, with an optional small label above. */
export default function HeroNumber({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="inline-block">
      {label ? (
        <div className="mb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{label}</div>
      ) : null}
      <div className="font-display text-[clamp(44px,5.2vw,72px)] leading-none text-ink">{children}</div>
    </div>
  );
}
