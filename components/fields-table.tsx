"use client";

import { AlertTriangleIcon, CheckIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocType, ExtractedDocument, FieldName } from "@/lib/extract/schemas";
import { isLowConfidence, type UploadEntry } from "@/lib/check-state";

/**
 * Editable fields for one document, with confidence indicators.
 *
 * Low-confidence values get an amber background *and* a "please check" label, so
 * colour is not the only signal (DESIGN.md, AGENTS.md rule 10).
 */
export function FieldsTable({
  entry,
  onEdit,
}: {
  entry: UploadEntry;
  onEdit: (field: FieldName, value: string) => void;
}) {
  const { t } = useLang();
  const document = entry.document as ExtractedDocument;
  const docLabel = t(`docs.${entry.docType as DocType}`);

  const fields = Object.entries(document.fields) as Array<
    [FieldName, { value: string | null; confidence?: number; script?: string }]
  >;

  return (
    <fieldset className="rounded-xl border bg-card p-4">
      <legend className="px-1 text-base font-medium">{docLabel}</legend>

      {document.qualityNote ? (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-status-warning-bg p-2 text-sm text-status-warning">
          <AlertTriangleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{document.qualityNote}</span>
        </p>
      ) : null}

      <div className="divide-y">
        {fields.map(([name, field]) => {
          const inputId = `field-${entry.docType}-${name}`;
          const low = isLowConfidence(field.confidence);
          const value = field.value ?? "";

          return (
            <div key={name} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center sm:gap-3">
              <Label htmlFor={inputId} className="text-sm text-muted-foreground">
                {t(`fields.${name}`)}
              </Label>
              <div>
                <Input
                  id={inputId}
                  value={value}
                  placeholder={t("confirm.unreadable")}
                  onChange={(event) => onEdit(name, event.target.value)}
                  aria-describedby={low ? `${inputId}-flag` : undefined}
                  className={
                    low
                      ? "border-status-warning-border bg-status-warning-bg text-foreground"
                      : undefined
                  }
                />
                <div className="mt-1 flex min-h-5 items-center gap-2 text-xs">
                  {low ? (
                    <span
                      id={`${inputId}-flag`}
                      className="inline-flex items-center gap-1 font-medium text-status-warning"
                    >
                      <AlertTriangleIcon aria-hidden className="size-3.5" />
                      {t("confirm.pleaseCheck")}
                    </span>
                  ) : field.value ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CheckIcon aria-hidden className="size-3.5" />
                      {t("confirm.readOk")}
                    </span>
                  ) : null}
                  {entry.editedFields.includes(name) ? (
                    <span className="text-muted-foreground">· {t("confirm.edited")}</span>
                  ) : null}
                  {typeof field.confidence === "number" ? (
                    <span className="ml-auto tabular text-muted-foreground">
                      {t("confirm.col.confidence")} {Math.round(field.confidence * 100)}%
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
