/** Public surface of the deterministic matching engine (pure, no I/O). */
export { MATCH_CONFIG, HONORIFICS, ABBREVIATIONS } from "./config";
export { compareNames, scoreTokenPair } from "./name";
export { compareDob, parseIndianDate, formatIndianDate, monthsBetweenIso } from "./dob";
export { compareAddress, extractPin, addressTokens } from "./address";
export { checkValidity, certificateAgeMonths } from "./validity";
export { jaro, jaroWinkler, jaccard } from "./similarity";
export { phoneticKeys, phoneticallyEqual } from "./phonetic";
export {
  detectScript,
  normalizeUnicode,
  stripDiacritics,
  toScriptText,
  tokenizeName,
  transliterateDevanagari,
} from "./text";
export * from "./types";
