import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { formatDollars, formatPercent, formatSavings } from "../lib/format";

describe("formatDollars", () => {
  it("uses full dollars below $1,000", () => {
    expect(formatDollars(0)).toBe("$0");
    expect(formatDollars(612)).toBe("$612");
    expect(formatDollars(999.4)).toBe("$999");
  });

  it("uses k with one decimal for thousands", () => {
    expect(formatDollars(1000)).toBe("$1.0k");
    expect(formatDollars(23_300)).toBe("$23.3k");
    expect(formatDollars(4_370)).toBe("$4.4k");
  });

  it("uses M with one decimal for millions", () => {
    expect(formatDollars(1_200_000)).toBe("$1.2M");
    expect(formatDollars(4_300_000)).toBe("$4.3M");
  });

  it("rolls over at unit boundaries", () => {
    expect(formatDollars(999.6)).toBe("$1.0k");
    expect(formatDollars(999_960)).toBe("$1.0M");
  });

  it("handles negatives and non-finite values", () => {
    expect(formatDollars(-23_300)).toBe("-$23.3k");
    expect(formatDollars(NaN)).toBe("—");
    expect(formatDollars(Infinity)).toBe("—");
  });

  it("can print full dollars", () => {
    expect(formatDollars(23_300, { compact: false })).toBe("$23,300");
  });
});

describe("formatPercent", () => {
  it("formats with one decimal by default", () => {
    expect(formatPercent(11.2)).toBe("11.2%");
    expect(formatPercent(7)).toBe("7.0%");
    expect(formatPercent(-0.04)).toBe("0.0%");
    expect(formatPercent(NaN)).toBe("—");
  });
});

describe("formatSavings", () => {
  it("produces the pair pattern", () => {
    expect(formatSavings(23_300, 11.2)).toBe("$23.3k/yr (11.2%)");
    expect(formatSavings(450, 8)).toBe("$450/yr (8.0%)");
    expect(formatSavings(1_250_000, 10.4)).toBe("$1.3M/yr (10.4%)");
  });

  it("omits the percent when not given", () => {
    expect(formatSavings(23_300)).toBe("$23.3k/yr");
  });

  it("never contains color markup", () => {
    expect(formatSavings(23_300, 11.2)).not.toMatch(/[<>#]|color/i);
  });
});

describe("format properties", () => {
  it("formatDollars always returns a $-prefixed string or the n/a dash for finite input", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e9, max: 1e9, noNaN: true }), (n) => {
        expect(formatDollars(n)).toMatch(/^-?\$\d+(\.\d)?[kM]?$/);
      }),
    );
  });
});
