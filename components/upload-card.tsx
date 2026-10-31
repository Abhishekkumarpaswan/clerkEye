"use client";

import { useId, useRef } from "react";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircle2Icon,
  ImageOffIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocType } from "@/lib/extract/schemas";
import type { UploadEntry } from "@/lib/check-state";
import { ACCEPTED_EXTENSIONS } from "@/lib/extract/preprocess";

/**
 * One upload card per document type: dashed border, preview, quality hint,
 * redaction entry point, remove button, skeleton while reading (DESIGN.md).
 */
export function UploadCard({
  entry,
  onPick,
  onRemove,
  onRedact,
}: {
  entry: UploadEntry;
  onPick: (file: File) => void;
  onRemove: () => void;
  onRedact: () => void;
}) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reactId = useId();
  const inputId = `${reactId}-file`;
  const hintId = `${reactId}-hint`;
  const docLabel = t(`docs.${entry.docType as DocType}`);

  const isAadhaar = entry.docType === "AADHAAR";
  const reading = entry.status === "reading";
  const error = entry.status === "error";

  return (
    <section
      aria-labelledby={`${reactId}-title`}
      className="rounded-xl border bg-card p-4 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`${reactId}-title`} className="font-medium leading-tight">
            {docLabel}
          </h3>
          <p id={hintId} className="mt-1 text-sm text-muted-foreground">
            {t("upload.qualityHint")}
          </p>
        </div>
        {entry.status === "ready" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-match-bg px-2 py-1 text-xs font-medium text-status-match">
            <CheckCircle2Icon aria-hidden className="size-3.5" />
            {t("upload.ready")}
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        {entry.previewUrl ? (
          <div className="relative overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- data/object URL, never remote */}
            <img
              src={entry.previewUrl}
              alt={`${docLabel} — ${t("upload.preview")}`}
              className="max-h-48 w-full object-contain"
            />
            {entry.demo ? (
              <span className="absolute left-2 top-2 rounded bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">
                {t("upload.demoBadge")}
              </span>
            ) : null}
            {entry.redacted ? (
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">
                <ShieldCheckIcon aria-hidden className="size-3" />
                {t("upload.redact.covered")}
              </span>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            aria-describedby={hintId}
          >
            {isAadhaar ? (
              <ImageOffIcon aria-hidden className="size-5" />
            ) : (
              <CameraIcon aria-hidden className="size-5" />
            )}
            <span className="font-medium">{t("upload.add")}</span>
            <span className="text-xs">JPG · PNG · PDF</span>
          </button>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          capture="environment"
          className="sr-only"
          aria-label={`${t("upload.add")} — ${docLabel}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onPick(file);
          }}
        />
      </div>

      {reading ? (
        <div className="mt-3 space-y-2" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
            {t("upload.extracting")}
          </p>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-status-warning-bg p-2 text-sm text-status-warning">
          <AlertTriangleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t("upload.error")}</span>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          aria-label={`${entry.previewUrl ? t("upload.replace") : t("upload.add")} — ${docLabel}`}
        >
          <CameraIcon aria-hidden />
          {entry.previewUrl ? t("upload.replace") : t("upload.add")}
        </Button>

        {isAadhaar && entry.previewUrl && !entry.demo ? (
          <Button
            variant={entry.redacted ? "secondary" : "outline"}
            size="sm"
            onClick={onRedact}
            aria-label={`${t("upload.redact.button")} — ${docLabel}`}
          >
            <ShieldCheckIcon aria-hidden />
            {entry.redacted ? t("upload.redact.covered") : t("upload.redact.button")}
          </Button>
        ) : null}

        {entry.previewUrl ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={`${t("upload.remove")} — ${docLabel}`}
          >
            <Trash2Icon aria-hidden />
            {t("upload.remove")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
