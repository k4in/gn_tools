import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/shadcn/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog.tsx";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet } from "@/components/shadcn/field.tsx";
import { Separator } from "@/components/shadcn/separator.tsx";
import { Input } from "@/components/shadcn/input.tsx";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn/input-group.tsx";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/shadcn/combobox.tsx";
import { HISTORY_WINDOW_TICKS, type HistoryWindow } from "@/lib/history-window.ts";
import { clockLabel } from "@/lib/calculate-fastest-way-to-goal.ts";

export type AppliedSettings = {
  start_date: string;
  start_time: string;
  tick_minutes: number;
  round_end_tick: number;
};

const HISTORY_LABEL_RECENT = `−${HISTORY_WINDOW_TICKS} Ticks`;
const HISTORY_LABEL_ALL = "Alles anzeigen";
const HISTORY_WINDOW_ITEMS = [HISTORY_LABEL_RECENT, HISTORY_LABEL_ALL];

export type SettingsDialogProps = {
  startDate: string;
  startTime: string;
  tickMinutes: number;
  roundEndTick: number;
  onApplyStart: (next: AppliedSettings) => void;
  historyWindow: HistoryWindow;
  onHistoryWindowChange: (next: HistoryWindow) => void;
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

function parsePositiveInt(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function SettingsDialog({
  startDate,
  startTime,
  tickMinutes: savedTickMinutes,
  roundEndTick: savedRoundEndTick,
  onApplyStart,
  historyWindow,
  onHistoryWindowChange,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(startDate);
  const [time, setTime] = useState(normalizeTime(startTime) ?? startTime);
  const [tickMinutes, setTickMinutes] = useState(String(savedTickMinutes));
  const [roundEndTick, setRoundEndTick] = useState(String(savedRoundEndTick));
  const [draftHistoryWindow, setDraftHistoryWindow] = useState(historyWindow);

  useEffect(() => {
    if (!open) return;
    setDate(startDate);
    setTime(normalizeTime(startTime) ?? startTime);
    setTickMinutes(String(savedTickMinutes));
    setRoundEndTick(String(savedRoundEndTick));
    setDraftHistoryWindow(historyWindow);
  }, [open, startDate, startTime, savedTickMinutes, savedRoundEndTick, historyWindow]);

  const normalizedTime = normalizeTime(time);
  const dateValid = isValidDate(date);
  const parsedTickMinutes = parsePositiveInt(tickMinutes);
  const parsedRoundEndTick = parsePositiveInt(roundEndTick);
  const currentTime = normalizeTime(startTime) ?? startTime;
  const startDirty =
    date !== startDate ||
    (normalizedTime ?? time) !== currentTime ||
    parsedTickMinutes !== savedTickMinutes ||
    parsedRoundEndTick !== savedRoundEndTick;
  const historyDirty = draftHistoryWindow !== historyWindow;
  const canApply =
    dateValid && !!normalizedTime && parsedTickMinutes !== null && parsedRoundEndTick !== null && (startDirty || historyDirty);

  /** Alle Änderungen gelten erst mit „Übernehmen“. */
  function apply() {
    if (!normalizedTime || !dateValid || parsedTickMinutes === null || parsedRoundEndTick === null) return;
    if (startDirty) {
      onApplyStart({
        start_date: date,
        start_time: normalizedTime,
        tick_minutes: parsedTickMinutes,
        round_end_tick: parsedRoundEndTick,
      });
    }
    if (historyDirty) onHistoryWindowChange(draftHistoryWindow);
    setOpen(false);
  }
  // Vorschau mit den eingegebenen Werten; bei kürzeren Ticks ist das reale Rundenende früher.
  const roundEndPreview =
    parsedRoundEndTick !== null && parsedTickMinutes !== null && dateValid && normalizedTime
      ? clockLabel({ start_date: date, start_time: normalizedTime, tick_minutes: parsedTickMinutes }, parsedRoundEndTick)
      : null;

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
            <FieldLegend>Runde</FieldLegend>
            <FieldDescription>Planstart ist Tick 0. Alle Zeiten im Planer rechnen sich von diesem Zeitpunkt.</FieldDescription>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
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
            <Field data-invalid={parsedRoundEndTick === null || undefined}>
              <FieldLabel htmlFor="settings-round-end-tick">Voraussichtliche Rundenlänge</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="settings-round-end-tick"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={roundEndTick}
                  aria-invalid={parsedRoundEndTick === null || undefined}
                  className="tabular-nums"
                  onChange={(event) => setRoundEndTick(event.target.value)}
                />
                <InputGroupAddon align="inline-end">Ticks</InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {roundEndPreview ? `Ergibt ein Enddatum am ${roundEndPreview}.` : "Tick, an dem die Runde endet."}
              </FieldDescription>
            </Field>
          </FieldSet>
          <FieldSeparator />
          <FieldSet>
            <FieldLegend>Anzeige</FieldLegend>
            <FieldDescription>Vergangenheit in Timeline und Tabellen. Die Zukunft bleibt immer sichtbar.</FieldDescription>
            <Field>
              <FieldLabel>Verlauf</FieldLabel>
              <Combobox
                items={HISTORY_WINDOW_ITEMS}
                value={draftHistoryWindow === "all" ? HISTORY_LABEL_ALL : HISTORY_LABEL_RECENT}
                onValueChange={(value) => {
                  if (value === HISTORY_LABEL_ALL) setDraftHistoryWindow("all");
                  else if (value === HISTORY_LABEL_RECENT) setDraftHistoryWindow("recent");
                }}
              >
                <ComboboxInput showTrigger className="w-full" />
                <ComboboxContent>
                  <ComboboxList>
                    <ComboboxItem value={HISTORY_LABEL_RECENT}>{HISTORY_LABEL_RECENT}</ComboboxItem>
                    <ComboboxItem value={HISTORY_LABEL_ALL}>{HISTORY_LABEL_ALL}</ComboboxItem>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          </FieldSet>
        </FieldGroup>
        <Separator />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
          <Button type="button" disabled={!canApply} onClick={apply}>
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
