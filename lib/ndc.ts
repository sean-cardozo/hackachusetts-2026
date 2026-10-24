// NDC normalizer.
//
// openFDA writes NDCs with dashes in a 4-4-2, 5-3-2 or 5-4-1 layout.
// CMS NADAC writes them as 11 digits with no dashes (5-4-2).
// To compare the two we zero-pad the SHORT segment so everything ends up 5-4-2.
//
//   "0002-3227-30"  (4-4-2) -> "00002322730"
//   "59417-102-10"  (5-3-2) -> "59417010210"
//   "12345-6789-1"  (5-4-1) -> "12345678901"
//   "12345678901"   (11 digits) -> returned unchanged
//
// Error behavior: normalizeNdc THROWS an Error for anything it cannot place
// with certainty. That includes 10 digits with no dashes (we cannot tell which
// segment is short), wrong segment lengths, letters, and empty text.
// Use isValidNdc() if you would rather get a true/false answer.

const ELEVEN_DIGITS = /^\d{11}$/;
const DIGITS_ONLY = /^\d+$/;

// Allowed "labeler-product-package" digit counts for dashed NDCs.
const DASHED_SHAPES = ["4-4-2", "5-3-2", "5-4-1", "5-4-2"];

export function normalizeNdc(input: string): string {
  const text = String(input).trim();

  if (ELEVEN_DIGITS.test(text)) return text;

  const parts = text.split("-");
  if (parts.length === 3 && parts.every((p) => DIGITS_ONLY.test(p))) {
    const [labeler, product, pkg] = parts;
    const shape = `${labeler.length}-${product.length}-${pkg.length}`;
    if (DASHED_SHAPES.includes(shape)) {
      return labeler.padStart(5, "0") + product.padStart(4, "0") + pkg.padStart(2, "0");
    }
  }

  throw new Error(`Invalid NDC: "${input}"`);
}

export function isValidNdc(input: string): boolean {
  try {
    normalizeNdc(input);
    return true;
  } catch {
    return false;
  }
}
