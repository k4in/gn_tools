import { useState } from "react";
import { Check, Copy, Download, FileJson } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";
import { Textarea } from "@/components/shadcn/textarea";

export type ExportPlanDialogProps = {
  json: string;
  planSlot: number;
};

function planFileName(planSlot: number, now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `plan${planSlot}_${y}${m}${d}.json`;
}

export function ExportPlanDialog({ json, planSlot }: ExportPlanDialogProps) {
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Konnte Plan-JSON nicht kopieren", err);
    }
  };

  const saveJsonFile = () => {
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = planFileName(planSlot);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setCopied(false);
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <FileJson data-icon="inline-start" />
        JSON exportieren
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Plan-JSON</DialogTitle>
          <DialogDescription>Vollständiges JSON des aktuellen Plans.</DialogDescription>
        </DialogHeader>
        <Textarea
          readOnly
          value={json}
          spellCheck={false}
          className="max-h-[60vh] min-h-64 resize-none overflow-auto font-mono text-xs/relaxed field-sizing-fixed"
        />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Schließen</DialogClose>
          <Button type="button" variant="outline" onClick={saveJsonFile}>
            <Download data-icon="inline-start" />
            Als Datei speichern
          </Button>
          <Button type="button" onClick={copyJson}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Kopiert" : "Kopieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
