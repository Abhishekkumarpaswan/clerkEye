import nspPostMatricJson from "@/schemes/nsp-post-matric.json";
import { SchemeSchema, type Scheme } from "./types";

/**
 * Load and validate a scheme file. Anything malformed fails loudly at import
 * time rather than producing silently wrong findings.
 */
export function loadScheme(raw: unknown): Scheme {
  return SchemeSchema.parse(raw);
}

/** The one scheme profile shipped in v1 (SPEC.md §4). */
export const NSP_POST_MATRIC: Scheme = loadScheme(nspPostMatricJson);

export const SCHEMES: Record<string, Scheme> = {
  [NSP_POST_MATRIC.scheme]: NSP_POST_MATRIC,
};

export function getScheme(id: string): Scheme | null {
  return SCHEMES[id] ?? null;
}

export { runChecks, summariseFindings, findFinding } from "./engine";
export * from "./types";
