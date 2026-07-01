/**
 * Canonical JSON serialization (RFC 8785 / JCS subset).
 *
 * The signature must cover deterministic bytes, so both signer and verifier
 * must serialize the receipt identically regardless of key insertion order.
 * We implement the JCS essentials: object keys sorted lexicographically by
 * their UTF-16 code units, arrays kept in order, and JSON.stringify's standard
 * escaping/number formatting (sufficient for our receipt schema, which uses
 * only strings, safe integers, booleans, null, objects, and arrays).
 */

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [k: string]: Json };

function canonicalize(value: Json): string {
  if (value === null || typeof value !== "object") {
    // Primitives: rely on JSON.stringify. Reject non-finite / unsafe numbers
    // so a receipt can never serialize differently across platforms.
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Non-finite numbers are not allowed in a receipt.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalize(v)).join(",") + "]";
  }
  const keys = Object.keys(value).sort(); // lexicographic by code unit
  const entries = keys.map(
    (k) => JSON.stringify(k) + ":" + canonicalize(value[k]),
  );
  return "{" + entries.join(",") + "}";
}

/** Canonical UTF-8 bytes of a JSON value, ready to sign or verify. */
export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value as Json));
}
