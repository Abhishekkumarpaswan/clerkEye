import { differenceInCalendarMonths, isValid } from "date-fns";
import { toScriptText } from "./text";
import type { DateComparison, FieldLike } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export type ParsedDate = {
  /** Best interpretation under the Indian DD/MM convention. */
  day: number;
  month: number;
  year: number;
  /** Alternative (day/month swapped) reading, only for ambiguous numeric input. */
  swapped: { day: number; month: number; year: number } | null;
  /** True when only a year was printed (e.g. "2004", "2004-—"). */
  yearOnly: boolean;
  iso: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIso(day: number, month: number, year: number): string {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function valid(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Parse the four date shapes that appear on Indian certificates:
 * `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, `DD Mon YYYY`.
 * Also tolerates `.` and `,` separators and years printed alone.
 */
export function parseIndianDate(input: string | null | undefined): ParsedDate | null {
  if (!input) return null;
  const raw = input.normalize("NFKC").trim().replace(/[.,]/g, "/").replace(/\s+/g, " ");
  if (!raw) return null;

  // Year only.
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (!valid(1, 1, year)) return null;
    return { day: 1, month: 1, year, swapped: null, yearOnly: true, iso: toIso(1, 1, year) };
  }

  // 12 Mar 2004 / 12 March 2004
  const worded = raw.match(/^(\d{1,2})[\s/-]([A-Za-z]{3,9})[\s/-](\d{4})$/);
  if (worded) {
    const day = Number(worded[1]);
    const month = MONTHS[worded[2].toLowerCase().slice(0, 4)] ?? MONTHS[worded[2].toLowerCase().slice(0, 3)];
    const year = Number(worded[3]);
    if (!month || !valid(day, month, year)) return null;
    return { day, month, year, swapped: null, yearOnly: false, iso: toIso(day, month, year) };
  }

  // ISO first: yyyy-mm-dd
  const iso = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!valid(day, month, year)) return null;
    return { day, month, year, swapped: null, yearOnly: false, iso: toIso(day, month, year) };
  }

  // DD/MM/YYYY (Indian convention). When both parts are ≤ 12 the reading is
  // genuinely ambiguous, so keep the swapped interpretation for comparison.
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (!valid(day, month, year)) {
      // Fall back to MM/DD when the DD/MM reading is impossible (e.g. 03/25/2004).
      if (valid(month, day, year)) {
        return { day: month, month: day, year, swapped: null, yearOnly: false, iso: toIso(month, day, year) };
      }
      return null;
    }
    const ambiguous = day <= 12 && month <= 12 && day !== month && valid(month, day, year);
    return {
      day,
      month,
      year,
      swapped: ambiguous ? { day: month, month: day, year } : null,
      yearOnly: false,
      iso: toIso(day, month, year),
    };
  }

  return null;
}

/** Human-readable `12 Mar 2004` for the UI and for template explanations. */
export function formatIndianDate(iso: string | null): string | null {
  const parsed = parseIndianDate(iso);
  if (!parsed) return null;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  return isValid(date)
    ? `${pad(parsed.day)} ${Object.keys(MONTHS)[parsed.month - 1].replace(/^./, (c) => c.toUpperCase())} ${parsed.year}`
    : null;
}

/**
 * Compare two dates of birth (SPEC.md §11.3).
 * Equal → MATCH. Day/month swapped → WARNING. Year-only on either side →
 * UNVERIFIABLE. Anything else → CRITICAL.
 */
export function compareDob(a: FieldLike, b: FieldLike): DateComparison {
  const leftText = toScriptText(a).latin;
  const rightText = toScriptText(b).latin;
  const left = parseIndianDate(leftText);
  const right = parseIndianDate(rightText);

  const base: DateComparison = {
    status: "UNVERIFIABLE",
    mismatchType: null,
    reason: "",
    left: left?.iso ?? null,
    right: right?.iso ?? null,
    partial: false,
  };

  if (!left || !right) {
    return {
      ...base,
      mismatchType: "UNREADABLE",
      reason: !left && !right
        ? "Neither date could be read."
        : "One of the two dates could not be read, so it cannot be compared.",
    };
  }

  if (left.yearOnly || right.yearOnly) {
    if (left.year !== right.year) {
      return {
        ...base,
        status: "CRITICAL",
        mismatchType: "DOB_DIFFERENT",
        reason: `The years differ: ${left.year} and ${right.year}.`,
      };
    }
    const bothPartial = left.yearOnly && right.yearOnly;
    return {
      ...base,
      status: "UNVERIFIABLE",
      mismatchType: "DOB_PARTIAL",
      partial: true,
      reason: bothPartial
        ? "Only the year is legible on both documents, so the full date of birth cannot be confirmed."
        : "Only the year is legible on one document, so the full date of birth cannot be confirmed.",
    };
  }

  if (left.iso === right.iso) {
    return { ...base, status: "MATCH", reason: `Both documents show ${formatIndianDate(left.iso)}.` };
  }

  const swappedMatches =
    (right.swapped && toIso(right.swapped.day, right.swapped.month, right.swapped.year) === left.iso) ||
    (left.swapped && toIso(left.swapped.day, left.swapped.month, left.swapped.year) === right.iso);

  if (swappedMatches) {
    return {
      ...base,
      status: "WARNING",
      mismatchType: "DOB_SWAPPED",
      reason: `The day and month are written in a different order: ${formatIndianDate(left.iso)} and ${formatIndianDate(right.iso)}.`,
    };
  }

  return {
    ...base,
    status: "CRITICAL",
    mismatchType: "DOB_DIFFERENT",
    reason: `The dates of birth are different: ${formatIndianDate(left.iso)} and ${formatIndianDate(right.iso)}.`,
  };
}

/** Months between two ISO dates (b − a), used by the certificate validity check. */
export function monthsBetweenIso(fromIso: string, toIsoDate: string): number | null {
  const from = parseIndianDate(fromIso);
  const to = parseIndianDate(toIsoDate);
  if (!from || !to) return null;
  return differenceInCalendarMonths(
    new Date(Date.UTC(to.year, to.month - 1, to.day)),
    new Date(Date.UTC(from.year, from.month - 1, from.day)),
  );
}
