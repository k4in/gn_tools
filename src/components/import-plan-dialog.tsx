import { useState } from "react";
import { Import } from "lucide-react";
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
import { Field, FieldLabel } from "@/components/shadcn/field";
import { Textarea } from "@/components/shadcn/textarea";
import type { PlanEntry } from "@/gn-data/plan";
import type { TaxSegment } from "@/lib/calculateFastestWayToGoal";

export type ImportPlanParseResult =
  | { ok: true; plan: PlanEntry[]; taxes: TaxSegment[] }
  | { ok: false; error: string };

export type ImportPlanDialogProps = {
  parse: (json: string) => ImportPlanParseResult;
  onReplace: (imported: { plan: PlanEntry[]; taxes: TaxSegment[] }) => void;
};

export function ImportPlanDialog({ parse, onReplace }: ImportPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setText("");
    setError(null);
  };

  const handleReplace = () => {
    const result = parse(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onReplace({ plan: result.plan, taxes: result.taxes });
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <Import data-icon="inline-start" />
        Importieren
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Plan importieren</DialogTitle>
          <DialogDescription>
            JSON eines exportierten Plans einfügen, inklusive Steuern. Startzeit bleibt
            unverändert.
          </DialogDescription>
        </DialogHeader>
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Der Import ersetzt den aktuellen Plan vollständig. Das lässt sich nicht
          rückgängig machen.
        </p>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="plan-import-json">Plan-JSON</FieldLabel>
          <Textarea
            id="plan-import-json"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            placeholder='{ "plan": [ { "id": "...", "kind": "tech", ... } ], "taxes": [] }'
            className="max-h-[60vh] min-h-64 resize-none overflow-auto font-mono text-xs/relaxed field-sizing-fixed"
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </Field>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={!text.trim()}
            onClick={handleReplace}
          >
            Plan ersetzen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
