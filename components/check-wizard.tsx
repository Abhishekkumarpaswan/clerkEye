"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileDownIcon,
  LoaderCircleIcon,
  PrinterIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { SiteHeader } from "@/components/site-header";
import { StepIndicator } from "@/components/step-indicator";
import { UploadCard } from "@/components/upload-card";
import { FieldsTable } from "@/components/fields-table";
import { RedactionCanvas } from "@/components/redaction-canvas";
import { ResultsMatrix, ResultsSummary } from "@/components/results-matrix";
import { FindingDetail } from "@/components/finding-detail";
import { FixCard } from "@/components/fix-card";
import { DeclarationTemplate } from "@/components/declaration-template";
import { PrintSheet } from "@/components/print-sheet";
import { LimitsBox } from "@/components/limits-box";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  canRunChecks,
  emptyEntry,
  readyEntries,
  withEditedField,
  type Step,
  type UploadEntry,
} from "@/lib/check-state";
import {
  prepareImage,
  preparePdfFirstPage,
  type PreparedImage,
} from "@/components/image-utils";
import { DOC_TYPES, type DocType, type FieldName, type ExtractionResponse } from "@/lib/extract/schemas";
import { checkUploadable } from "@/lib/extract/preprocess";
import { DEFAULT_PACKET_ID, PACKETS } from "@/lib/fixtures";
import { runChecks, summariseFindings, NSP_POST_MATRIC } from "@/lib/rules";
import { explainAll, type Explanation } from "@/lib/explain/templates";
import type { Finding } from "@/lib/rules/types";

const MAX_BYTES = 1_500_000;

/**
 * The four-step wizard (SPEC.md §15).
 *
 * All state lives in this component's memory. Nothing is written to storage, no
 * cookies, no analytics — a reload clears everything.
 */
export function CheckWizard({ autoLoadSample = false }: { autoLoadSample?: boolean }) {
  const { lang, t } = useLang();

  const [step, setStep] = useState<Step>("upload");
  const [entries, setEntries] = useState<UploadEntry[]>(() =>
    DOC_TYPES.map((docType) => emptyEntry(docType)),
  );
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const [redacting, setRedacting] = useState<DocType | null>(null);
  const [detail, setDetail] = useState<Finding | null>(null);
  const [llmText, setLlmText] = useState<{ signature: string; texts: Record<string, string> }>({
    signature: "",
    texts: {},
  });
  const [explainNote, setExplainNote] = useState<string | null>(null);
  const [institute, setInstitute] = useState("");
  const [sampleLoading, setSampleLoading] = useState(false);
  const loadedSample = useRef(false);

  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // ---- helpers -------------------------------------------------------------

  const updateEntry = useCallback((docType: DocType, patch: Partial<UploadEntry>) => {
    setEntries((previous) =>
      previous.map((entry) => (entry.docType === docType ? { ...entry, ...patch } : entry)),
    );
  }, []);

  const extract = useCallback(
    async (docType: DocType, image: PreparedImage | null, fixtureId: string | null) => {
      updateEntry(docType, {
        status: "reading",
        document: null,
        errorCode: null,
        fixtureId,
      });

      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docType,
            fixtureId,
            imageBase64: image?.base64 ?? null,
            mimeType: image?.mimeType ?? null,
          }),
        });

        const json = (await response.json()) as ExtractionResponse;

        if (!json.ok) {
          updateEntry(docType, { status: "error", errorCode: json.error.code });
          return;
        }

        updateEntry(docType, {
          status: "ready",
          document: json.document,
          demo: json.demo,
          fixtureId: json.fixtureId,
          editedFields: [],
        });
      } catch {
        updateEntry(docType, { status: "error", errorCode: "NETWORK" });
      }
    },
    [updateEntry],
  );

  const loadSample = useCallback(
    async (packetId: string = DEFAULT_PACKET_ID) => {
      const packet = PACKETS.find((candidate) => candidate.id === packetId) ?? PACKETS[0];
      loadedSample.current = true;
      setSampleLoading(true);
      setEntries(
        packet.documents.map((doc) => {
          const imageUrl = packet.images[doc.docType] ?? null;
          return {
            ...emptyEntry(doc.docType),
            // Sample documents are already redacted, so no redaction step is needed.
            previewUrl: imageUrl,
            redacted: true,
            fileName: packet.id,
            status: "reading" as const,
          };
        }),
      );

      await Promise.all(
        packet.documents.map((doc) => extract(doc.docType, null, packet.id)),
      );
      setSampleLoading(false);
    },
    [extract],
  );

  useEffect(() => {
    if (autoLoadSample && !loadedSample.current) {
      loadedSample.current = true;
      void loadSample(DEFAULT_PACKET_ID);
    }
  }, [autoLoadSample, loadSample]);

  // ---- upload --------------------------------------------------------------

  const handlePick = useCallback(
    async (docType: DocType, file: File) => {
      setUploadMessage(null);
      const check = checkUploadable(file, MAX_BYTES);
      if (!check.ok) {
        setUploadMessage(check.code === "FILE_TOO_LARGE" ? t("upload.tooLarge") : t("upload.wrongType"));
        return;
      }

      try {
        const prepared =
          file.type === "application/pdf" ? await preparePdfFirstPage(file) : await prepareImage(file);

        if (!prepared) {
          setUploadMessage(t("upload.wrongType"));
          return;
        }

        updateEntry(docType, {
          previewUrl: prepared.dataUrl,
          fileName: file.name,
          imageBase64: prepared.base64,
          mimeType: prepared.mimeType,
          redacted: docType !== "AADHAAR",
          demo: false,
          fixtureId: null,
        });

        await extract(docType, prepared, null);
      } catch {
        setUploadMessage(t("upload.error"));
        updateEntry(docType, { status: "error", errorCode: "PREPARE_FAILED" });
      }
    },
    [extract, t, updateEntry],
  );

  const handleRedacted = useCallback(
    async (docType: DocType, image: PreparedImage) => {
      updateEntry(docType, {
        previewUrl: image.dataUrl,
        imageBase64: image.base64,
        mimeType: image.mimeType,
        redacted: true,
      });
      await extract(docType, image, null);
    },
    [extract, updateEntry],
  );

  const handleRemove = useCallback((docType: DocType) => {
    setEntries((previous) =>
      previous.map((entry) => (entry.docType === docType ? emptyEntry(docType) : entry)),
    );
  }, []);

  // ---- confirm -------------------------------------------------------------

  const handleEdit = useCallback((docType: DocType, field: FieldName, value: string) => {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.docType === docType ? withEditedField(entry, field, value) : entry,
      ),
    );
  }, []);

  const ready = useMemo(() => readyEntries(entries), [entries]);
  const documents = useMemo(
    () => ready.map((entry) => entry.document!).filter(Boolean),
    [ready],
  );

  // ---- results -------------------------------------------------------------

  const asOf = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const findings = useMemo<Finding[]>(() => {
    if (step !== "results" && step !== "fix") return [];
    if (documents.length < 2) return [];
    // Matching never runs on unconfirmed values (SPEC.md §15).
    if (!confirmed) return [];
    return runChecks(documents, NSP_POST_MATRIC, { asOf });
  }, [step, documents, confirmed, asOf]);

  const counts = useMemo(() => summariseFindings(findings), [findings]);

  // Template explanations are always available, immediately. `/api/explain` may
  // replace them with friendlier wording; if it fails, nothing changes.
  const templateExplanations = useMemo<Explanation[]>(
    () => (findings.length > 0 ? explainAll(lang, findings) : []),
    [findings, lang],
  );

  const findingSignature = useMemo(
    () => findings.map((finding) => `${finding.rowKey}:${finding.status}`).join("|"),
    [findings],
  );

  const explanations = useMemo<Explanation[]>(
    () =>
      templateExplanations.map((explanation) => {
        const better =
          llmText.signature === findingSignature ? llmText.texts[explanation.ruleId] : undefined;
        return better ? { ...explanation, text: better, source: "llm" as const } : explanation;
      }),
    [templateExplanations, llmText, findingSignature],
  );

  useEffect(() => {
    if (findings.length === 0) return;
    let cancelled = false;

    async function requestExplanations() {
      try {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lang,
            findings: findings.map((finding) => ({
              ruleId: finding.rowKey,
              check: finding.check,
              status: finding.status,
              reason: finding.reason,
              leftValue: finding.left?.value ?? null,
              rightValue: finding.right?.value ?? null,
              mismatchType: finding.mismatchType,
              howToCheck: finding.howToCheck ?? null,
            })),
          }),
        });
        if (!response.ok) return;
        const json = (await response.json()) as {
          ok?: boolean;
          source?: string;
          explanations?: Array<{ ruleId: string; text: string }>;
        };
        if (cancelled || !json.ok || json.source !== "llm" || !json.explanations?.length) return;

        const texts: Record<string, string> = {};
        for (const item of json.explanations) texts[item.ruleId] = item.text;
        setLlmText({ signature: findingSignature, texts });
        setExplainNote(t("fix.explanationLlm"));
      } catch {
        // Templates stay in place: the app never depends on the explain route.
      }
    }

    void requestExplanations();
    return () => {
      cancelled = true;
    };
  }, [findings, lang, findingSignature, t]);

  const uploadable = canRunChecks(entries);

  const goToConfirm = () => {
    setStep("confirm");
    headingRef.current?.focus();
  };

  const goToResults = () => {
    if (!confirmed) {
      setConfirmError(true);
      return;
    }
    setConfirmError(false);
    setStep("results");
  };

  const startOver = () => {
    setEntries(DOC_TYPES.map((docType) => emptyEntry(docType)));
    setConfirmed(false);
    setStep("upload");
    setLlmText({ signature: "", texts: {} });
    setDetail(null);
    setInstitute("");
    loadedSample.current = false;
  };

  const applicantName =
    documents.find((doc) => doc.fields.applicantName?.value)?.fields.applicantName?.value ?? null;
  const fatherName =
    documents.find((doc) => doc.fields.fatherName?.value)?.fields.fatherName?.value ?? null;

  const explanationFor = (finding: Finding) =>
    explanations.find((explanation) => explanation.ruleId === finding.rowKey) ?? null;

  const dateLabel = new Date(asOf).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const actionable = findings.filter((finding) => finding.status !== "MATCH");
  const subtle = findings.filter((finding) => finding.status === "MATCH");

  const handleDownload = () => {
    const lines = [
      t("print.title"),
      t("print.subtitle", { date: dateLabel }),
      "",
      ...actionable.map((finding) => {
        const left = finding.left ? `${t(`docs.${finding.left.doc}`)}: ${finding.left.value ?? "-"}` : "";
        const right = finding.right ? `${t(`docs.${finding.right.doc}`)}: ${finding.right.value ?? "-"}` : "";
        return `[${t(`status.${finding.status}`)}] ${finding.check} ${left} ${right}`.trim();
      }),
      "",
      t("print.footer"),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clerkeye-checklist.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader showHome={false} />

      <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-5 pb-16 pt-4">
        <h1 ref={headingRef} tabIndex={-1} className="sr-only">
          {t("wizard.title")}
        </h1>
        <StepIndicator current={step} />

        {/* ---------------- Step 1: upload ---------------- */}
        {step === "upload" ? (
          <section className="mt-5" aria-labelledby="upload-title">
            <h2 id="upload-title" className="text-xl font-semibold">
              {t("upload.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("upload.help")}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadSample()} disabled={sampleLoading}>
                {sampleLoading ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
                {sampleLoading ? t("landing.sampleLoading") : t("landing.cta.sample")}
              </Button>
              <span className="text-xs text-muted-foreground">{t("landing.sample.help")}</span>
            </div>

            {uploadMessage ? (
              <p role="alert" className="mt-3 rounded-lg bg-status-warning-bg p-3 text-sm text-status-warning">
                {uploadMessage}
              </p>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {entries.map((entry) => (
                <UploadCard
                  key={entry.docType}
                  entry={entry}
                  onPick={(file) => void handlePick(entry.docType, file)}
                  onRemove={() => handleRemove(entry.docType)}
                  onRedact={() => setRedacting(entry.docType)}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button className="min-h-11" disabled={!uploadable} onClick={goToConfirm}>
                {t("common.continue")}
              </Button>
              {!uploadable ? (
                <p className="text-sm text-muted-foreground">{t("upload.minimum")}</p>
              ) : null}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">{t("wizard.footerNote")}</p>
          </section>
        ) : null}

        {/* ---------------- Step 2: confirm ---------------- */}
        {step === "confirm" ? (
          <section className="mt-5" aria-labelledby="confirm-title">
            <h2 id="confirm-title" className="text-xl font-semibold">
              {t("confirm.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("confirm.help")}</p>

            <div className="mt-4 space-y-4">
              {ready.map((entry) => (
                <FieldsTable
                  key={entry.docType}
                  entry={entry}
                  onEdit={(field, value) => handleEdit(entry.docType, field, value)}
                />
              ))}
            </div>

            <div className="mt-4 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirm-values"
                  checked={confirmed}
                  onCheckedChange={(checked) => {
                    setConfirmed(checked === true);
                    if (checked === true) setConfirmError(false);
                  }}
                  aria-invalid={confirmError}
                  className="mt-1"
                />
                <Label htmlFor="confirm-values" className="text-sm font-medium">
                  {t("confirm.checkbox")}
                </Label>
              </div>
              {confirmError ? (
                <p role="alert" className="mt-2 text-sm font-medium text-status-critical">
                  {t("confirm.checkboxError")}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => setStep("upload")}>
                <ArrowLeftIcon aria-hidden />
                {t("common.back")}
              </Button>
              <Button className="min-h-11 flex-1" onClick={goToResults} disabled={!confirmed}>
                {t("results.title")}
              </Button>
            </div>
          </section>
        ) : null}

        {/* ---------------- Step 3: results ---------------- */}
        {step === "results" ? (
          <section className="mt-5" aria-labelledby="results-title">
            <h2 id="results-title" className="text-xl font-semibold">
              {t("results.title")}
            </h2>

            <div className="mt-3">
              <ResultsSummary counts={counts} onContinue={() => setStep("fix")} />
            </div>

            {findings.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t("results.empty")}</p>
            ) : (
              <div className="mt-4">
                <ResultsMatrix
                  findings={findings}
                  uploaded={documents.map((doc) => doc.docType)}
                  onOpen={setDetail}
                />
              </div>
            )}

            <div className="mt-5">
              <LimitsBox />
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => setStep("confirm")}>
                <ArrowLeftIcon aria-hidden />
                {t("common.back")}
              </Button>
              <Button className="min-h-11 flex-1" onClick={() => setStep("fix")}>
                {t("results.viewFixes")}
              </Button>
            </div>
          </section>
        ) : null}

        {/* ---------------- Step 4: fix and share ---------------- */}
        {step === "fix" ? (
          <section className="mt-5" aria-labelledby="fix-title">
            <h2 id="fix-title" className="text-xl font-semibold">
              {t("fix.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("fix.subtitle")}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => window.print()} className="min-h-11">
                <PrinterIcon aria-hidden />
                {t("fix.print")}
              </Button>
              <Button variant="outline" className="min-h-11" onClick={handleDownload}>
                <FileDownIcon aria-hidden />
                {t("fix.download")}
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={startOver}>
                <RotateCcwIcon aria-hidden />
                {t("fix.startOver")}
              </Button>
            </div>

            {explainNote ? (
              <p className="mt-2 text-xs text-muted-foreground">{explainNote}</p>
            ) : null}

            <div className="mt-4 space-y-3">
              {actionable.length === 0 ? (
                <p className="rounded-xl border bg-status-match-bg p-4 text-sm text-status-match">
                  <CheckCircle2Icon aria-hidden className="mr-1 inline size-4" />
                  {t("fix.nothing")}
                </p>
              ) : (
                actionable.map((finding) => (
                  <FixCard
                    key={finding.rowKey}
                    finding={finding}
                    explanation={explanationFor(finding)}
                    explanationLanguage={lang}
                  />
                ))
              )}
            </div>

            {subtle.length > 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {t("results.summary", {
                  critical: counts.CRITICAL,
                  warning: counts.WARNING,
                  unverifiable: counts.UNVERIFIABLE,
                  match: counts.MATCH,
                })}
              </p>
            ) : null}

            {actionable.some(
              (finding) =>
                finding.status === "WARNING" && (finding.mismatchType ?? "").startsWith("NAME_"),
            ) ? (
              <DeclarationTemplate applicantName={applicantName} fatherName={fatherName} />
            ) : null}

            <div className="mt-5">
              <LimitsBox />
            </div>

            <div className="mt-4">
              <Button variant="outline" className="min-h-11" onClick={() => setStep("results")}>
                <ArrowLeftIcon aria-hidden />
                {t("results.title")}
              </Button>
            </div>
          </section>
        ) : null}
      </main>

      <RedactionCanvas
        key={redacting ?? "none"}
        open={redacting !== null}
        onOpenChange={(open) => {
          if (!open) setRedacting(null);
        }}
        imageUrl={redacting ? entries.find((entry) => entry.docType === redacting)?.previewUrl ?? null : null}
        onApply={(image) => {
          if (redacting) void handleRedacted(redacting, image);
          setRedacting(null);
        }}
      />

      <FindingDetail finding={detail} onOpenChange={(open) => (open ? null : setDetail(null))} />

      <PrintSheet
        findings={findings}
        date={dateLabel}
        applicantName={applicantName}
        fatherName={fatherName}
        institute={institute || null}
      />
    </div>
  );
}
