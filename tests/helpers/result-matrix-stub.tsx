"use client";

import { LangProvider } from "@/components/lang-provider";
import { ResultsMatrix } from "@/components/results-matrix";
import { NSP_POST_MATRIC, runChecks } from "@/lib/rules";
import { PACKETS } from "@/lib/fixtures";

const packet = PACKETS.find((candidate) => candidate.id === "bank-name-mismatch") ?? PACKETS[0];
const findings = runChecks(packet.documents, NSP_POST_MATRIC, { asOf: "2026-10-31" });

export function ResultMatrixStub() {
  return (
    <LangProvider>
      <ResultsMatrix
        findings={findings}
        uploaded={packet.documents.map((doc) => doc.docType)}
        onOpen={() => {}}
      />
    </LangProvider>
  );
}
