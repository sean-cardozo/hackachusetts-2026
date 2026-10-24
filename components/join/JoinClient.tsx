"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/AppState";
import Button from "@/components/Button";
import SampleBadge from "@/components/SampleBadge";
import { EmptyState } from "@/components/StateViews";
import { useToast } from "@/components/Toast";
import { formatDollars, formatPercent } from "@/lib/format";
import { projectedProgress, statusAfterOptIn } from "@/lib/calc";
import type { QuotesView, RoundView } from "@/lib/data";
import type { RoundStatus } from "@/lib/types";
import AwardSection from "./AwardSection";
import { addHours, formatCountdown, savingsPct } from "./helpers";
import type { JoinDrug, JoinSwap } from "./helpers";

type Props = {
  rounds: RoundView[];
  quotes: QuotesView;
  drugs: JoinDrug[];
  swaps: JoinSwap[];
};

const CHIP: Record<RoundStatus, string> = {
  open: "border-accent bg-accent-soft text-accent-ink",
  target: "border-good bg-good-soft text-good",
  quotes: "border-ink bg-surface-2 text-ink",
  awarded: "border-good bg-good-soft text-good",
  closed: "border-line-strong bg-surface-2 text-muted",
  "at-risk": "border-bad bg-bad-soft text-bad",
  missed: "border-line-strong bg-surface-2 text-muted",
};
const CHIP_ICON: Partial<Record<RoundStatus, string>> = {
  target: "✓ ",
  awarded: "✓ ",
  "at-risk": "⚠ ",
};

export default function JoinClient({ rounds, quotes, drugs, swaps }: Props) {
  const { state, optIn, removeOptIn, confirmOptIn } = useAppState();
  const { toast } = useToast();
  const [dialogRound, setDialogRound] = useState<RoundView | null>(null);
  const [dropped, setDropped] = useState<Record<string, boolean>>({});

  const drugById = useMemo(() => new Map(drugs.map((d) => [d.id, d])), [drugs]);

  const joined = useCallback(
    (r: RoundView) => Boolean(state.optIns[r.id]) || (Boolean(r.userJoined) && !dropped[r.id]),
    [state.optIns, dropped],
  );

  /** Status after the user's opt-in is counted (only the Cardio-style rounds with units change). */
  const effective = useCallback(
    (r: RoundView) => {
      const oi = state.optIns[r.id];
      if (oi && r.committedUnits !== null && r.targetUnits !== null) {
        const status = statusAfterOptIn(r.status, r.committedUnits, r.targetUnits, oi.units);
        const progress = projectedProgress(r.committedUnits, r.targetUnits, oi.units);
        return { status, progress, committed: r.committedUnits + oi.units };
      }
      return { status: r.status, progress: r.progress, committed: r.committedUnits };
    },
    [state.optIns],
  );

  const needsDecision = rounds.filter((r) => {
    const e = effective(r);
    if (e.status === "open" && !joined(r) && r.drugs.length > 0) return true;
    if (e.status === "target" && !state.optIns[r.id]?.confirmed && joined(r)) return true;
    return false;
  });

  const confirm = (r: RoundView) => {
    if (!state.optIns[r.id]) optIn(r.id, 0);
    confirmOptIn(r.id);
    toast(`Confirmed for ${r.name}.`);
  };
  const dropOut = (r: RoundView) => {
    removeOptIn(r.id);
    setDropped((d) => ({ ...d, [r.id]: true }));
    toast(`You dropped out of ${r.name}.`);
  };

  const diabetes = rounds.find((r) => r.id === quotes.roundId) ?? null;

  return (
    <div>
      <h1 className="page-title">Join</h1>
      <p className="mt-1 max-w-2xl text-muted">
        Pool your buying with other Massachusetts pharmacies. Opt-ins are non-binding until the
        round reaches its target.
      </p>

      {needsDecision.length > 0 ? (
        <div
          role="status"
          className="card-accent mt-5 flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <div>
            <div className="font-display text-[22px] uppercase tracking-[0.02em]">
              Decision needed
            </div>
            <div className="text-[13.5px]">
              {needsDecision.map((r) => r.name).join(", ")}:{" "}
              {needsDecision.some((r) => effective(r).status === "target")
                ? "confirm or drop out before the timer ends."
                : "opt in before the round closes."}
            </div>
          </div>
        </div>
      ) : null}

      <ol className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="How a round works">
        {[
          ["1", "Opt in", "Commit units. It is non-binding."],
          ["2", "Target reached", "Suppliers are asked for quotes."],
          ["3", "48h to confirm", "Confirm or drop out within 48 hours."],
        ].map(([n, t, d]) => (
          <li key={n} className="card flex items-start gap-3 p-3">
            <span className="font-display text-[26px] leading-none text-accent-ink">{n}</span>
            <span>
              <span className="block font-extrabold">{t}</span>
              <span className="block text-[12.5px] text-muted">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      <h2 className="section-title mt-8">Rounds</h2>
      {rounds.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No rounds yet" description="New rounds will appear here." />
        </div>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {rounds.map((r) => (
            <RoundCard
              key={r.id}
              round={r}
              eff={effective(r)}
              joined={joined(r)}
              confirmed={Boolean(state.optIns[r.id]?.confirmed)}
              names={r.drugs.map((id) => {
                const d = drugById.get(id);
                return d ? d.name : id;
              })}
              onJoin={() => setDialogRound(r)}
              onConfirm={() => confirm(r)}
              onDrop={() => dropOut(r)}
            />
          ))}
        </div>
      )}

      {dialogRound ? (
        <OptInDialog
          round={dialogRound}
          drugs={dialogRound.drugs.flatMap((id) => drugById.get(id) ?? [])}
          swaps={swaps.filter((s) => s.roundId === dialogRound.id)}
          onClose={() => setDialogRound(null)}
          onConfirm={(units) => {
            optIn(dialogRound.id, units);
            const after =
              dialogRound.committedUnits !== null && dialogRound.targetUnits !== null
                ? statusAfterOptIn(
                    dialogRound.status,
                    dialogRound.committedUnits,
                    dialogRound.targetUnits,
                    units,
                  )
                : dialogRound.status;
            toast(
              after === "target"
                ? `You are in. ${dialogRound.name} reached its target: 48 hours to confirm.`
                : `You are in ${dialogRound.name}. Non-binding until the target is reached.`,
            );
            setDialogRound(null);
          }}
        />
      ) : null}

      {diabetes ? (
        <AwardSection quotes={quotes} round={diabetes} drugNames={quotes.products} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Round card
// ---------------------------------------------------------------------------

type Eff = { status: RoundStatus; progress: number | null; committed: number | null };

function RoundCard({
  round: r,
  eff,
  joined,
  confirmed,
  names,
  onJoin,
  onConfirm,
  onDrop,
}: {
  round: RoundView;
  eff: Eff;
  joined: boolean;
  confirmed: boolean;
  names: string[];
  onJoin: () => void;
  onConfirm: () => void;
  onDrop: () => void;
}) {
  const { demoNow, deadline, confirmDeadline } = r.anchors;
  const status = eff.status;
  const label =
    status === r.status ? r.displayStatus : status === "target" ? "Target reached" : r.displayStatus;
  const closes = formatCountdown(demoNow, deadline);
  // A target reached by your own opt-in has no stored deadline: 48 hours from the demo clock.
  const confirmIso = confirmDeadline ?? (status === "target" ? addHours(demoNow, 48) : null);
  const confirmIn = formatCountdown(demoNow, confirmIso);
  const progress = eff.progress;
  const pharmacies = r.pharmacies === null ? null : r.pharmacies + (joined && !r.userJoined ? 1 : 0);

  return (
    <article className="card flex flex-col gap-3 p-5" aria-label={r.name}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="m-0 font-display text-[24px] uppercase leading-tight tracking-[0.02em]">
          {r.name}
        </h3>
        <SampleBadge />
        <span
          className={`inline-flex items-center rounded-full border-[1.5px] px-2.5 py-0.5 text-[12px] font-extrabold ${CHIP[status]}`}
        >
          {CHIP_ICON[status] ?? ""}
          {label}
        </span>
      </header>

      {names.length > 0 ? (
        <p className="m-0 text-[13px] text-muted">Includes: {names.join(", ")}</p>
      ) : null}

      <SavingsLine round={r} status={status} />

      {progress !== null && status !== "missed" && status !== "closed" && status !== "awarded" ? (
        <div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(progress))}
            aria-label={`${r.name} progress to target`}
            className="h-3 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className={`h-full rounded-full ${progress >= 100 ? "bg-good" : "bg-accent"}`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="mt-1 text-[13px]">
            <b>{Math.round(progress)}% of target</b>
            {pharmacies !== null ? `, ${pharmacies} pharmacies joined` : ""}
            {progress > 100 ? " (above target)" : ""}
          </div>
        </div>
      ) : null}

      {status === "at-risk" && r.projectedPct !== undefined ? (
        <p className="m-0 rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] font-semibold text-bad">
          ▼ On pace for {Math.round(r.projectedPct)}% of target at close. More pharmacies are needed
          to reach 100%.
        </p>
      ) : null}

      {status === "open" && closes ? (
        <div className="text-[13px]">
          Closes in <b>{closes}</b>
        </div>
      ) : null}

      {status === "target" ? (
        <div className="rounded-[10px] border-[1.5px] border-good bg-good-soft px-3 py-2 text-[13px]">
          {confirmed ? (
            <b className="text-good">✓ Confirmed. Waiting for supplier quotes.</b>
          ) : (
            <>
              <b>Confirm within {confirmIn ?? "48h"}</b>
              <span className="text-muted"> (48-hour window)</span>
            </>
          )}
        </div>
      ) : null}

      {status === "awarded" && r.awardedSupplier ? (
        <p className="m-0 text-[13.5px]">
          Awarded to <b>Supplier {r.awardedSupplier}</b>
          {r.awardedPct !== undefined ? ` at ${formatPercent(r.awardedPct)}` : ""}.
        </p>
      ) : null}
      {status === "missed" ? (
        <p className="m-0 text-[13.5px]">
          No orders were placed and commitments were released.
          {r.progress !== null ? ` The round ended at ${Math.round(r.progress)}% of target.` : ""}
        </p>
      ) : null}
      {status === "quotes" ? (
        <p className="m-0 text-[13.5px]">Supplier quotes are in. See the award section below.</p>
      ) : null}

      {r.pastConfirmRate !== null ? (
        <div className="text-[12.5px] text-muted">
          Confirmation rate on past rounds: {Math.round(r.pastConfirmRate * 100)}%
        </div>
      ) : null}

      <footer className="mt-auto flex flex-wrap gap-2 pt-1">
        {(status === "open" || status === "at-risk") && r.drugs.length > 0 ? (
          joined ? (
            <span className="font-extrabold text-good">✓ You are in (non-binding)</span>
          ) : (
            <Button onClick={onJoin}>Opt in</Button>
          )
        ) : null}
        {status === "target" && joined && !confirmed ? (
          <>
            <Button onClick={onConfirm}>Confirm</Button>
            <Button variant="secondary" onClick={onDrop}>
              Drop out
            </Button>
          </>
        ) : null}
      </footer>
    </article>
  );
}

function SavingsLine({ round: r, status }: { round: RoundView; status: RoundStatus }) {
  let text: string | null = null;
  if (status === "closed" && r.savedUsd !== undefined) {
    const p = savingsPct(r, r.savedUsd);
    text = `Saved ${formatDollars(r.savedUsd)}${p !== null ? ` (${formatPercent(p)})` : ""}`;
  } else if (status === "awarded" && r.awardedPct !== undefined) {
    const usd = (r.awardedPct / 100) * r.userSpendUsd;
    text = `${formatPercent(r.awardedPct)} quoted${usd > 0 ? `, about ${formatDollars(usd)}/yr` : ""}`;
  } else if (r.estSavingsUsd && status !== "missed") {
    const { low, high } = r.estSavingsUsd;
    const pl = r.estRange ? r.estRange[0] : savingsPct(r, low);
    const ph = r.estRange ? r.estRange[1] : savingsPct(r, high);
    text = `Est. ${formatDollars(low)} to ${formatDollars(high)}/yr${
      pl !== null && ph !== null ? ` (${formatPercent(pl)} to ${formatPercent(ph)})` : ""
    }`;
  }
  if (!text) return null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-[22px] uppercase tracking-[0.02em]">{text}</span>
        <SampleBadge />
      </div>
      {status !== "closed" && status !== "awarded" ? (
        <div className="text-[12px] text-muted">{r.savingsBasis}</div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opt-in dialog
// ---------------------------------------------------------------------------

function OptInDialog({
  round,
  drugs,
  swaps,
  onClose,
  onConfirm,
}: {
  round: RoundView;
  drugs: JoinDrug[];
  swaps: JoinSwap[];
  onClose: () => void;
  onConfirm: (totalUnits: number) => void;
}) {
  const [units, setUnits] = useState<Record<string, string>>(() =>
    Object.fromEntries(drugs.map((d) => [d.id, String(d.recommendedCommitment ?? 0)])),
  );
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  };
  const total = drugs.reduce((s, d) => s + num(units[d.id] ?? "0"), 0);
  const from = round.progress;
  const to =
    round.committedUnits !== null && round.targetUnits !== null
      ? projectedProgress(round.committedUnits, round.targetUnits, total)
      : null;

  // Focus trap, Esc to close, focus restore.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusables = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="optin-title"
        className="card-strong max-h-[90vh] w-full max-w-[560px] overflow-y-auto bg-surface p-6 shadow-pp"
      >
        <h2 id="optin-title" className="section-title m-0">
          Opt in to {round.name}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Suggested commitment: 3 x monthly use minus extra stock. Edit any number.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {drugs.map((d) => {
            const swap = swaps.find((s) => s.drugId === d.id);
            return (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`u-${d.id}`} className="min-w-[160px] font-bold">
                  {d.name}
                  <span className="block text-[12px] font-normal text-muted">
                    Uses {d.unitsPerMonth.toLocaleString("en-US")} units/month
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  {swap ? (
                    <Link href="/swap" className="text-[12.5px] font-bold text-accent-ink underline">
                      Swap to join
                    </Link>
                  ) : null}
                  <input
                    id={`u-${d.id}`}
                    type="number"
                    min={0}
                    step={100}
                    inputMode="numeric"
                    value={units[d.id] ?? ""}
                    onChange={(e) => setUnits((u) => ({ ...u, [d.id]: e.target.value }))}
                    className="w-32 rounded-[10px] border-[1.5px] border-line-strong bg-surface px-3 py-2 text-right tabular-nums"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-[10px] bg-surface-2 p-3 text-[13.5px]">
          <div>
            Your total: <b className="tabular-nums">{total.toLocaleString("en-US")} units</b>
          </div>
          {from !== null && to !== null ? (
            <div>
              Round progress: <b>{Math.round(from)}%</b> → <b>{Math.round(to)}%</b> of target
              {to >= 100 ? " (target reached: you would have 48 hours to confirm)" : ""}
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-[13px] text-muted">
          Non-binding. When the round reaches its target, you&apos;ll have 48 hours to confirm or
          drop out.
        </p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={total <= 0} onClick={() => onConfirm(total)}>
            Opt in
          </Button>
        </div>
      </div>
    </div>
  );
}
