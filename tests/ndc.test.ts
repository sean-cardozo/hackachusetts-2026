import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { isValidNdc, normalizeNdc } from "../lib/ndc";

const digits = (n: number) => fc.stringMatching(new RegExp(`^[0-9]{${n}}$`));

// A valid NDC in any of the dashed layouts (4-4-2, 5-3-2, 5-4-1, 5-4-2).
const dashedNdc = fc.oneof(
  fc.tuple(digits(4), digits(4), digits(2)).map((p) => p.join("-")),
  fc.tuple(digits(5), digits(3), digits(2)).map((p) => p.join("-")),
  fc.tuple(digits(5), digits(4), digits(1)).map((p) => p.join("-")),
  fc.tuple(digits(5), digits(4), digits(2)).map((p) => p.join("-")),
);

describe("normalizeNdc examples", () => {
  it("pads 4-4-2", () => expect(normalizeNdc("0002-3227-30")).toBe("00002322730"));
  it("pads 5-3-2", () => expect(normalizeNdc("59417-102-10")).toBe("59417010210"));
  it("pads 5-4-1", () => expect(normalizeNdc("12345-6789-1")).toBe("12345678901"));
  it("keeps 11 digits unchanged", () => expect(normalizeNdc("00093715398")).toBe("00093715398"));
  it("ignores spaces around the text", () => expect(normalizeNdc(" 59417-102-10 ")).toBe("59417010210"));
});

describe("normalizeNdc errors (it throws)", () => {
  const bad = ["", "abc", "1234567890", "123456789012", "12345-67-89", "12345-6789", "1234-5678-9a", "12-3456-78"];
  for (const text of bad) {
    it(`rejects "${text}"`, () => {
      expect(() => normalizeNdc(text)).toThrow();
      expect(isValidNdc(text)).toBe(false);
    });
  }
});

describe("normalizeNdc properties", () => {
  it("always returns exactly 11 digits for a valid dashed NDC", () => {
    fc.assert(fc.property(dashedNdc, (ndc) => /^\d{11}$/.test(normalizeNdc(ndc))));
  });

  it("normalizing twice gives the same result", () => {
    fc.assert(
      fc.property(dashedNdc, (ndc) => {
        const once = normalizeNdc(ndc);
        return normalizeNdc(once) === once;
      }),
    );
  });

  it("11 digits in gives the same 11 digits out", () => {
    fc.assert(fc.property(digits(11), (ndc) => normalizeNdc(ndc) === ndc));
  });
});
