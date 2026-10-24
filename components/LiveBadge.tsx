export default function LiveBadge({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-accent px-[9px] text-[10.5px] font-extrabold uppercase leading-[18px] tracking-[0.06em] text-accent-ink">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
      {label}
    </span>
  );
}
