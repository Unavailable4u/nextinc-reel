// Small, synchronous, dependency-free hashes for cache keys (painted textures are cached by content hash, guide 02 rule 8).
// FNV-1a 32-bit. Not cryptographic: use it for keys, never for security.

export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 8 hex digits */
export const hashString = (text: string): string => fnv1a(text).toString(16).padStart(8, "0");

/** A stable string for any JSON-like value: object keys are sorted, so key order never changes the hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

export const hashObject = (value: unknown): string => hashString(stableStringify(value));
