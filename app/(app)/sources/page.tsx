import { getFeedStatus } from "@/lib/data";
import type { FeedStatusView } from "@/lib/data";
import LiveBadge from "@/components/LiveBadge";
import SampleBadge from "@/components/SampleBadge";
import { EmptyState, ErrorState } from "@/components/StateViews";

const FEED_INFO: Record<string, { name: string; cadence: string; use: string }> = {
  nadac: {
    name: "CMS NADAC",
    cadence: "Weekly",
    use: "NADAC is the national average price pharmacies pay wholesalers. We use it as the benchmark for what you should be paying.",
  },
  orangebook: {
    name: "FDA Orange Book",
    cadence: "Monthly",
    use: "An AB rating means FDA says this product is therapeutically equivalent. We only suggest swaps between products with an AB rating.",
  },
  shortages: {
    name: "openFDA drug shortages",
    cadence: "Daily",
    use: "Lists drugs FDA currently reports as in shortage. We use it to flag supply risk and decide what to buy first.",
  },
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "Not available";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
}

function loadFeeds(): FeedStatusView[] | null {
  try {
    return getFeedStatus();
  } catch {
    return null;
  }
}

export default function SourcesPage() {
  const feeds = loadFeeds();

  return (
    <section className="mx-auto w-full max-w-[900px]">
      <h1 className="page-title">Data sources</h1>
      <p className="mt-2 text-muted">Where every number comes from.</p>

      <div className="mt-6">
        {feeds === null ? (
          <ErrorState message="We could not load the data sources." />
        ) : feeds.length === 0 ? (
          <EmptyState title="No data sources found" />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {feeds.map((f) => {
              const info = FEED_INFO[f.feed];
              const cadence = f.cadence
                ? f.cadence.charAt(0).toUpperCase() + f.cadence.slice(1)
                : (info?.cadence ?? "Unknown");
              return (
                <li key={f.feed} className="card p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="section-title m-0">{info?.name ?? f.feed}</h2>
                    {f.status === "live" ? (
                      <LiveBadge label="Live" />
                    ) : (
                      <span className="inline-flex items-center rounded-[10px] border-[1.5px] border-line-strong bg-surface-2 px-[9px] text-[10.5px] font-extrabold uppercase leading-[18px] tracking-[0.06em] text-muted">
                        Cached
                      </span>
                    )}
                  </div>
                  <p className="mb-3 mt-2 text-muted">{info?.use ?? f.source}</p>
                  <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-3">
                    <div>
                      <dt className="font-bold text-muted">Updates</dt>
                      <dd className="m-0">{cadence}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-muted">Last refresh</dt>
                      <dd className="m-0">{fmtDateTime(f.fetchedAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-muted">Effective date</dt>
                      <dd className="m-0">{f.effectiveDate ?? "Not available"}</dd>
                    </div>
                  </dl>
                  <p className="mb-0 mt-2 text-[12.5px] text-muted">Source: {f.source}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 text-[13.5px] text-muted">
        Prices where the live NADAC cannot be compared per unit (for example albuterol is priced per gram) show the
        sample reference price instead.
      </p>

      <div className="mt-8 rounded-[16px] border-[1.5px] border-dashed border-line-strong bg-surface-2 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="section-title m-0">Sample member data</h2>
          <SampleBadge />
        </div>
        <p className="mb-0 mt-2 text-muted">
          This is a demo. Member purchase histories, inventory, other pharmacies&apos; commitments, supplier quotes and
          the bulk-tier assumptions are synthetic sample data. They are not real pharmacies or real offers.
        </p>
      </div>
    </section>
  );
}
