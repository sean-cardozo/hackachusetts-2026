"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import { buttonClass } from "@/components/Button";
import GapPill from "@/components/GapPill";
import LiveBadge from "@/components/LiveBadge";
import SampleBadge from "@/components/SampleBadge";
import { usePlan } from "@/components/PlanState";
import { ErrorState } from "@/components/StateViews";
import { formatDollars } from "@/lib/format";
import {
  aggregateInvoiceLines,
  mapColumns,
  matchProducts,
  parseUpload,
  toUploadRows,
} from "@/lib/match";
import type { ProductMatch, RawRow } from "@/lib/match";
import type { ColumnMapping, DrugMatch, StandardField } from "@/lib/types";

export type UploadCatalogDrug = {
  id: string;
  name: string;
  strength: string;
  form: string;
  /** NADAC benchmark per unit in dollars, or null when none is available. */
  nadac: number | null;
  nadacSource: "live" | "fallback";
  nadacEffectiveDate: string | null;
};

type Props = {
  catalog: UploadCatalogDrug[];
  demoHeaders: string[];
  demoItems: Record<string, string | number>[];
};

type Kind = "purchases" | "inventory";

type Parsed = {
  fileName: string;
  headers: string[];
  rows: RawRow[];
  mappings: ColumnMapping[];
  /** Where the column mapping came from. */
  mapSource: "Rule-based" | "AI" | "Edited by you";
};

const FIELD_LABELS: Record<StandardField, string> = {
  drugName: "Drug name",
  strength: "Strength",
  ndc: "NDC",
  packageSize: "Package size",
  unitsPerMonth: "Units per month",
  pricePaid: "Unit price paid",
  wholesaler: "Wholesaler",
  onHand: "Units on hand",
  countDate: "Count date",
  expirationDate: "Expiration date",
  quantity: "Packages shipped",
  invoiceDate: "Invoice date",
  packageUnit: "Package unit",
  unitCostPerPackage: "Price per package",
  extendedCost: "Extended cost",
  transactionType: "Transaction type",
  creditReason: "Credit reason",
  invoiceId: "Invoice number",
};

const TEMPLATE_HEADERS = [
  "Drug name",
  "Strength",
  "NDC (optional)",
  "Package size",
  "Units purchased per month",
  "Unit price paid",
  "Wholesaler (optional)",
];

const LIST_ROWS = 100;

function csvCell(value: string | number | undefined): string {
  const s = value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: Record<string, string | number>[]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  return lines.join("\n");
}

function downloadTemplate() {
  const csv = `${TEMPLATE_HEADERS.join(",")}\nAtorvastatin,20 mg,,90,1000,0.09,McKesson\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "poolrx-upload-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

const chipBase =
  "inline-flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-0.5 text-[12px] font-extrabold whitespace-nowrap";

function ConfidenceChip({ label, confidence }: { label: string; confidence: number }) {
  const icon = label === "High" ? "▲" : label === "Medium" ? "◆" : "▼";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="font-bold">{confidence}%</span>
      <span className={`${chipBase} border-line-strong bg-surface-2 text-ink`}>
        <span aria-hidden>{icon}</span>
        {label}
      </span>
    </span>
  );
}

function StatusChip({ status, confirmed }: { status: DrugMatch["status"]; confirmed: boolean }) {
  if (status === "matched") {
    return (
      <span className={`${chipBase} border-good bg-good-soft text-good`}>
        <span aria-hidden>✓</span>
        {confirmed ? "Matched · Confirmed by you" : "Matched"}
      </span>
    );
  }
  if (status === "needs-review") {
    return (
      <span className={`${chipBase} border-accent bg-accent-soft text-accent-ink`}>
        <span aria-hidden>!</span>Needs review
      </span>
    );
  }
  return (
    <span className={`${chipBase} border-bad bg-bad-soft text-bad`}>
      <span aria-hidden>✕</span>Unmatched
    </span>
  );
}

type DropzoneProps = {
  id: string;
  title: string;
  hint: string;
  onFile: (file: File) => void;
  children?: React.ReactNode;
};

function Dropzone({ id, title, hint, onFile, children }: DropzoneProps) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex flex-col items-center gap-3 rounded-[14px] border-2 border-dashed p-6 text-center ${
        over ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2"
      }`}
    >
      <p className="m-0 font-extrabold">{title}</p>
      <p className="m-0 max-w-md text-[13px] text-muted">{hint}</p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label={title}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" small onClick={() => inputRef.current?.click()}>
          Choose a CSV file
        </Button>
        {children}
      </div>
    </div>
  );
}

function MappingTable({
  parsed,
  onChange,
  caption,
}: {
  parsed: Parsed;
  onChange: (index: number, field: StandardField | null) => void;
  caption: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13.5px]">
        <caption className="mb-2 text-left font-extrabold">{caption}</caption>
        <thead>
          <tr className="border-b-[1.5px] border-line-strong text-[12px] uppercase tracking-[0.06em] text-muted">
            <th scope="col" className="py-2 pr-3">Column in your file</th>
            <th scope="col" className="py-2 pr-3">Standard field</th>
            <th scope="col" className="py-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {parsed.mappings.map((m, i) => (
            <tr key={`${m.source}-${i}`} className="border-b border-line">
              <td className="py-2 pr-3 font-mono text-[12.5px]">{m.source}</td>
              <td className="py-2 pr-3">
                <select
                  aria-label={`Standard field for column ${m.source}`}
                  className="rounded-[10px] border-[1.5px] border-line-strong bg-surface px-2 py-1"
                  value={m.field ?? ""}
                  onChange={(e) => onChange(i, (e.target.value || null) as StandardField | null)}
                >
                  <option value="">Not used</option>
                  {(Object.keys(FIELD_LABELS) as StandardField[]).map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2">
                {m.field ? (
                  <ConfidenceChip label={m.label} confidence={m.confidence} />
                ) : (
                  <span className="text-muted">Not recognized</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Analysis = { products: ProductMatch[]; lineCount: number; skipped: number };

/** Price per unit: 4 decimals under $1, otherwise 2. */
function unitMoney(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "n/a";
  return `$${v.toFixed(v < 1 ? 4 : 2)}`;
}

export default function UploadClient({ catalog, demoHeaders, demoItems }: Props) {
  const [purchases, setPurchases] = useState<Parsed | null>(null);
  const [inventory, setInventory] = useState<Parsed | null>(null);
  const [errors, setErrors] = useState<Record<Kind, string | null>>({ purchases: null, inventory: null });
  const [confirmed, setConfirmed] = useState<Record<string, string>>({}); // product key -> drug id
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [matching, setMatching] = useState(false);
  const [showAllNot, setShowAllNot] = useState(false);
  const { setUploaded } = usePlan();

  // A purchase file that was read and matched unlocks the insight pages.
  useEffect(() => {
    if (analysis) setUploaded(true);
  }, [analysis, setUploaded]);

  const catalogById = useMemo(() => new Map(catalog.map((d) => [d.id, d])), [catalog]);
  const displayName = useCallback(
    (d: UploadCatalogDrug) => [d.name, d.strength].filter(Boolean).join(" "),
    [],
  );

  const ingest = useCallback((kind: Kind, text: string, fileName: string) => {
    const result = parseUpload(text, fileName);
    if (!result.ok) {
      setErrors((e) => ({ ...e, [kind]: result.error }));
      return;
    }
    const headers = result.headers;
    const parsed: Parsed = {
      fileName,
      headers,
      rows: result.rows,
      mappings: mapColumns(headers),
      mapSource: "Rule-based",
    };
    setErrors((e) => ({ ...e, [kind]: null }));
    if (kind === "purchases") {
      setConfirmed({});
      setShowAllNot(false);
      setAnalysis(null);
      setPurchases(parsed);
      // Ask the AI route once. Use its answer only when the model really answered.
      void fetch("/api/ai/column-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { source?: string; result?: ColumnMapping[] } | null) => {
          if (!j || j.source !== "ai" || !Array.isArray(j.result) || j.result.length !== headers.length) return;
          const aiMappings = j.result;
          setPurchases((cur) =>
            cur && cur.headers === headers && cur.mapSource === "Rule-based"
              ? { ...cur, mappings: aiMappings, mapSource: "AI" }
              : cur,
          );
        })
        .catch(() => undefined);
    } else {
      setInventory(parsed);
    }
  }, []);

  const handleFile = useCallback(
    async (kind: Kind, file: File) => {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        setErrors((e) => ({
          ...e,
          [kind]: `"${file.name}" is an Excel file, and only CSV works for now. In Excel choose File > Save As > "CSV (comma delimited)", then upload the new file.`,
        }));
        return;
      }
      try {
        const text = await file.text();
        ingest(kind, text, file.name);
      } catch {
        setErrors((e) => ({
          ...e,
          [kind]: `"${file.name}" could not be read. Check the file is not open in another program and upload it again.`,
        }));
      }
    },
    [ingest],
  );

  const useDemo = useCallback(() => {
    ingest("purchases", toCsv(demoHeaders, demoItems), "demo-wholesaler-export.csv");
  }, [ingest, demoHeaders, demoItems]);

  const changeMapping = (kind: Kind) => (index: number, field: StandardField | null) => {
    const setter = kind === "purchases" ? setPurchases : setInventory;
    setter((cur) => {
      if (!cur) return cur;
      const mappings = cur.mappings.map((m, i) => {
        if (i === index) {
          return field
            ? { ...m, field, confidence: 100, label: "High" as const }
            : { ...m, field: null, confidence: 0, label: "Low" as const };
        }
        // A field belongs to one column only.
        return field && m.field === field ? { ...m, field: null, confidence: 0, label: "Low" as const } : m;
      });
      return { ...cur, mappings, mapSource: "Edited by you" as const };
    });
    if (kind === "purchases") setConfirmed({});
  };

  // Aggregate lines first, then match only the unique products. Runs after paint so
  // the "Matching…" state shows while a large file is processed.
  const mappings = purchases?.mappings;
  const rawRows = purchases?.rows;
  useEffect(() => {
    if (!mappings || !rawRows) return;
    setMatching(true);
    const id = setTimeout(() => {
      const agg = aggregateInvoiceLines(toUploadRows(rawRows, mappings));
      setAnalysis({
        products: matchProducts(agg.products, catalog),
        lineCount: agg.lineCount,
        skipped: agg.skipped,
      });
      setMatching(false);
    }, 30);
    return () => clearTimeout(id);
  }, [mappings, rawRows, catalog]);

  // Apply the user's confirmations on top of the automatic result.
  const effective = useMemo(() => {
    if (!analysis) return [];
    return analysis.products.map((pm): ProductMatch => {
      const drugId = confirmed[pm.product.key];
      const d = drugId ? catalogById.get(drugId) : undefined;
      if (!d) return pm;
      const match: DrugMatch = {
        ...pm.match,
        status: "matched",
        corrected: displayName(d),
        drugId: d.id,
        confidence: 100,
      };
      return { product: pm.product, match, note: undefined };
    });
  }, [analysis, confirmed, catalogById, displayName]);

  const annual = (pm: ProductMatch) => pm.product.unitsPerMonth * pm.product.avgUnitPrice * 12;

  const view = useMemo(() => {
    const inCatalog = effective
      .filter((pm) => pm.match.status !== "unmatched")
      .sort((a, b) => annual(b) - annual(a));
    const notIn = effective
      .filter((pm) => pm.match.status === "unmatched")
      .sort((a, b) => annual(b) - annual(a));
    return {
      inCatalog,
      notIn,
      matched: inCatalog.filter((pm) => pm.match.status === "matched").length,
      review: inCatalog.filter((pm) => pm.match.status === "needs-review").length,
      notInSpend: notIn.reduce((sum, pm) => sum + annual(pm), 0),
    };
  }, [effective]);

  const inventoryRows = useMemo(
    () => (inventory ? toUploadRows(inventory.rows, inventory.mappings).length : 0),
    [inventory],
  );
  const confirmProduct = (key: string, drugId: string) => {
    if (!catalogById.has(drugId)) return;
    setConfirmed((cur) => ({ ...cur, [key]: drugId }));
  };

  const mappedCount = purchases ? purchases.mappings.filter((m) => m.field).length : 0;
  const lowCount = purchases ? purchases.mappings.filter((m) => m.field && m.confidence < 90).length : 0;
  const hasDrugColumn = purchases ? purchases.mappings.some((m) => m.field === "drugName") : false;
  const notInShown = showAllNot ? view.notIn : view.notIn.slice(0, LIST_ROWS);

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* Step 1 */}
      <div className="card-strong p-5">
        <div className="flex items-baseline gap-3">
          <h2 className="section-title">Step 1: Purchase history</h2>
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-accent-ink">Required</span>
        </div>
        <p className="mb-4 mt-2 text-muted">
          CSV only for now. If your file is an Excel sheet, open it and choose File &gt; Save As &gt;
          &quot;CSV (comma delimited)&quot; first.
        </p>
        <Dropzone
          id="upload-purchases"
          title="Drop your purchase history CSV here"
          hint="A wholesaler purchase export works as it is: we find the columns and match the drugs for you. Or use drug name, strength, package size, units per month and unit price."
          onFile={(f) => void handleFile("purchases", f)}
        >
          <Button variant="primary" small onClick={useDemo}>
            Use demo file
          </Button>
          <Button variant="secondary" small onClick={downloadTemplate}>
            Download template
          </Button>
        </Dropzone>
        {errors.purchases ? (
          <div className="mt-4">
            <ErrorState message={errors.purchases} />
          </div>
        ) : null}
        {purchases ? (
          <>
            <p className="mb-0 mt-4 text-[13px] text-muted">
              File: <span className="font-mono">{purchases.fileName}</span>
            </p>
            <p role="status" aria-live="polite" className="mb-0 mt-2 font-extrabold">
              Auto-mapped {mappedCount} of {purchases.headers.length} columns
              <span className="ml-2 text-[12.5px] font-normal text-muted">
                ({purchases.mapSource}
                {lowCount > 0 ? `, ${lowCount} to double-check` : ""})
              </span>
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-[13.5px] font-bold text-accent-ink">
                Review column mapping
              </summary>
              <MappingTable
                parsed={purchases}
                onChange={changeMapping("purchases")}
                caption="Column mapping"
              />
            </details>
          </>
        ) : null}
      </div>
      {purchases ? (
        <div className="card p-5">
          <h2 className="section-title">Drug matching</h2>
          {!hasDrugColumn ? (
            <p className="m-0 mt-2 text-muted">
              No drug names found. Open &quot;Review column mapping&quot; above and set one column to
              &quot;Drug name&quot;.
            </p>
          ) : matching || !analysis ? (
            <p role="status" aria-live="polite" className="mb-0 mt-2 font-extrabold">
              Matching…
            </p>
          ) : (
            <>
              <p role="status" aria-live="polite" className="mb-1 mt-2 font-extrabold">
                {analysis.lineCount.toLocaleString("en-US")} invoice lines,{" "}
                {analysis.products.length.toLocaleString("en-US")} products: {view.matched} matched to your
                pool catalog, {view.review} need review, {view.notIn.length.toLocaleString("en-US")} not in
                the pool catalog (brand and long-tail)
              </p>
              <p className="m-0 text-[12.5px] text-muted">
                The pool catalog is the {catalog.length} high-volume generics PharmaPool prices against NADAC in
                this pilot. Everything else in your file is still counted, as brand and OTC spend.
              </p>
              {analysis.skipped > 0 ? (
                <p className="m-0 text-[12.5px] text-muted">
                  {analysis.skipped.toLocaleString("en-US")} lines were skipped because a quantity, package
                  size or price was missing.
                </p>
              ) : null}
              {view.inCatalog.length === 0 ? (
                <p className="mb-0 mt-3 text-muted">
                  No products matched the pool catalog. Check the column mapping above.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[13.5px]">
                    <caption className="sr-only">Products matched to your pool catalog, largest annual spend first</caption>
                    <thead>
                      <tr className="border-b-[1.5px] border-line-strong text-[12px] uppercase tracking-[0.06em] text-muted">
                        <th scope="col" className="py-2 pr-3">Product (as uploaded → catalog)</th>
                        <th scope="col" className="py-2 pr-3 text-right">Units per month</th>
                        <th scope="col" className="py-2 pr-3 text-right">You pay per unit</th>
                        <th scope="col" className="py-2 pr-3 text-right">NADAC per unit</th>
                        <th scope="col" className="py-2 pr-3">Gap</th>
                        <th scope="col" className="py-2 pr-3 text-right">Annual spend</th>
                        <th scope="col" className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.inCatalog.map((pm) => {
                        const p = pm.product;
                        const d = pm.match.drugId ? catalogById.get(pm.match.drugId) : undefined;
                        const nadac = d?.nadac ?? null;
                        const gap = nadac && nadac > 0 && p.avgUnitPrice > 0 ? ((p.avgUnitPrice - nadac) / nadac) * 100 : null;
                        const isConfirmed = Boolean(confirmed[p.key]);
                        return (
                          <tr key={p.key} className="border-b border-line align-top">
                            <td className="py-2 pr-3">
                              <span className="font-mono text-[12.5px]">{p.displayName}</span>
                              <span aria-hidden className="mx-1 text-muted">→</span>
                              <span className="font-bold">{pm.match.corrected || "No match"}</span>
                            </td>
                            <td className="py-2 pr-3 text-right">{Math.round(p.unitsPerMonth).toLocaleString("en-US")}</td>
                            <td className="py-2 pr-3 text-right">{unitMoney(p.avgUnitPrice)}</td>
                            <td className="py-2 pr-3 text-right">
                              {nadac !== null ? (
                                <span className="inline-flex flex-col items-end gap-0.5">
                                  <span>{unitMoney(nadac)}</span>
                                  <span title={d?.nadacEffectiveDate ? `NADAC week of ${d.nadacEffectiveDate}` : undefined}>
                                    {d?.nadacSource === "live" ? <LiveBadge /> : <SampleBadge />}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted">n/a</span>
                              )}
                            </td>
                            <td className="py-2 pr-3"><GapPill gapPct={gap} /></td>
                            <td className="py-2 pr-3 text-right font-bold">{formatDollars(annual(pm), { compact: false })}</td>
                            <td className="py-2">
                              <StatusChip status={pm.match.status} confirmed={isConfirmed} />
                              {pm.match.status === "needs-review" ? (
                                <div className="mt-1.5 flex flex-col items-start gap-1.5">
                                  {pm.match.suggestions.map((s) => (
                                    <Button
                                      key={s.drugId}
                                      variant="secondary"
                                      small
                                      aria-label={`Confirm ${p.displayName} as ${s.name}`}
                                      onClick={() => confirmProduct(p.key, s.drugId)}
                                    >
                                      {s.name} ({s.confidence}%)
                                    </Button>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-1 text-[12px] text-muted">{isConfirmed ? "" : `${pm.match.confidence}% sure`}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {view.notIn.length > 0 ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-[13.5px] font-bold text-accent-ink">
                    {view.notIn.length.toLocaleString("en-US")} products not in the pool catalog ·{" "}
                    {formatDollars(view.notInSpend, { compact: false })} a year, treated as brand/OTC spend
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <caption className="sr-only">Products not in the pool catalog, largest annual spend first</caption>
                      <thead>
                        <tr className="border-b-[1.5px] border-line-strong text-[12px] uppercase tracking-[0.06em] text-muted">
                          <th scope="col" className="py-2 pr-3">Product</th>
                          <th scope="col" className="py-2 pr-3 text-right">Annual spend</th>
                          <th scope="col" className="py-2">Add to a catalog drug</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notInShown.map((pm) => (
                          <tr key={pm.product.key} className="border-b border-line align-top">
                            <td className="py-1.5 pr-3">
                              <span className="font-mono text-[12.5px]">{pm.product.displayName}</span>
                              {pm.note ? <div className="text-[12px] text-muted">{pm.note}</div> : null}
                            </td>
                            <td className="py-1.5 pr-3 text-right">{formatDollars(annual(pm), { compact: false })}</td>
                            <td className="py-1.5">
                              <select
                                aria-label={`Choose a drug for ${pm.product.displayName}`}
                                className="rounded-[10px] border-[1.5px] border-line-strong bg-surface px-2 py-1"
                                defaultValue=""
                                onChange={(e) => e.target.value && confirmProduct(pm.product.key, e.target.value)}
                              >
                                <option value="">Choose from catalog…</option>
                                {catalog.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {displayName(d)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!showAllNot && view.notIn.length > LIST_ROWS ? (
                    <div className="mt-3">
                      <Button variant="secondary" small onClick={() => setShowAllNot(true)}>
                        Show all {view.notIn.length.toLocaleString("en-US")} products
                      </Button>
                    </div>
                  ) : null}
                </details>
              ) : null}
              <p className="mb-0 mt-3 text-[12.5px] text-muted">
                Source: {purchases.mapSource === "AI" ? "AI column mapping" : "Rule-based column mapping"}, rule-based
                drug matching on this device. Prices are per unit (tablet, capsule or inhaler).
              </p>
              <div className="mt-4">
                <Link href="/summary" className={buttonClass("primary")} onClick={() => setUploaded(true)}>
                  See how your prices compare
                </Link>
              </div>
            </>
          )}
        </div>
      ) : null}
      {/* Step 2 */}
      <div className="card p-5">
        <div className="flex items-baseline gap-3">
          <h2 className="section-title">Step 2: Inventory</h2>
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-muted">Optional</span>
        </div>
        <p className="mb-4 mt-2 text-muted">
          Add inventory to see days of supply and get a recommended commitment.
        </p>
        <Dropzone
          id="upload-inventory"
          title="Drop your inventory CSV here"
          hint="Columns we look for: drug name, strength, NDC (optional), units on hand, count date, expiration date (optional)."
          onFile={(f) => void handleFile("inventory", f)}
        />
        {errors.inventory ? (
          <div className="mt-4">
            <ErrorState message={errors.inventory} />
          </div>
        ) : null}
        {inventory ? (
          <>
            <p className="mb-0 mt-4 text-[13px] text-muted">
              File: <span className="font-mono">{inventory.fileName}</span> ·{" "}
              <span className="font-bold text-ink">{inventoryRows} rows read</span>
            </p>
            <MappingTable
              parsed={inventory}
              onChange={changeMapping("inventory")}
              caption="Inventory column mapping"
            />
          </>
        ) : null}
      </div>
      {/* Privacy */}
      <div className="card-accent p-5">
        <h2 className="section-title">Privacy</h2>
        <p className="mb-0 mt-2 font-bold">
          Your name, prices and stock levels are never shown to other pharmacies or suppliers. Group
          figures are shown only when 5 or more pharmacies contribute.
        </p>
        <p className="mb-0 mt-2 text-muted">Uploads must not contain patient data.</p>
      </div>
    </div>
  );
}
