export default function SampleBadge({ label = "Sample" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-[10px] border-[1.5px] border-line-strong px-[9px] text-[10.5px] font-extrabold uppercase leading-[18px] tracking-[0.06em] text-muted">
      {label}
    </span>
  );
}
