"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import FreshnessChip from "./FreshnessChip";
import { buttonClass } from "./Button";

const TABS = [
  { href: "/summary", label: "Summary" },
  { href: "/compare", label: "Compare" },
  { href: "/swap", label: "Swap" },
  { href: "/join", label: "Join" },
] as const;

const DRIPS = [
  { left: "6%", w: 7, h: 10 },
  { left: "23%", w: 6, h: 14 },
  { left: "48%", w: 8, h: 8 },
  { left: "71%", w: 6, h: 12 },
  { left: "90%", w: 7, h: 7 },
];

interface HeaderProps {
  status?: "live" | "cached";
  nadacDate?: string;
  shortagesDate?: string;
}
export default function Header({ status = "live", nadacDate = "latest", shortagesDate = "today" }: HeaderProps) {
  const pathname = usePathname() ?? "";
  return (
    <header className="relative z-40 border-b-[5px] border-accent bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
        <Link
          href="/summary"
          className="font-display text-[28px] uppercase leading-none tracking-[0.03em] text-ink no-underline hover:text-ink"
        >
          Pharma<span className="text-accent">Pool</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-[14.5px] font-extrabold no-underline ${
                  active
                    ? "bg-accent-soft text-ink shadow-[inset_0_-3px_0_var(--accent)] hover:text-ink"
                    : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <FreshnessChip status={status} nadacDate={nadacDate} shortagesDate={shortagesDate} />
          <Link href="/upload" className={buttonClass("primary", true)}>
            Upload data
          </Link>
          <Link href="/sources" className="text-[13.5px] font-bold">
            Data sources
          </Link>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-0">
        {DRIPS.map((d, i) => (
          <span
            key={i}
            className="absolute top-0 rounded-b-full bg-accent"
            style={{ left: d.left, width: d.w, height: d.h }}
          />
        ))}
      </div>
    </header>
  );
}
