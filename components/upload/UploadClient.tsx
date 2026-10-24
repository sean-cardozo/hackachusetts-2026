"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import { buttonClass } from "@/components/Button";
import { ErrorState } from "@/components/StateViews";
import { mapColumns, matchDrugs, parseUpload, toUploadRows } from "@/lib/match";
import type { RawRow } from "@/lib/match";
import type { ColumnMapping, DrugMatch, StandardField } from "@/lib/types";

export type UploadCatalogDrug = { id: string; name: string; strength: string; form: string };

type Props = {
  catalog: UploadCatalogDrug[];
  demoHeaders: string[];
  demoItems: Record<string, string | number>[];
};

type Kind = "purchases" | "inventory";

type Parsed = { fileName: string; headers: string[]; rows: RawRow[]; mappings: ColumnMapping[] };

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

const PAGE_ROWS = 50;

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

export default function UploadClient({ catalog, demoHeaders, demoItems }: Props) {
  const [purchases, setPurchases] = useState<Parsed | null>(null);
  const [inventory, setInventory] = useState<Parsed | null>(null);
  const [errors, setErrors] = useState<Record<Kind, string | null>>({ purchases: null, inventory: null });
  const [confirmed, setConfirmed] = useState<Record<number, { drugId: string; name: string }>>({});
  const [showAll, setShowAll] = useState(false);

  const catalogForMatch = catalog;
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
    const parsed: Parsed = {
      fileName,
      headers: result.headers,
      rows: result.rows,
      mappings: mapColumns(result.headers),
    };
    setErrors((e) => ({ ...e, [kind]: null }));
    if (kind === "purchases") {
      setConfirmed({});
      setShowAll(false);
      setPurchases(parsed);
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
      return { ...cur, mappings };
    });
    if (kind === "purchases") setConfirmed({});
  };

  const rows = useMemo(
    () => (purchases ? toUploadRows(purchases.rows, purchases.mappings) : []),
    [purchases],
  );
  const autoMatches = useMemo(() => matchDrugs(rows, catalogForMatch), [rows, catalogForMatch]);
  const matches = useMemo(
    () =>
      autoMatches.map((m): DrugMatch => {
        const c = confirmed[m.rowIndex];
        return c ? { ...m, status: "matched", corrected: c.name, drugId: c.drugId, confidence: 100 } : m;
      }),
    [autoMatches, confirmed],
  );
  const counts = useMemo(() => {
    let matched = 0;
    let review = 0;
    let unmatched = 0;
    for (const m of matches) {
      if (m.status === "matched") matched++;
      else if (m.status === "needs-review") review++;
      else unmatched++;
    }
    return { matched, review, unmatched };
  }, [matches]);

  const inventoryRows = useMemo(
    () => (inventory ? toUploadRows(inventory.rows, inventory.mappings).length : 0),
    [inventory],
  );

  const confirmRow = (rowIndex: number, drugId: string) => {
    const d = catalog.find((c) => c.id === drugId);
    if (!d) return;
    setConfirmed((cur) => ({ ...cur, [rowIndex]: { drugId, name: displayName(d) } }));
  };

  const visible = showAll ? matches : matches.slice(0, PAGE_ROWS);

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
          hint="Columns we look for: drug name, strength, NDC (optional), package size, units purchased per month, unit price paid, wholesaler (optional)."
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
            <MappingTable
              parsed={purchases}
              onChange={changeMapping("purchases")}
              caption="Column mapping"
            />
          </>
        ) : null}
      </div>

      {purchases ? (
        <div className="card p-5">
          <h2 className="section-title">Drug matching</h2>
          <p
            role="status"
            aria-live="polite"
            className="mb-3 mt-2 font-extrabold"
          >
            {matches.length} rows read: {counts.matched} matched, {counts.review} need review,{" "}
            {counts.unmatched} unmatched
          </p>
          {matches.length === 0 ? (
            <p className="m-0 text-muted">
              No drug names found. Set one column to &quot;Drug name&quot; in the mapping above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="border-b-[1.5px] border-line-strong text-[12px] uppercase tracking-[0.06em] text-muted">
                    <th scope="col" className="py-2 pr-3">Row</th>
                    <th scope="col" className="py-2 pr-3">Your text</th>
                    <th scope="col" className="py-2 pr-3">Matched to</th>
                    <th scope="col" className="py-2 pr-3">Status</th>
                    <th scope="col" className="py-2 pr-3">Confidence</th>
                    <th scope="col" className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => {
                    const isConfirmed = Boolean(confirmed[m.rowIndex]);
                    return (
                      <tr key={m.rowIndex} className="border-b border-line align-top">
                        <td className="py-2 pr-3 text-muted">{m.rowIndex + 1}</td>
                        <td className="py-2 pr-3 font-mono text-[12.5px]">{m.original}</td>
                        <td className="py-2 pr-3 font-bold">{m.corrected || "No match"}</td>
                        <td className="py-2 pr-3">
                          <StatusChip status={m.status} confirmed={isConfirmed} />
                        </td>
                        <td className="py-2 pr-3 font-bold">{isConfirmed ? "—" : `${m.confidence}%`}</td>
                        <td className="py-2">
                          {m.status === "needs-review" ? (
                            <div className="flex flex-col items-start gap-1.5">
                              {m.suggestions.map((s) => (
                                <Button
                                  key={s.drugId}
                                  variant="secondary"
                                  small
                                  aria-label={`Confirm row ${m.rowIndex + 1} as ${s.name}`}
                                  onClick={() => confirmRow(m.rowIndex, s.drugId)}
                                >
                                  {s.name} ({s.confidence}%)
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          {m.status === "unmatched" ? (
                            <select
                              aria-label={`Choose a drug for row ${m.rowIndex + 1}`}
                              className="rounded-[10px] border-[1.5px] border-line-strong bg-surface px-2 py-1"
                              defaultValue=""
                              onChange={(e) => e.target.value && confirmRow(m.rowIndex, e.target.value)}
                            >
                              <option value="">Choose from catalog…</option>
                              {catalog.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {displayName(d)}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!showAll && matches.length > PAGE_ROWS ? (
            <div className="mt-3">
              <Button variant="secondary" small onClick={() => setShowAll(true)}>
                Show all {matches.length} rows
              </Button>
            </div>
          ) : null}
          <p className="mb-0 mt-3 text-[12.5px] text-muted">Source: Rule-based matching on this device.</p>
          <div className="mt-4">
            <Link href="/compare" className={buttonClass("primary")}>
              See how your prices compare
            </Link>
          </div>
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
