"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EraserIcon, ShieldCheckIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyRedactions, type PreparedImage, type RedactionBox } from "@/components/image-utils";

/**
 * Cover the Aadhaar number before anything is read (SPEC.md §15 step 1, M6).
 *
 * Drag to draw one or more black boxes. The masked image replaces the original
 * for the preview and for extraction; the unmasked image is dropped from state.
 * Nothing is uploaded from here — the parent decides when to send.
 */

type Drag = { startX: number; startY: number; currentX: number; currentY: number } | null;

function normalise(drag: NonNullable<Drag>): RedactionBox {
  return {
    x: Math.min(drag.startX, drag.currentX),
    y: Math.min(drag.startY, drag.currentY),
    width: Math.abs(drag.currentX - drag.startX),
    height: Math.abs(drag.currentY - drag.startY),
  };
}

export function RedactionCanvas({
  open,
  onOpenChange,
  imageUrl,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  onApply: (image: PreparedImage) => void;
}) {
  const { t } = useLang();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boxes, setBoxes] = useState<RedactionBox[]>([]);
  const [drag, setDrag] = useState<Drag>(null);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState({ width: 900, height: 620 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 900 / image.width);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      canvas.width = width;
      canvas.height = height;
      setSize({ width, height });
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      context.fillStyle = "rgba(0,0,0,0.92)";
      for (const box of boxes) {
        context.fillRect(box.x, box.y, box.width, box.height);
      }
      if (drag) {
        const preview = normalise(drag);
        context.fillStyle = "rgba(0,0,0,0.55)";
        context.fillRect(preview.x, preview.y, preview.width, preview.height);
      }
    };
    image.src = imageUrl;
  }, [imageUrl, boxes, drag]);

  useEffect(() => {
    if (open) draw();
  }, [open, draw]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setDrag({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag) return;
    const point = pointFromEvent(event);
    setDrag({ ...drag, currentX: point.x, currentY: point.y });
  }

  function handlePointerUp() {
    if (!drag) return;
    const box = normalise(drag);
    setDrag(null);
    if (box.width > 8 && box.height > 8) {
      setBoxes((previous) => [...previous, box]);
    }
  }

  async function handleApply() {
    if (!imageUrl) return;
    setBusy(true);
    try {
      const masked = await applyRedactions(imageUrl, boxes);
      onApply(masked);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(960px,calc(100vw-2rem))] sm:max-w-[min(960px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheckIcon aria-hidden className="size-5" />
            {t("upload.redact.title")}
          </DialogTitle>
          <DialogDescription>{t("upload.redact.help")}</DialogDescription>
        </DialogHeader>

        <div className="overflow-auto rounded-lg border bg-muted/40 p-2">
          <canvas
            ref={canvasRef}
            width={size.width}
            height={size.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="mx-auto block max-w-full cursor-crosshair touch-none rounded"
            aria-label={t("upload.redact.title")}
            role="img"
          />
        </div>

        <p
          className="text-sm font-medium"
          aria-live="polite"
          data-testid="redaction-status"
        >
          {boxes.length > 0 ? `✓ ${t("upload.redact.covered")}` : t("upload.redact.notCovered")}
        </p>
        <p className="text-sm text-muted-foreground">{t("upload.redact.hint")}</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setBoxes([])} disabled={boxes.length === 0}>
            <EraserIcon aria-hidden />
            {t("upload.redact.clear")}
          </Button>
          <Button onClick={handleApply} disabled={busy || boxes.length === 0}>
            {t("upload.redact.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
