// React
import { type ReactNode, useMemo, useState } from "react";

// Packages
import { Plus, Trash2 } from "lucide-react";

// Lib/Utils
import { planSlotLabel } from "@/lib/gn-data/plan.ts";
import {
  clockLabel,
  computeCurrentTick,
  formatRes,
  taxRatesAt,
  type StartConfig,
  type TaxSegment,
} from "@/lib/calculate-fastest-way-to-goal.ts";
import { configFromState, loadStoredState } from "@/lib/features/plan-storage.ts";
import { calculateAttackProfit } from "@/lib/utils/attack-profit.ts";
import { cn } from "@/lib/utils/cn.ts";

// Hooks
import { useNow } from "@/hooks/useNow.tsx";
import { useStoredState } from "@/hooks/useStoredState.tsx";

// Shadcn components
import { Button } from "@/components/shadcn/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card.tsx";
import { Field, FieldLabel } from "@/components/shadcn/field.tsx";
import { Input } from "@/components/shadcn/input.tsx";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn/input-group.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table.tsx";

const STORAGE_KEY = "gn_tool.attack-profit";
/** Auch nach Rundenende wird noch bis zu einem Jahr weitergerechnet, um den Turning Point zu zeigen. */
const HORIZON_DAYS = 365;
/** Stichtage in Tagen ab Rundenstart: ab hier wird „Profitabel in“ gelb, orange bzw. rot. */
const WARN_DAY = 70;
const LATE_DAY = 80;
const END_DAY = 90;
/** Stichtage, an denen der Mehrgewinn angezeigt wird. */
const GAIN_DAYS = [WARN_DAY, LATE_DAY];

type AttackRow = {
  id: string;
  /** Nur zur Erinnerung, welches Ziel zu den Werten gehört; wird nicht ausgewertet. */
  target: string;
  capturedExtractors: string;
  costPerExtractor: string;
};

/** Steuern in Prozent, falls im Plan keine (passenden) gesetzt sind; gelten für den ganzen Zeitraum. */
type ManualTaxes = {
  met: string;
  kris: string;
};

type AttackDraft = {
  rows: AttackRow[];
  /** null = Steuern aus dem Plan. */
  manualTaxes: ManualTaxes | null;
};

function newRowId() {
  return Math.random().toString(36).slice(2, 10);
}

function newRow(capturedExtractors = "200", costPerExtractor = "50000"): AttackRow {
  return { id: newRowId(), target: "", capturedExtractors, costPerExtractor };
}

function loadRow(raw: unknown): AttackRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.capturedExtractors !== "string" || typeof o.costPerExtractor !== "string") return null;
  return {
    id: typeof o.id === "string" ? o.id : newRowId(),
    target: typeof o.target === "string" ? o.target : "",
    capturedExtractors: o.capturedExtractors,
    costPerExtractor: o.costPerExtractor,
  };
}

function loadManualTaxes(raw: unknown): ManualTaxes | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.met !== "string" || typeof o.kris !== "string") return null;
  return { met: o.met, kris: o.kris };
}

function loadDraft(raw: unknown): AttackDraft {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const manualTaxes = loadManualTaxes(o.manualTaxes);
  if (Array.isArray(o.rows)) return { rows: o.rows.map(loadRow).filter((row) => row !== null), manualTaxes };
  // Früheres Format mit nur einer Eingabe wird zur ersten Zeile.
  const legacy = loadRow(o);
  return { rows: [legacy ?? newRow()], manualTaxes };
}

function parseAmount(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parsePercent(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

function ticksPerDay(cfg: StartConfig): number {
  return (24 * 60) / cfg.tick_minutes;
}

function formatDuration(ticks: number, cfg: StartConfig): string {
  const minutes = ticks * cfg.tick_minutes;
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  if (days === 0) return `${hours} Std.`;
  return hours === 0 ? `${days} ${days === 1 ? "Tag" : "Tage"}` : `${days} ${days === 1 ? "Tag" : "Tage"} ${hours} Std.`;
}

/** Tick, an dem der gegebene Tag ab Rundenstart beginnt; hängt von der Tick-Länge ab. */
function dayToTick(day: number, perDay: number): number {
  return Math.round(day * perDay);
}

function breakEvenClass(tick: number | null, perDay: number): string {
  if (tick === null || tick >= dayToTick(END_DAY, perDay)) return "text-destructive";
  if (tick >= dayToTick(LATE_DAY, perDay)) return "text-orange-500";
  if (tick >= dayToTick(WARN_DAY, perDay)) return "text-yellow-500";
  return "text-green-500";
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
      {hint ? <span className="text-[11px] text-muted-foreground tabular-nums">{hint}</span> : null}
    </div>
  );
}

function CellValue({ value, hint, className }: { value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("font-medium tabular-nums", className)}>{value}</span>
      {hint ? <span className="text-[11px] text-muted-foreground tabular-nums">{hint}</span> : null}
    </div>
  );
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${formatRes(n)}`;
}

export function AttackProfitPage() {
  const [appState] = useState(() => loadStoredState());
  // Gerechnet wird immer mit dem aktiven Plan.
  const planId = appState.livePlanId ?? appState.activePlanId;
  const [draft, setDraft] = useStoredState(STORAGE_KEY, loadDraft);

  const cfg = useMemo(() => configFromState(appState, planId), [appState, planId]);
  const now = useNow();
  const currentTick = Math.max(0, computeCurrentTick(cfg, now));
  const perDay = ticksPerDay(cfg);
  const gainTicks = useMemo(() => GAIN_DAYS.map((day) => dayToTick(day, perDay)), [perDay]);
  const manualTaxes = draft.manualTaxes;
  const taxes = useMemo<TaxSegment[]>(
    () => (manualTaxes ? [{ fromTick: 0, met: parsePercent(manualTaxes.met), kris: parsePercent(manualTaxes.kris) }] : cfg.taxes),
    [manualTaxes, cfg.taxes]
  );

  const results = useMemo(() => {
    const horizon = Math.round(HORIZON_DAYS * perDay);
    return draft.rows.map((row) =>
      calculateAttackProfit(
        currentTick,
        taxes,
        { capturedExtractors: parseAmount(row.capturedExtractors), costPerExtractor: parseAmount(row.costPerExtractor) },
        gainTicks,
        horizon
      )
    );
  }, [currentTick, taxes, draft.rows, perDay, gainTicks]);

  const tax = taxRatesAt(taxes, currentTick + 1);

  function updateRow(id: string, patch: Partial<AttackRow>) {
    setDraft((prev) => ({ ...prev, rows: prev.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) }));
  }

  function updateManualTaxes(patch: Partial<ManualTaxes>) {
    setDraft((prev) => (prev.manualTaxes ? { ...prev, manualTaxes: { ...prev.manualTaxes, ...patch } } : prev));
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-background text-foreground">
      <div className="flex flex-col gap-6 px-6 py-8">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Lohnt sich der Angriff?</h1>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Steuern</CardTitle>
            <CardDescription>
              {manualTaxes
                ? "Manuell gesetzt, gelten für den ganzen Zeitraum."
                : `Aus dem aktiven Plan (${planSlotLabel(planId)}), Stand Tick ${currentTick} (${clockLabel(cfg, currentTick)}).`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-4">
            {manualTaxes ? (
              <div className="grid w-72 grid-cols-2 gap-2">
                <Field>
                  <FieldLabel>Steuer Met</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      min={0}
                      max={100}
                      inputMode="decimal"
                      aria-label="Steuer auf Metall"
                      className="tabular-nums"
                      value={manualTaxes.met}
                      onChange={(e) => updateManualTaxes({ met: e.target.value })}
                    />
                    <InputGroupAddon align="inline-end">%</InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel>Steuer Kris</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      min={0}
                      max={100}
                      inputMode="decimal"
                      aria-label="Steuer auf Kristall"
                      className="tabular-nums"
                      value={manualTaxes.kris}
                      onChange={(e) => updateManualTaxes({ kris: e.target.value })}
                    />
                    <InputGroupAddon align="inline-end">%</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            ) : (
              <Stat
                label="Steuern"
                value={`${tax.met} % / ${tax.kris} %`}
                hint={cfg.taxes.length === 0 ? "Im Plan sind keine Steuern gesetzt" : "Met / Kris, ab nächstem Tick"}
              />
            )}
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  // Beim Umschalten starten die manuellen Steuern mit den aktuellen aus dem Plan.
                  manualTaxes: prev.manualTaxes ? null : { met: String(tax.met), kris: String(tax.kris) },
                }))
              }
            >
              {manualTaxes ? "Steuern aus Plan" : "Steuern manuell setzen"}
            </Button>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Angriffe</CardTitle>
            <CardDescription>
              {GAIN_DAYS.map((day, i) => `Tick ${formatRes(gainTicks[i])} = ${day} Tage`).join(", ")} nach Rundenanfang.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Ziel</TableHead>
                  <TableHead className="w-36">Erbeutete Extraktoren</TableHead>
                  <TableHead className="w-40">Kosten pro Extraktor</TableHead>
                  <TableHead>Verlust gesamt</TableHead>
                  <TableHead>Profitabel in</TableHead>
                  {gainTicks.map((tick) => (
                    <TableHead key={tick}>Mehrgewinn bis Tick {formatRes(tick)}</TableHead>
                  ))}
                  <TableHead className="w-10">
                    <span className="sr-only">Aktion</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.rows.map((row, index) => {
                  const result = results?.[index] ?? null;
                  const breakEvenTick = result?.breakEvenTicks == null ? null : currentTick + result.breakEvenTicks;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input
                          aria-label="Ziel"
                          className="min-w-56"
                          placeholder="Name, Koordinaten,..."
                          value={row.target}
                          onChange={(e) => updateRow(row.id, { target: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <InputGroup>
                          <InputGroupInput
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label="Erbeutete Extraktoren"
                            className="tabular-nums"
                            value={row.capturedExtractors}
                            onChange={(e) => updateRow(row.id, { capturedExtractors: e.target.value })}
                          />
                          <InputGroupAddon align="inline-end">Exen</InputGroupAddon>
                        </InputGroup>
                      </TableCell>
                      <TableCell>
                        <InputGroup>
                          <InputGroupInput
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label="Kosten pro Extraktor"
                            className="tabular-nums"
                            value={row.costPerExtractor}
                            onChange={(e) => updateRow(row.id, { costPerExtractor: e.target.value })}
                          />
                          <InputGroupAddon align="inline-end">Res</InputGroupAddon>
                        </InputGroup>
                      </TableCell>
                      <TableCell>
                        <CellValue
                          value={result ? formatRes(result.loss) : "–"}
                          hint={result ? `+${formatRes(result.extraIncome)} pro Tick` : null}
                        />
                      </TableCell>
                      <TableCell>
                        {result ? (
                          <CellValue
                            className={breakEvenClass(breakEvenTick, perDay)}
                            value={result.breakEvenTicks === null ? "nie" : formatDuration(result.breakEvenTicks, cfg)}
                            hint={
                              breakEvenTick === null
                                ? "auch nicht innerhalb eines Jahres"
                                : `Tick ${formatRes(breakEvenTick)} · ${clockLabel(cfg, breakEvenTick)}`
                            }
                          />
                        ) : (
                          "–"
                        )}
                      </TableCell>
                      {gainTicks.map((tick, i) => {
                        const gain = result?.gainsAt[i] ?? null;
                        return (
                          <TableCell key={tick}>
                            {gain === null ? (
                              <CellValue value="–" hint={result ? "bereits vorbei" : null} />
                            ) : (
                              <CellValue className={gain >= 0 ? "text-green-500" : "text-destructive"} value={signed(gain)} />
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Angriff entfernen"
                          onClick={() => setDraft((prev) => ({ ...prev, rows: prev.rows.filter((item) => item.id !== row.id) }))}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {draft.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5 + gainTicks.length + 1} className="text-center text-muted-foreground">
                      Noch kein Angriff eingetragen.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setDraft((prev) => {
                    const last = prev.rows.at(-1);
                    return { ...prev, rows: [...prev.rows, last ? newRow(last.capturedExtractors, last.costPerExtractor) : newRow()] };
                  })
                }
              >
                <Plus data-icon="inline-start" />
                Angriff hinzufügen
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={draft.rows.length === 0}
                onClick={() => setDraft((prev) => ({ ...prev, rows: [] }))}
              >
                <Trash2 data-icon="inline-start" />
                Alle löschen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
