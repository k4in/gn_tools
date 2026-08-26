import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { ResetBtn } from "@/components/reset-btn";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/shadcn/combobox";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/shadcn/field";
import { Input } from "@/components/shadcn/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn/input-group";
import { planTemplates, type PlanTemplate } from "@/gn-data/plan";

export type AppliedSettings = {
  start_date: string;
  start_time: string;
  tick_minutes: number;
};

export type SettingsDialogProps = {
  startDate: string;
  startTime: string;
  tickMinutes: number;
  onApplyStart: (next: AppliedSettings) => void;
  onReset: (templateId: string) => void;
};

function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseTickMinutes(value: string): number | null {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.floor(minutes);
}

export function SettingsDialog({
  startDate,
  startTime,
  tickMinutes: savedTickMinutes,
  onApplyStart,
  onReset,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(startDate);
  const [time, setTime] = useState(normalizeTime(startTime) ?? startTime);
  const [tickMinutes, setTickMinutes] = useState(String(savedTickMinutes));
  const [resetTemplate, setResetTemplate] = useState<PlanTemplate | null>(planTemplates[0] ?? null);

  useEffect(() => {
    if (!open) return;
    setDate(startDate);
    setTime(normalizeTime(startTime) ?? startTime);
    setTickMinutes(String(savedTickMinutes));
  }, [open, startDate, startTime, savedTickMinutes]);

  const normalizedTime = normalizeTime(time);
  const dateValid = isValidDate(date);
  const parsedTickMinutes = parseTickMinutes(tickMinutes);
  const currentTime = normalizeTime(startTime) ?? startTime;
  const dirty =
    date !== startDate || (normalizedTime ?? time) !== currentTime || parsedTickMinutes !== savedTickMinutes;
  const canApply = dateValid && !!normalizedTime && parsedTickMinutes !== null && dirty;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon-lg" aria-label="Einstellungen" />}>
        <Settings />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Einstellungen</DialogTitle>
          <DialogDescription>Allgemeine Optionen für den Planer.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <FieldSet>
            <FieldLegend>Planstart</FieldLegend>
            <FieldDescription>Tick 0. Alle Zeiten im Planer rechnen sich von diesem Zeitpunkt.</FieldDescription>
            <Field data-invalid={!dateValid || undefined}>
              <FieldLabel htmlFor="settings-start-date">Datum</FieldLabel>
              <Input
                id="settings-start-date"
                type="date"
                value={date}
                aria-invalid={!dateValid || undefined}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field data-invalid={!normalizedTime || undefined}>
              <FieldLabel htmlFor="settings-start-time">Uhrzeit</FieldLabel>
              <Input
                id="settings-start-time"
                type="time"
                step={60}
                value={time}
                aria-invalid={!normalizedTime || undefined}
                onChange={(event) => setTime(event.target.value)}
              />
            </Field>
            <Field data-invalid={parsedTickMinutes === null || undefined}>
              <FieldLabel htmlFor="settings-tick-minutes">Tick-Länge</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="settings-tick-minutes"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={tickMinutes}
                  aria-invalid={parsedTickMinutes === null || undefined}
                  className="tabular-nums"
                  onChange={(event) => setTickMinutes(event.target.value)}
                />
                <InputGroupAddon align="inline-end">Min</InputGroupAddon>
              </InputGroup>
              <FieldDescription>Dauer eines Ticks in Minuten.</FieldDescription>
            </Field>
            <Field>
              <Button
                type="button"
                disabled={!canApply}
                onClick={() => {
                  if (!normalizedTime || !dateValid || parsedTickMinutes === null) return;
                  onApplyStart({
                    start_date: date,
                    start_time: normalizedTime,
                    tick_minutes: parsedTickMinutes,
                  });
                }}
              >
                Übernehmen
              </Button>
            </Field>
          </FieldSet>
          <FieldSeparator />
          <FieldSet>
            <FieldLegend>Plan zurücksetzen</FieldLegend>
            <FieldDescription>Resette mit dem folgenden Default-Plan.</FieldDescription>
            <Field>
              <FieldLabel>Default-Plan</FieldLabel>
              <Combobox
                items={planTemplates}
                value={resetTemplate}
                onValueChange={setResetTemplate}
                itemToStringValue={(template) => template.label}
              >
                <ComboboxInput placeholder="Default-Plan wählen" />
                <ComboboxContent>
                  <ComboboxEmpty>Kein Plan gefunden.</ComboboxEmpty>
                  <ComboboxList>
                    {(template) => (
                      <ComboboxItem key={template.id} value={template}>
                        {template.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
            <Field>
              <ResetBtn
                planLabel={resetTemplate?.label ?? ""}
                disabled={!resetTemplate}
                onReset={() => {
                  if (!resetTemplate) return;
                  onReset(resetTemplate.id);
                  setOpen(false);
                }}
              />
            </Field>
          </FieldSet>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
