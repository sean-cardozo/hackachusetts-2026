import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  badge?: ReactNode;
  emphasis?: boolean;
}

export default function StatCard({ label, value, sub, badge, emphasis }: StatCardProps) {
  return (
    <div className={`${emphasis ? "card-strong" : "card"} flex flex-col gap-1 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{label}</span>
        {badge}
      </div>
      <div className="font-display text-[34px] leading-none">{value}</div>
      {sub ? <div className="text-[12.5px] text-muted">{sub}</div> : null}
    </div>
  );
}
