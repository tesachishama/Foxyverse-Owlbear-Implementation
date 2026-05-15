/**
 * Shared text normalization for parsers that must match user input case-insensitively
 * (dice roll type aliases, equipment slot tokens, FR/EN names).
 *
 * See: docs/CODEBASE.md#supporting-modules
 */

/** Strip combining diacritics when possible; ASCII fallback in older runtimes. */
export function stripDiacritics(text) {
  const s = String(text ?? "");
  try {
    return s.normalize("NFD").replace(/\p{Diacritic}+/gu, "");
  } catch (_) {
    return s
      .replace(/[éèêë]/gi, "e")
      .replace(/[àâä]/gi, "a")
      .replace(/[îï]/gi, "i")
      .replace(/[ôö]/gi, "o")
      .replace(/[ùûü]/gi, "u")
      .replace(/[ç]/gi, "c");
  }
}

/** Lowercase key for maps: trim + diacritic fold. */
export function normalizeKey(text) {
  return stripDiacritics(text).trim().toLowerCase();
}
