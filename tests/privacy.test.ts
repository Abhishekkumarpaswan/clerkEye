import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  canSendForExtraction,
  containsLongNumber,
  containsTwelveDigitNumber,
  maskNumbers,
} from "@/lib/extract/guard";

const ROOT = process.cwd();
const SCANNED_DIRS = ["app", "components", "lib"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const SOURCES = SCANNED_DIRS.flatMap((dir) => walk(join(ROOT, dir)));

describe("no logging or storage of document data", () => {
  it("has no console calls in the app source", () => {
    const offenders = SOURCES.filter((file) =>
      /console\.(log|info|warn|error|debug)\s*\(/.test(readFileSync(file, "utf8")),
    );
    expect(offenders, "remove console calls: these could leak document data").toEqual([]);
  });

  it("uses no browser storage for data", () => {
    const offenders = SOURCES.filter((file) => {
      const source = readFileSync(file, "utf8");
      // Comments may mention these words; strip line comments before checking.
      const code = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
        .join("\n");
      return /localStorage|sessionStorage|document\.cookie|indexedDB|navigator\.sendBeacon/.test(
        code,
      );
    });
    expect(offenders).toEqual([]);
  });

  it("sends network requests only to its own routes", () => {
    const browserFiles = SOURCES.filter((file) => file.includes("components"));
    for (const file of browserFiles) {
      const source = readFileSync(file, "utf8");
      const urls = [...source.matchAll(/fetch\(\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]);
      for (const url of urls) {
        expect(url.startsWith("/api/"), `${file} calls ${url}`).toBe(true);
      }
    }
  });
});

describe("12-digit guard", () => {
  it("detects full Aadhaar numbers in different layouts", () => {
    expect(containsTwelveDigitNumber("1234 5678 9012")).toBe(true);
    expect(containsTwelveDigitNumber("123456789012")).toBe(true);
    expect(containsTwelveDigitNumber("1234-5678-9012")).toBe(false); // hyphens: not a 12-digit run
    expect(containsTwelveDigitNumber("PIN 136118")).toBe(false);
    expect(containsTwelveDigitNumber(null)).toBe(false);
  });

  it("masks numbers and keeps only the last four digits of long ones", () => {
    expect(maskNumbers("Aadhaar 1234 5678 9012")).toBe("Aadhaar •••• •••• ••••");
    expect(maskNumbers("A/c 50100234567890")).toBe("A/c ••••7890");
    expect(containsLongNumber("A/c 50100234567890")).toBe(true);
    expect(containsLongNumber("PIN 136118")).toBe(false);
  });

  it("blocks an Aadhaar card that has not been redacted", () => {
    expect(
      canSendForExtraction({ docType: "AADHAAR", redacted: false, demo: false, hasImage: true }),
    ).toEqual({ allowed: false, reason: "REDACT_FIRST" });

    expect(
      canSendForExtraction({ docType: "AADHAAR", redacted: true, demo: false, hasImage: true }),
    ).toEqual({ allowed: true });
  });

  it("allows other documents and sample packets", () => {
    expect(
      canSendForExtraction({ docType: "MARKSHEET", redacted: false, demo: false, hasImage: true }),
    ).toEqual({ allowed: true });
    expect(
      canSendForExtraction({ docType: "AADHAAR", redacted: false, demo: true, hasImage: false }),
    ).toEqual({ allowed: true });
  });

  it("refuses to send an empty image", () => {
    expect(
      canSendForExtraction({ docType: "MARKSHEET", redacted: true, demo: false, hasImage: false }),
    ).toEqual({ allowed: false, reason: "NO_IMAGE" });
  });
});

describe("demo fixtures contain no real numbers", () => {
  it("never stores a 12-digit number", () => {
    for (const name of readdirSync(join(ROOT, "fixtures", "packets"))) {
      const raw = readFileSync(join(ROOT, "fixtures", "packets", name), "utf8");
      expect(containsTwelveDigitNumber(raw), name).toBe(false);
    }
  });

  it("shows a sample banner on every generated image", () => {
    for (const name of readdirSync(join(ROOT, "fixtures", "images"))) {
      if (!name.endsWith(".svg")) continue;
      const svg = readFileSync(join(ROOT, "fixtures", "images", name), "utf8");
      expect(svg, name).toContain("SAMPLE");
    }
  });
});
