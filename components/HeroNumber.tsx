import type { ReactNode } from "react";

/** Black Anton number with a 10px orange bar and 3 drips underneath. */
export default function HeroNumber({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="inline-block">
      {label ? (
        <div className="mb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{label}</div>
      ) : null}
      <div className="font-display text-[clamp(54px,6.4vw,96px)] uppercase leading-none tracking-[0.01em] text-ink">
        {children}
      </div>
      <div className="relative mt-2 h-[10px] rounded-full bg-accent" aria-hidden>
        <span className="absolute left-[12%] top-full h-3 w-[7px] rounded-b-full bg-accent" />
        <span className="absolute left-[47%] top-full h-[18px] w-[6px] rounded-b-full bg-accent" />
        <span className="absolute left-[81%] top-full h-[9px] w-[8px] rounded-b-full bg-accent" />
      </div>
      <div className="h-5" aria-hidden />
    </div>
  );
}
