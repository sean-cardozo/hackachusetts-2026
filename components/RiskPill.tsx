export type Risk = "High" | "Watch" | "Low";

const STYLE: Record<Risk, { cls: string; icon: string }> = {
  High: { cls: "bg-bad-soft text-bad", icon: "⚠" },
  Watch: { cls: "bg-accent-soft text-accent-ink", icon: "●" },
  Low: { cls: "bg-good-soft text-good", icon: "✓" },
};

export default function RiskPill({ risk }: { risk: Risk }) {
  const s = STYLE[risk];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ${s.cls}`}
    >
      <span aria-hidden>{s.icon}</span>
      {risk}
    </span>
  );
}
