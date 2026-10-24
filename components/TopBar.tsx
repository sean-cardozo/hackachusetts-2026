"use client";

import { usePathname } from "next/navigation";
import FreshnessChip from "./FreshnessChip";

const TITLES: Record<string, string> = {
  "/summary": "Summary",
  "/compare": "Re-negotiate",
  "/swap": "Swap",
  "/join": "Join",
  "/award": "Award",
  "/upload": "Upload data",
  "/sources": "Data sources",
};

interface TopBarProps {
  status?: "live" | "cached";
  nadacDate?: string;
  shortagesDate?: string;
}

export default function TopBar({ status = "live", nadacDate = "latest", shortagesDate = "today" }: TopBarProps) {
  const pathname = usePathname() ?? "";
  const key = Object.keys(TITLES).find((k) => pathname === k || pathname.startsWith(`${k}/`));
  const title = key ? TITLES[key] : "PharmaPool";
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-x-[14px] gap-y-2 border-b border-line bg-white/95 px-[clamp(16px,3vw,40px)] py-3 backdrop-blur-[8px]">
      <span className="min-w-0 flex-[1_1_180px] truncate text-[16px] font-extrabold tracking-[-0.015em] text-ink">
        {title}
      </span>
      <FreshnessChip status={status} nadacDate={nadacDate} shortagesDate={shortagesDate} />
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#dbeafe] text-[13px] font-extrabold text-navy"
        >
          SP
        </span>
        <span className="truncate whitespace-nowrap text-[14px] font-bold">Sample pharmacy</span>
      </span>
    </div>
  );
}
