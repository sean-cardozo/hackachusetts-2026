# Structure

```
/pipeline        fetch + consolidate public data (TypeScript, run with tsx)
/data            generated JSON (committed so the UI works without running the pipeline)
/src/types.ts    shared data contract (the single source of truth for both sides)
/src/lib         pure domain logic
    matching.ts    match uploaded lines to products
    benchmark.ts   compare paid price to NADAC, compute overpayment
    pooling.ts     pooled demand, tier progress, request for quotes, award
    split.ts       split a purchase order per chain, savings
    ndc.ts         normalize any NDC to 11 digits
/src/screens     UI (React)
/tests           Vitest + fast-check tests
/.kiro           specs and steering (must be in the repo root)
```

## Who builds what
- Sean: `/pipeline`, `/data` (real benchmark and catalog data), `/src/lib`, and the backend logic.
- Nathan: the synthetic member data (5 anonymized chains A to E, purchases and stock) and the UI in `/src/screens`.
- The contract between them is `/src/types.ts`. Neither side changes it without telling the other.
- Synthetic data is generated into `/data` using the same types as everything else, and is priced from real NADAC numbers.
