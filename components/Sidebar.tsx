"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STORE_KEY } from "@/lib/store";
import { PLAN_KEY } from "./PlanState";

const ICONS = {
  award: "M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 14l2 2 4-4",
  summary: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
  compare: "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",
  swap: "M17 2l4 4-4 4 M3 11v-1a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v1a4 4 0 0 1-4 4H3",
  join: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  sources:
    "M12 2c4.97 0 9 1.34 9 3s-4.03 3-9 3-9-1.34-9-3 4.03-3 9-3z M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5 M3 12c0 1.66 4 3 9 3s9-1.34 9-3",
} as const;

const TABS = [
  { href: "/summary", label: "Summary", sub: "Savings & actions", icon: ICONS.summary },
  { href: "/compare", label: "Re-negotiate", sub: "Your prices vs. NADAC", icon: ICONS.compare },
  { href: "/swap", label: "Swap", sub: "Brand to generic", icon: ICONS.swap },
  { href: "/join", label: "Join", sub: "Pool with pharmacies", icon: ICONS.join },
] as const;

const UTILS = [
  { href: "/award", label: "Award", icon: ICONS.award },
  { href: "/upload", label: "Upload data", icon: ICONS.upload },
  { href: "/sources", label: "Data sources", icon: ICONS.sources },
] as const;

const DOTS = ["#34d3a6", "#5eead4", "#34d3a6", "#5eead4", "#ffffff", "#5eead4", "#34d3a6", "#5eead4", "#34d3a6"];

function Icon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="flex-none"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

/** Clears everything the demo saved (upload, plan, swaps, rounds, award) and starts over on Summary. */
function resetDemo() {
  if (!window.confirm("Reset the demo? This clears the uploaded data and every choice you made.")) return;
  try {
    window.localStorage.removeItem(STORE_KEY);
    window.localStorage.removeItem(PLAN_KEY);
  } catch {
    // Storage blocked: nothing was saved, so the reload alone starts over.
  }
  window.location.assign("/summary");
}

function itemClass(active: boolean) {
  return `flex w-full items-center gap-3 rounded-[10px] border-l-[3px] px-3 py-2.5 text-left no-underline transition-transform active:scale-95 ${
    active
      ? "border-[#34d3a6] bg-[#18426b] text-white hover:text-white"
      : "border-transparent text-[#c3d0df] hover:bg-white/5 hover:text-white"
  }`;
}

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <aside className="z-40 flex flex-col gap-[22px] bg-navy px-[14px] py-[22px] text-[#dbe5f0] md:fixed md:inset-y-0 md:left-0 md:w-[232px] md:overflow-y-auto">
      <Link href="/summary" className="flex flex-col gap-2.5 px-2 no-underline hover:text-white">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="grid grid-cols-[repeat(3,7px)] gap-[3px]">
            {DOTS.map((c, i) => (
              <span key={i} className="h-[7px] w-[7px] rounded-full" style={{ background: c }} />
            ))}
          </span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em] text-white">PharmaPool</span>
        </span>
        <span className="text-[13px] leading-[1.4] text-[#b7c6d8]">
          Collective purchasing for independent pharmacies.
        </span>
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
              <Icon d={t.icon} />
              <span className="flex flex-col leading-[1.2]">
                <span className="text-[14.5px] font-bold">{t.label}</span>
                <span className="whitespace-nowrap text-[11.5px] opacity-75">{t.sub}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div aria-hidden className="mx-2 h-px bg-white/[0.12]" />
      <nav aria-label="Data" className="flex flex-col gap-1">
        {UTILS.map((t) => {
          const active = isActive(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
              <Icon d={t.icon} />
              <span className="flex-1 text-[14px] font-semibold">{t.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="hidden flex-1 md:block" />
      <div className="hidden flex-col gap-1.5 rounded-[14px] bg-white/[0.07] p-4 md:flex">
        <span className="text-[14px] font-bold leading-[1.35] text-white">Stronger together for independent pharmacies.</span>
        <span className="text-[12px] text-[#9fb1c6]">Hackachusetts 2026</span>
      </div>
      <button
        type="button"
        onClick={resetDemo}
        className="mx-2 rounded-[10px] border border-white/20 bg-transparent px-3 py-2 text-[13px] font-semibold text-[#c3d0df] hover:bg-white/5 hover:text-white"
      >
        Reset demo
      </button>
    </aside>
  );
}
