import { describe, expect, it } from "vitest";
import { compareDob, formatIndianDate, monthsBetweenIso, parseIndianDate } from "@/lib/match/dob";

describe("parseIndianDate", () => {
  it("parses DD/MM/YYYY under the Indian convention", () => {
    expect(parseIndianDate("12/03/2004")?.iso).toBe("2004-03-12");
    expect(parseIndianDate("01-09-1999")?.iso).toBe("1999-09-01");
  });

  it("parses ISO input as year first", () => {
    expect(parseIndianDate("2004-03-12")?.iso).toBe("2004-03-12");
  });

  it("parses DD Mon YYYY", () => {
    expect(parseIndianDate("12 Mar 2004")?.iso).toBe("2004-03-12");
    expect(parseIndianDate("12 March 2004")?.iso).toBe("2004-03-12");
    expect(parseIndianDate("3 Sept 2001")?.iso).toBe("2001-09-03");
  });

  it("marks genuinely ambiguous dates", () => {
    expect(parseIndianDate("12/03/2004")?.swapped).toEqual({ day: 3, month: 12, year: 2004 });
    expect(parseIndianDate("25/03/2004")?.swapped).toBeNull();
  });

  it("falls back to MM/DD only when DD/MM is impossible", () => {
    expect(parseIndianDate("03/25/2004")?.iso).toBe("2004-03-25");
  });

  it("handles a year on its own", () => {
    const parsed = parseIndianDate("2004");
    expect(parsed?.yearOnly).toBe(true);
    expect(parsed?.year).toBe(2004);
  });

  it("rejects impossible dates", () => {
    expect(parseIndianDate("31/02/2004")).toBeNull();
    expect(parseIndianDate("not a date")).toBeNull();
    expect(parseIndianDate(null)).toBeNull();
  });
});

describe("compareDob", () => {
  it("12/03/2004 vs 03/12/2004 → WARNING (DOB_SWAPPED)", () => {
    const result = compareDob("12/03/2004", "03/12/2004");
    expect(result.status).toBe("WARNING");
    expect(result.mismatchType).toBe("DOB_SWAPPED");
  });

  it("12/03/2004 vs 12/03/2003 → CRITICAL (DOB_DIFFERENT)", () => {
    const result = compareDob("12/03/2004", "12/03/2003");
    expect(result.status).toBe("CRITICAL");
    expect(result.mismatchType).toBe("DOB_DIFFERENT");
  });

  it("treats the same date in different formats as a match", () => {
    expect(compareDob("12/03/2004", "2004-03-12").status).toBe("MATCH");
    expect(compareDob("12-03-2004", "12/03/2004").status).toBe("MATCH");
    expect(compareDob("12 Mar 2004", "12/03/2004").status).toBe("MATCH");
  });

  it("marks a year-only value as UNVERIFIABLE (DOB_PARTIAL)", () => {
    const result = compareDob("2004", "2004");
    expect(result.status).toBe("UNVERIFIABLE");
    expect(result.mismatchType).toBe("DOB_PARTIAL");
    expect(result.partial).toBe(true);
  });

  it("flags a different year even when one side is year-only", () => {
    expect(compareDob("2004", "12/03/2005").status).toBe("CRITICAL");
  });

  it("returns UNVERIFIABLE when a value is missing", () => {
    expect(compareDob(null, "12/03/2004").status).toBe("UNVERIFIABLE");
    expect(compareDob("12/03/2004", null).mismatchType).toBe("UNREADABLE");
  });

  it("is symmetric", () => {
    for (const [a, b] of [
      ["12/03/2004", "03/12/2004"],
      ["12/03/2004", "12/03/2003"],
      ["2004", "12/03/2004"],
    ]) {
      expect(compareDob(a, b).status).toBe(compareDob(b, a).status);
    }
  });
});

describe("date helpers", () => {
  it("formats for humans", () => {
    expect(formatIndianDate("2004-03-12")).toBe("12 Mar 2004");
    expect(formatIndianDate(null)).toBeNull();
  });

  it("counts months", () => {
    expect(monthsBetweenIso("2024-01-15", "2025-01-15")).toBe(12);
    expect(monthsBetweenIso("2024-01-15", "2024-07-14")).toBe(6); // calendar months
  });
});
