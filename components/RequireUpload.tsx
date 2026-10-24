"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "./Button";
import { usePlan } from "./PlanState";

/** Shows the page only after the pharmacy has uploaded its purchases. */
export default function RequireUpload({ title, children }: { title: string; children: ReactNode }) {
  const { plan } = usePlan();
  if (plan.uploaded) return <>{children}</>;
  return (
    <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      <h1 className="page-title">{title}</h1>
      <div className="flex max-w-[720px] flex-col items-start gap-3 rounded-[14px] border-2 border-dashed border-line-strong bg-surface p-8">
        <h2 className="section-title">Upload your purchases to see your savings</h2>
        <p className="m-0 text-muted">
          No insights yet. Add 12 months of purchase history from your wholesaler. It takes about 3 minutes, and
          we fix messy column names and spellings for you.
        </p>
        <Link href="/upload" className={buttonClass("primary")}>
          Upload data
        </Link>
      </div>
    </section>
  );
}
