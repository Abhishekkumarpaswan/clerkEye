import { describe, expect, it } from "vitest";
import { addressTokens, compareAddress, extractPin } from "@/lib/match/address";

describe("extractPin", () => {
  it("finds a 6-digit PIN", () => {
    expect(extractPin("H.No 42, Near Bus Stand, Kurukshetra, Haryana 136118")).toBe("136118");
  });

  it("returns null when no PIN is printed", () => {
    expect(extractPin("Village Rampur, Haryana")).toBeNull();
    expect(extractPin(null)).toBeNull();
  });
});

describe("addressTokens", () => {
  it("drops stopwords, the PIN and weak tokens", () => {
    expect(addressTokens("H.No 42, Near Bus Stand, Kurukshetra, Haryana 136118 India")).toEqual([
      "42",
      "bus",
      "stand",
      "kurukshetra",
      "haryana",
    ]);
  });
});

describe("compareAddress", () => {
  it("same PIN and similar wording → MATCH", () => {
    const result = compareAddress(
      { value: "H.No 42, Near Bus Stand, Kurukshetra, Haryana 136118", script: "latin" },
      "House 42, Bus Stand Road, Kurukshetra, Haryana - 136118",
    );
    expect(result.status).toBe("MATCH");
    expect(result.pinA).toBe("136118");
  });

  it("different PIN → WARNING (never CRITICAL)", () => {
    const result = compareAddress(
      "H.No 42, Kurukshetra, Haryana 136118",
      "H.No 42, Kurukshetra, Haryana 136119",
    );
    expect(result.status).toBe("WARNING");
    expect(result.mismatchType).toBe("ADDRESS_VARIATION");
  });

  it("same PIN but different wording → WARNING", () => {
    const result = compareAddress(
      "Ward 7, Mohalla Pathanan, Thanesar, Kurukshetra 136118",
      "Sector 13, Panchkula 136118",
    );
    expect(result.status).toBe("WARNING");
  });

  it("a rule may raise the ceiling to CRITICAL", () => {
    const result = compareAddress("Kurukshetra 136118", "Bengaluru 560001", {
      maxSeverity: "CRITICAL",
    });
    expect(result.status).toBe("CRITICAL");
  });

  it("returns UNVERIFIABLE when an address is missing", () => {
    expect(compareAddress(null, "Kurukshetra 136118").status).toBe("UNVERIFIABLE");
    expect(compareAddress("Kurukshetra 136118", "").status).toBe("UNVERIFIABLE");
  });
});
