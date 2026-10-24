import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { POST } from "../app/api/ai/[task]/route";
import { AI_TASKS, aiResultSchema, runAiTask } from "../lib/ai";
import { loadQuotes } from "../lib/sample";
import type { AiTask } from "../lib/types";

// ---------------------------------------------------------------------------
// Setup: no key, and a global fetch that fails the test if it is ever called.
// ---------------------------------------------------------------------------

const fetchSpy = vi.fn(() => {
  throw new Error("fetch must not be called when no AI key is set");
});

beforeEach(() => {
  vi.stubEnv("AI_API_KEY", "");
  vi.stubEnv("AI_MODEL", "");
  vi.stubEnv("AI_BASE_URL", "");
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Valid sample bodies, built inline
// ---------------------------------------------------------------------------

const demoHeaders = ["Drug Desc", "Str.", "NDC#", "Pkg Sz", "Qty/Mo", "Cost Ea", "Vendor", "Notes"];

const columnMapBody = { headers: demoHeaders };

const drugMatchBody = {
  rows: [
    { rowIndex: 0, drugName: "Atorvastatin", strength: "20 mg" },
    { rowIndex: 1, drugName: "Lisinopril 10mg" },
    { rowIndex: 2, drugName: "Zzzxq unknown thing" },
  ],
  catalog: [
    { id: "atorvastatin-20", name: "Atorvastatin", strength: "20 mg", form: "Tablet" },
    { id: "lisinopril-10", name: "Lisinopril", strength: "10 mg", form: "Tablet" },
    { id: "metformin-500", name: "Metformin", strength: "500 mg", form: "Tablet" },
  ],
};

function supplierReasonBody() {
  const q = loadQuotes();
  return { quotes: q.quotes, demand: q.groupDemand, weights: q.defaultWeights, userShare: q.yourShare };
}

const rfqBody = {
  items: [
    { product: "Metformin 500 mg", units: 2_520_000 },
    { product: "Levothyroxine 50 mcg", units: 1_116_000 },
  ],
  pharmacies: 12,
  region: "Massachusetts",
  cadence: "weekly",
};

const askSources = {
  drugs: "Sample member data",
  benchmarks: "CMS NADAC, effective 2026-10-22",
  quotes: "Sample supplier quotes",
  shortages: "openFDA drug shortages",
};

const askContext = {
  drugs: [
    { id: "atorvastatin-20", drugName: "Atorvastatin", strength: "20 mg", paid: 0.12, unitsPerMonth: 3000, onHand: 1500 },
    { id: "lisinopril-10", drugName: "Lisinopril", strength: "10 mg", paid: 0.03, unitsPerMonth: 4000, onHand: 9000 },
  ],
  benchmarks: [
    { drugId: "atorvastatin-20", nadac: 0.09 },
    { drugId: "lisinopril-10", nadac: 0.025 },
  ],
  sources: askSources,
};

const askBody = (question: string) => ({ question, context: askContext });

const validBodies: Record<AiTask, () => unknown> = {
  "column-map": () => columnMapBody,
  "drug-match": () => drugMatchBody,
  "supplier-reason": supplierReasonBody,
  rfq: () => rfqBody,
  ask: () => askBody("Why is my atorvastatin price high?"),
};

function post(task: string, body: unknown, rawText?: string): Promise<Response> {
  const request = new Request(`http://localhost/api/ai/${task}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawText ?? JSON.stringify(body),
  });
  return POST(request, { params: { task } });
}

async function postOk(task: string, body: unknown) {
  const res = await post(task, body);
  expect(res.status).toBe(200);
  return (await res.json()) as {
    task: string;
    result: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    confidence: number;
    source: string;
    sourceNote: string;
  };
}

// ---------------------------------------------------------------------------
// 1. Every task returns a fallback result with no key
// ---------------------------------------------------------------------------

describe("route: every task returns a valid fallback result with no key", () => {
  for (const task of AI_TASKS) {
    it(`${task}: 200, valid AiResult, source fallback`, async () => {
      const res = await post(task, validBodies[task]());
      expect(res.status).toBe(200);
      const json = await res.json();
      const parsed = aiResultSchema.parse(json);
      expect(parsed.task).toBe(task);
      expect(parsed.source).toBe("fallback");
      expect(parsed.sourceNote.length).toBeGreaterThan(0);
      expect(parsed.confidence).toBeGreaterThanOrEqual(0);
      expect(parsed.confidence).toBeLessThanOrEqual(100);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }

  // Feature: poolrx-backend, Property 6: AI fallback
  // **Validates: Requirements 5.4**
  it("Property 6: AI fallback. Any valid body for any task gives a fallback AiResult", async () => {
    const questions = [
      "Why is my atorvastatin price high?",
      "What will run out first?",
      "Which supplier do you recommend?",
      "What is the weather in Boston?",
    ];
    const bodyArb: fc.Arbitrary<[AiTask, unknown]> = fc.oneof(
      fc
        .subarray(demoHeaders, { minLength: 1 })
        .map((headers): [AiTask, unknown] => ["column-map", { headers }]),
      fc
        .array(fc.constantFrom("Atorvastatin", "Lisinopril 10mg", "metfromin", "???"), { minLength: 0, maxLength: 5 })
        .map((names): [AiTask, unknown] => [
          "drug-match",
          { ...drugMatchBody, rows: names.map((drugName, rowIndex) => ({ rowIndex, drugName })) },
        ]),
      fc
        .record({
          wa: fc.integer({ min: 1, max: 100 }),
          wb: fc.integer({ min: 1, max: 100 }),
          wc: fc.integer({ min: 1, max: 100 }),
        })
        .map(({ wa, wb, wc }): [AiTask, unknown] => [
          "supplier-reason",
          { ...(supplierReasonBody() as object), weights: { price: wa, delivery: wb, reliability: wc } },
        ]),
      fc
        .record({
          units: fc.integer({ min: 1, max: 5_000_000 }),
          pharmacies: fc.integer({ min: 1, max: 500 }),
          cadence: fc.constantFrom("weekly", "monthly", "every two weeks"),
        })
        .map(({ units, pharmacies, cadence }): [AiTask, unknown] => [
          "rfq",
          { items: [{ product: "Metformin 500 mg", units }], pharmacies, cadence },
        ]),
      fc.constantFrom(...questions).map((q): [AiTask, unknown] => ["ask", askBody(q)]),
    );

    await fc.assert(
      fc.asyncProperty(bodyArb, async ([task, body]) => {
        const res = await post(task, body);
        expect(res.status).toBe(200);
        const parsed = aiResultSchema.parse(await res.json());
        expect(parsed.task).toBe(task);
        expect(parsed.source).toBe("fallback");
        expect(parsed.sourceNote.length).toBeGreaterThan(0);
        expect(parsed.confidence).toBeGreaterThanOrEqual(0);
        expect(parsed.confidence).toBeLessThanOrEqual(100);
      }),
      { numRuns: 40 },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Invalid requests
// ---------------------------------------------------------------------------

describe("route: invalid requests", () => {
  const badBodies: [string, string, unknown][] = [
    ["column-map", "missing headers", {}],
    ["column-map", "headers is a string", { headers: "Drug Desc" }],
    ["column-map", "headers has a number", { headers: ["a", 5] }],
    ["drug-match", "missing catalog", { rows: [] }],
    ["drug-match", "row without drugName", { rows: [{ rowIndex: 0 }], catalog: [] }],
    ["supplier-reason", "empty quotes", { quotes: [], demand: {} }],
    ["supplier-reason", "unknown supplier letter", {
      quotes: [{ supplier: "Z", prices: {}, deliveryDays: 1, reliability: 50 }],
      demand: {},
    }],
    ["rfq", "missing items", { pharmacies: 3 }],
    ["rfq", "pharmacies is a string", { items: [{ product: "X", units: 5 }], pharmacies: "3" }],
    ["rfq", "extra price field", { ...rfqBody, price: 0.02 }],
    ["rfq", "extra pharmacyName field", { ...rfqBody, pharmacyName: "Decoy Pharmacy" }],
    ["rfq", "price inside an item", { ...rfqBody, items: [{ product: "X", units: 5, price: 1 }] }],
    ["ask", "missing context", { question: "hi" }],
    ["ask", "empty question", { question: "  ", context: askContext }],
    ["ask", "context with pharmacyName", { question: "hi", context: { ...askContext, pharmacyName: "Decoy" } }],
    ["ask", "drug with pharmacyName", {
      question: "hi",
      context: { ...askContext, drugs: [{ ...askContext.drugs[0], pharmacyName: "Decoy" }] },
    }],
  ];

  for (const [task, label, body] of badBodies) {
    it(`${task}: 400 for ${label}`, async () => {
      const res = await post(task, body);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(typeof json.error).toBe("string");
      expect(Array.isArray(json.issues)).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }

  it("400 for text that is not JSON", async () => {
    const res = await post("rfq", undefined, "this is not json {");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body must be valid JSON." });
  });

  it("400 for an empty body", async () => {
    const res = await post("ask", undefined, "");
    expect(res.status).toBe(400);
  });

  it("404 for an unknown task (not 400)", async () => {
    const res = await post("make-coffee", {});
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
  });

  it("413 for a body over 1 MB", async () => {
    const res = await post("ask", undefined, JSON.stringify({ question: "x".repeat(1_100_000) }));
    expect(res.status).toBe(413);
  });
});

// ---------------------------------------------------------------------------
// 3. rfq fallback text
// ---------------------------------------------------------------------------

describe("rfq fallback", () => {
  it("has the products, the pharmacy count, region and cadence, and no price, stock or pharmacy name", async () => {
    const json = await postOk("rfq", rfqBody);
    const text: string = json.result.text;
    expect(text).toContain("Metformin 500 mg");
    expect(text).toContain("Levothyroxine 50 mcg");
    expect(text).toContain("12");
    expect(text).toContain("Massachusetts");
    expect(text).toContain("weekly");
    expect(text).not.toContain("$");
    expect(text).not.toMatch(/\bstock\b/i);
  });

  it("never contains a decoy pharmacy name (the body is rejected before it can leak)", async () => {
    const decoy = "Zebra Corner Pharmacy 4471";
    const rejected = await post("rfq", { ...rfqBody, pharmacyName: decoy });
    expect(rejected.status).toBe(400);
    expect(JSON.stringify(await rejected.json())).not.toContain("Zebra Corner");

    const json = await postOk("rfq", { ...rfqBody, region: "Massachusetts" });
    expect(JSON.stringify(json)).not.toContain("Zebra Corner");
    expect(JSON.stringify(json)).not.toContain("4471");
  });

  it("uses Massachusetts and weekly by default and combines duplicate products", async () => {
    const json = await postOk("rfq", {
      items: [
        { product: "Metformin", units: 100 },
        { product: "metformin", units: 50 },
      ],
      pharmacies: 1,
    });
    const text: string = json.result.text;
    expect(text).toContain("Massachusetts");
    expect(text).toContain("weekly");
    expect(text).toContain("150 units");
    expect(text.match(/Metformin/gi)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 4. supplier-reason fallback
// ---------------------------------------------------------------------------

describe("supplier-reason fallback", () => {
  it("is exactly two sentences and names Supplier B for the real quotes", async () => {
    const json = await postOk("supplier-reason", supplierReasonBody());
    const reason: string = json.result.reason;
    expect(json.result.supplier).toBe("B");
    expect(reason).toContain("Supplier B");
    expect((reason.match(/[.!?](?=\s|$)/g) ?? []).length).toBe(2);
    expect(json.result.scores).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 5. ask fallback
// ---------------------------------------------------------------------------

describe("ask fallback", () => {
  it("says it cannot answer an out-of-scope question", async () => {
    const json = await postOk("ask", askBody("What is the weather in Boston?"));
    expect(json.result.answer).toBe("I can't answer that from the data provided.");
    expect(json.result.sources).toEqual([]);
  });

  it("cites the context sources for the atorvastatin price question", async () => {
    const json = await postOk("ask", askBody("Why is my atorvastatin price high?"));
    const { answer, sources } = json.result;
    expect(answer).toContain("Atorvastatin");
    expect(answer).toContain(askSources.drugs);
    expect(answer).toContain(askSources.benchmarks);
    expect(sources).toEqual(expect.arrayContaining([askSources.drugs, askSources.benchmarks]));
    expect(sources.every((s: string) => Object.values(askSources).includes(s))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Model path (runAiTask with injected env and fetch)
// ---------------------------------------------------------------------------

describe("runAiTask with a key", () => {
  const KEY = "test-key";
  const env = { AI_API_KEY: KEY, AI_MODEL: "test-model" };
  const RAW = "RAW-MODEL-REPLY-MARKER";

  const modelReply = (payload: unknown) =>
    new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(payload) }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const goodRfqText =
    "Request for quotation. A buying group of 12 pharmacies in Massachusetts asks for weekly deliveries of " +
    "Metformin 500 mg (2,520,000 units) and Levothyroxine 50 mcg (1,116,000 units).";

  it("returns source ai when the model reply is valid", async () => {
    const fake = vi.fn(async () => modelReply({ result: { text: goodRfqText }, confidence: 91 }));
    const res = await runAiTask("rfq", rfqBody, { env, fetch: fake as unknown as typeof fetch });
    expect(fake).toHaveBeenCalledTimes(1);
    expect(res.source).toBe("ai");
    expect(res.confidence).toBe(91);
    expect((res.result as { text: string }).text).toBe(goodRfqText);
    expect(JSON.stringify(res)).not.toContain(KEY);
    expect(aiResultSchema.safeParse(res).success).toBe(true);
    // the key goes in a header only, never in the request body
    const [, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).not.toContain(KEY);
  });

  const failures: [string, () => typeof fetch, number | undefined][] = [
    ["HTTP 500", () => (async () => new Response(`${RAW} boom`, { status: 500 })) as unknown as typeof fetch, undefined],
    ["fetch throws", () => (async () => { throw new Error(`network down ${RAW} ${KEY}`); }) as unknown as typeof fetch, undefined],
    ["fetch never resolves (timeout)", () => (() => new Promise(() => {})) as unknown as typeof fetch, 20],
    [
      "reply fails the schema",
      () => (async () => modelReply({ result: { wrong: RAW }, confidence: "high" })) as unknown as typeof fetch,
      undefined,
    ],
    [
      "reply is not JSON",
      () => (async () =>
        new Response(JSON.stringify({ content: [{ type: "text", text: `${RAW} not json` }] }), { status: 200 })) as unknown as typeof fetch,
      undefined,
    ],
    [
      "reply fails the data check (no region)",
      () => (async () => modelReply({ result: { text: `${RAW} hello` }, confidence: 99 })) as unknown as typeof fetch,
      undefined,
    ],
  ];

  for (const [label, makeFetch, timeoutMs] of failures) {
    it(`falls back when ${label}`, async () => {
      const res = await runAiTask("rfq", rfqBody, { env, fetch: makeFetch(), timeoutMs });
      expect(res.source).toBe("fallback");
      expect(aiResultSchema.safeParse(res).success).toBe(true);
      expect(res.sourceNote.length).toBeGreaterThan(0);
      expect(res.sourceNote).not.toContain(KEY);
      expect(res.sourceNote).not.toContain(RAW);
      const text = JSON.stringify(res);
      expect(text).not.toContain(KEY);
      expect(text).not.toContain(RAW);
      // still the real rule-based RFQ
      expect((res.result as { text: string }).text).toContain("Massachusetts");
    });
  }

  it("runAiTask with env {} never calls the injected fetch", async () => {
    const fake = vi.fn();
    for (const task of AI_TASKS) {
      const res = await runAiTask(task, validBodies[task](), { env: {}, fetch: fake as unknown as typeof fetch });
      expect(res.source).toBe("fallback");
    }
    expect(fake).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
