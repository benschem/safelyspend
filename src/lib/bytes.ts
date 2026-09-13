/**
 * Byte-level primitives shared by the crypto modules.
 *
 * Separate from `utils.ts`, which is money, dates and cadence formatting —
 * domain helpers with no business knowing about `Uint8Array` offsets. Separate
 * from `envelope.ts` too: the codec is a specification of the wire format, and
 * a general-purpose helper exported from it reads as part of that format.
 */

/** Concatenate byte arrays into one new array. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
}
