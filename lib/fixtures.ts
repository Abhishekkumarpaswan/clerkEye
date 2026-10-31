import { z } from "zod";
import bankNameMismatchJson from "@/fixtures/packets/bank-name-mismatch.json";
import cleanJson from "@/fixtures/packets/clean.json";
import nameAbbreviationJson from "@/fixtures/packets/name-abbreviation.json";
import { DocTypeSchema, ExtractedDocumentSchema, StatusSchema } from "@/lib/extract/schemas";

/**
 * Demo packets.
 *
 * Every value in these files is synthetic. They are what DEMO_MODE serves, so the
 * whole app works with no API key and no network. Each packet records the
 * statuses it is expected to produce; `tests/rules.test.ts` asserts them, which
 * keeps the demo honest.
 */

export const ExpectedFindingSchema = z.object({
  ruleId: z.string(),
  status: StatusSchema,
  documents: z.array(DocTypeSchema).optional(),
});

export const PacketSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  scheme: z.string(),
  images: z.partialRecord(DocTypeSchema, z.string()).default({}),
  documents: z.array(ExtractedDocumentSchema).min(1),
  expected: z.array(ExpectedFindingSchema).default([]),
});

export type Packet = z.infer<typeof PacketSchema>;
export type ExpectedFinding = z.infer<typeof ExpectedFindingSchema>;

export const PACKETS: Packet[] = [cleanJson, nameAbbreviationJson, bankNameMismatchJson].map(
  (raw) => PacketSchema.parse(raw),
);

/** The packet the "Try with sample packet" button loads (SPEC.md §19). */
export const DEFAULT_PACKET_ID = "bank-name-mismatch";

export function getPacket(id: string): Packet | null {
  return PACKETS.find((packet) => packet.id === id) ?? null;
}

export function packetDocument(packet: Packet, docType: string) {
  return packet.documents.find((doc) => doc.docType === docType) ?? null;
}

export const PACKET_IDS = PACKETS.map((packet) => packet.id);
