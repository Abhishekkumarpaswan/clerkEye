#!/usr/bin/env node
/**
 * Generate the four synthetic sample document images used by demo mode.
 *
 *   pnpm fixtures:images
 *
 * Everything drawn here is fake: invented names, invented numbers, and a big
 * "SAMPLE" banner. Never use this script to render a real document.
 *
 * SVG templates → PNG via sharp (SPEC.md §14.5). Output: fixtures/images/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "fixtures", "images");
// Next serves static assets from public/, so the same bytes are copied there for
// the demo previews. `fixtures/images` stays the source of truth for regeneration.
const PUBLIC_DIR = path.join(process.cwd(), "public", "fixtures");

const W = 900;
const H = 620;

const ink = "#1b1b1b";
const muted = "#5a5a5a";
const line = "#c9c9c9";
const accent = "#1f4e8c";

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function header(title, subtitle, accentColor = accent) {
  return `
    <rect x="0" y="0" width="${W}" height="86" fill="${accentColor}" />
    <text x="40" y="38" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${esc(title)}</text>
    <text x="40" y="66" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="#e6eef8">${esc(subtitle)}</text>
    <text x="${W - 40}" y="66" text-anchor="end" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" opacity="0.85">SAMPLE — NOT A REAL DOCUMENT</text>
  `;
}

function row(label, value, y, options = {}) {
  const valueColor = options.highlight ? accent : ink;
  const weight = options.bold ? "bold" : "normal";
  return `
    <text x="60" y="${y}" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="${muted}">${esc(label)}</text>
    <text x="330" y="${y}" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="${options.size ?? 20}" font-weight="${weight}" fill="${valueColor}">${esc(value)}</text>
    <line x1="60" y1="${y + 12}" x2="${W - 60}" y2="${y + 12}" stroke="${line}" stroke-width="1" />
  `;
}

function frame(inner, watermark = true) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#fdfcf8" />
    <rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="${line}" stroke-width="2" />
    ${inner}
    ${
      watermark
        ? `<text x="${W / 2}" y="${H - 40}" text-anchor="middle" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="13" fill="${muted}">ClerkEye demo packet · synthetic data · specimen only</text>`
        : ""
    }
  </svg>`;
}

const aadhaar = frame(`
  ${header("GOVERNMENT OF INDIA", "Aadhaar — specimen card", "#8a4b12")}
  <circle cx="130" cy="210" r="58" fill="#e8e2d6" stroke="${line}" stroke-width="2" />
  <text x="130" y="216" text-anchor="middle" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="13" fill="${muted}">PHOTO</text>
  <text x="230" y="176" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="${muted}">Name / नाम</text>
  <text x="230" y="204" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="22" font-weight="bold" fill="${ink}">Rajesh Kumar Verma</text>
  <text x="230" y="234" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="${muted}">राजेश कुमार वर्मा</text>
  <text x="230" y="272" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="${muted}">Date of Birth / जन्म तिथि</text>
  <text x="230" y="298" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="20" font-weight="bold" fill="${ink}">12/03/2004</text>
  <text x="230" y="334" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="${muted}">Gender / लिंग: Male</text>
  <text x="230" y="368" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${ink}">S/O Mohan Lal Verma</text>
  <text x="230" y="402" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="${muted}">Address / पता</text>
  <text x="230" y="426" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${ink}">H.No 42, Near Bus Stand, Thanesar,</text>
  <text x="230" y="450" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${ink}">Kurukshetra, Haryana</text>
  <text x="230" y="476" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${ink}">PIN 136118</text>
  <rect x="230" y="500" width="290" height="34" rx="4" fill="${ink}" />
  <text x="375" y="523" text-anchor="middle" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="#ffffff">Aadhaar number covered</text>
  <text x="560" y="523" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="13" fill="${muted}">(number hidden by the redaction tool)</text>
`);

const income = frame(`
  ${header("OFFICE OF THE TEHSILDAR, THANESAR", "Income certificate — specimen", "#1f5b3a")}
  <text x="60" y="130" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="15" fill="${muted}">Certificate No. SAMPLE/IC/2026/0042 (fictional)</text>
  <text x="60" y="158" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="15" fill="${muted}">Date of issue: 15/04/2026</text>
  <text x="60" y="196" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${ink}">This is to certify that the annual income of the family of</text>
  <text x="60" y="232" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="21" font-weight="bold" fill="${ink}">Rajesh Kumar Verma</text>
  <text x="60" y="262" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${ink}">S/O Mohan Lal Verma</text>
  <text x="60" y="292" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${ink}">Address: H.No 42, Near Bus Stand, Thanesar, Kurukshetra, Haryana — PIN 136118</text>
  <text x="60" y="328" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${ink}">is Rs. 96,000 (Rupees ninety-six thousand only) per year.</text>
  <text x="60" y="370" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="${muted}">This certificate is issued for scholarship purposes. Validity as per the issuing authority's rules.</text>
  <text x="60" y="440" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="14" fill="${muted}">Tehsildar, Thanesar (specimen signature)</text>
  <line x1="60" y1="455" x2="300" y2="455" stroke="${line}" stroke-width="1" />
`);

const marksheet = frame(`
  ${header("BOARD OF SCHOOL EDUCATION, HARYANA", "Secondary certificate — specimen", "#4b2a72")}
  <text x="60" y="128" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="15" fill="${muted}">Roll No. 1234567 (fictional) · Examination: March 2022</text>
  <text x="60" y="176" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="16" fill="${muted}">Name of candidate</text>
  <text x="330" y="176" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="21" font-weight="bold" fill="${ink}">Rajesh Kumar Verma</text>
  ${row("Father's name", "Mohan Lal Verma", 222)}
  ${row("Mother's name", "Sunita Devi Verma", 268)}
  ${row("Date of birth", "12 March 2004", 314)}
  ${row("School", "Govt. Sr. Sec. School, Thanesar", 360)}
  ${row("Result", "PASS — 468/500", 406, { highlight: true, bold: true })}
  <text x="60" y="470" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="13" fill="${muted}">Name as printed on the board record. Marks are illustrative.</text>
`);

const passbook = frame(`
  ${header("STATE BANK OF INDIA", "Savings bank passbook, first page — specimen branch", "#7a1f2b")}
  ${row("Account holder", "Rajesh Kumar Verma", 150, { bold: true })}
  ${row("Account number", "XXXXXXXX4821", 196)}
  ${row("IFSC", "SBIN0001234", 242)}
  ${row("Branch", "Thanesar, Kurukshetra", 288)}
  ${row("Address", "H.No 42, Near Bus Stand, Thanesar", 334)}
  ${row("Account opened", "02/07/2023", 380)}
  <text x="60" y="440" font-family="DejaVu Sans, Noto Sans Devanagari, Arial, sans-serif" font-size="13" fill="${muted}">Only the last four digits of the account number are shown, by design.</text>
`);

const images = [
  ["sample-aadhaar.png", aadhaar],
  ["sample-income.png", income],
  ["sample-marksheet.png", marksheet],
  ["sample-passbook.png", passbook],
];

await mkdir(OUT_DIR, { recursive: true });
await mkdir(PUBLIC_DIR, { recursive: true });
for (const [name, svg] of images) {
  const png = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await writeFile(path.join(OUT_DIR, name), png);
  await writeFile(path.join(PUBLIC_DIR, name), png);
  // Keep the SVG sources next to the PNGs so the images can be regenerated or
  // tweaked without touching this script.
  await writeFile(path.join(OUT_DIR, name.replace(/\.png$/, ".svg")), svg, "utf8");
  console.log(`wrote fixtures/images/${name} (${(png.length / 1024).toFixed(0)} kB)`);
}
