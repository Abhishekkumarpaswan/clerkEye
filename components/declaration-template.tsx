"use client";

import { useState } from "react";
import { FileTextIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { declarationText } from "@/lib/explain/templates";

/**
 * Name-variation declaration TEMPLATE (SPEC.md §12.3).
 *
 * Shown only for a name-variation WARNING — never for a CRITICAL finding — and
 * always with the disclaimer. It is a template, not legal advice, and it says so
 * at the top and in the print sheet.
 */
export function DeclarationTemplate({
  applicantName,
  fatherName,
}: {
  applicantName: string | null;
  fatherName: string | null;
}) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [institute, setInstitute] = useState("");

  const text = declarationText(lang, {
    applicantName,
    fatherName,
    institute: institute.trim() || "________________",
  });

  return (
    <section className="mt-6 rounded-xl border border-dashed bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <FileTextIcon aria-hidden className="size-4" />
        {t("declaration.title")}
      </h2>
      <p className="mt-2 rounded-lg bg-status-warning-bg p-2 text-sm font-medium text-status-warning">
        {t("declaration.disclaimer")}
      </p>

      <div className="mt-3">
        <Label htmlFor="institute" className="text-sm text-muted-foreground">
          {t("fields.institute")}
        </Label>
        <Input
          id="institute"
          value={institute}
          onChange={(event) => setInstitute(event.target.value)}
          className="mt-1"
          placeholder="—"
        />
      </div>

      <Button variant="outline" className="mt-3 min-h-11" onClick={() => setOpen((value) => !value)}>
        {open ? t("declaration.hide") : t("declaration.show")}
      </Button>

      {open ? (
        <pre
          lang={lang}
          className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border bg-white p-4 font-sans text-sm leading-relaxed"
        >
          {text}
        </pre>
      ) : null}
    </section>
  );
}
