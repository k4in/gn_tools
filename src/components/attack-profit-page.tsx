import { type ReactNode, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PLAN_SLOT_IDS, planSlotLabel, type PlanSlotId } from "@/lib/gn-data/plan.ts";
import {
  calculateFastestWayToGoal,
  clockLabel,
  computeCurrentTick,
  formatRes,
  incomeFrom,
  taxRatesAt,
  type StartConfig,
} from "@/lib/calculate-fastest-way-to-goal.ts";
import { configFromState, loadStoredState } from "@/lib/features/plan-storage.ts";
import { calculateAttackProfit, type EconomyState } from "@/lib/utils/attack-profit.ts";
import { cn } from "@/lib/utils/cn.ts";
import { useNow } from "@/hooks/useNow.tsx";
import { useStoredState } from "@/hooks/useStoredState.tsx";
import { Button } from "@/components/shadcn/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card.tsx";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/shadcn/combobox.tsx";
import { Field, FieldLabel } from "@/components/shadcn/field.tsx";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn/input-group.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table.tsx";

const STORAGE_KEY = "gn_tool.attack-profit";
/** Auch nach Rundenende wird noch bis zu einem Jahr weitergerechnet, um den Turning Point zu zeigen. */
const HORIZON_DAYS = 365;
/** Stichtage ab Rundenstart: ab hier wird „Profitabel ab“ gelb, orange bzw. rot. */
const WARN_TICK = 70 * 96;
const LATE_TICK = 80 * 96;
const END_TICK = 90 * 96;
/** Stichtage, an denen der Mehrgewinn angezeigt wird. */
const GAIN_TICKS = [WARN_TICK, LATE_TICK];

type PlanOption = {
  id: PlanSlotId;
  label: string;
};

type AttackRow = {
  id: string;
  capturedExtractors: string;
  costPerExtractor: string;
};

type AttackDraft = {
  rows: AttackRow[];
};

function newRowId() {
  return Math.random().toString(36).slice(2, 10);
}

function newRow(capturedExtractors = "200", costPerExtractor = "50000"): AttackRow {
  return { id: newRowId(), capturedExtractors, costPerExtractor };
}

function loadRow(raw: unknown): AttackRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.capturedExtractors !== "string" || typeof o.costPerExtractor !== "string") return null;
  return {
    id: typeof o.id === "string" ? o.id : newRowId(),
    capturedExtractors: o.capturedExtractors,
    costPerExtractor: o.costPerExtractor,
  };
}

function loadDraft(raw: unknown): AttackDraft {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (Array.isArray(o.rows)) return { rows: o.rows.map(loadRow).filter((row) => row !== null) };
  // Früheres Format mit nur einer Eingabe wird zur ersten Zeile.
  const legacy = loadRow(o);
  return { rows: [legacy ?? newRow()] };
}

function parseAmount(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
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

/** Wirtschaftsstand des Plans zum gegebenen Tick (nach Planende: Stand am letzten Tick). */
function economyAtTick(cfg: StartConfig, tick: number): EconomyState | null {
  const plan = calculateFastestWayToGoal(cfg);
  const snapshot = plan.ticks.find((t) => t.tick === tick) ?? plan.ticks.at(-1);
  if (!snapshot) return null;
  // Minen produzieren ab dem Tick nach Fertigstellung, das Koloniezentrum schon im Fertigstellungs-Tick.
  const producing = plan.steps.filter((s) => (s.name === "Koloniezentrum" ? s.endTick <= tick : s.endTick < tick)).map((s) => s.name);
  return {
    tick,
    extractors: snapshot.extractorsMetProducing + snapshot.extractorsKrisProducing,
    mineIncome: incomeFrom(new Set(producing)),
    taxes: cfg.taxes,
  };
}

function breakEvenClass(tick: number | null): string {
  if (tick === null || tick >= END_TICK) return "text-destructive";
  if (tick >= LATE_TICK) return "text-orange-500";
  if (tick >= WARN_TICK) return "text-yellow-500";
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
  const [viewId, setViewId] = useState<PlanSlotId>(appState.livePlanId ?? appState.activePlanId);
  const [draft, setDraft] = useStoredState(STORAGE_KEY, loadDraft);

  const planOptions = useMemo<PlanOption[]>(
    () =>
      PLAN_SLOT_IDS.map((id) => ({
        id,
        label: id === appState.livePlanId ? `${planSlotLabel(id)} (aktiv)` : planSlotLabel(id),
      })),
    [appState.livePlanId]
  );
  const selectedPlan = planOptions.find((o) => o.id === viewId) ?? null;

  const cfg = useMemo(() => configFromState(appState, viewId), [appState, viewId]);
  const now = useNow();
  const currentTick = Math.max(0, computeCurrentTick(cfg, now));
  const economy = useMemo(() => economyAtTick(cfg, currentTick), [cfg, currentTick]);
  const perDay = ticksPerDay(cfg);

  const results = useMemo(() => {
    if (!economy) return null;
    const horizon = Math.round(HORIZON_DAYS * perDay);
    return draft.rows.map((row) =>
      calculateAttackProfit(
        economy,
        { capturedExtractors: parseAmount(row.capturedExtractors), costPerExtractor: parseAmount(row.costPerExtractor) },
        GAIN_TICKS,
        horizon
      )
    );
  }, [economy, draft.rows, perDay]);
  const incomeWithout = economy
    ? calculateAttackProfit(economy, { capturedExtractors: 0, costPerExtractor: 0 }, [], 0).incomeWithout
    : null;

  const tax = taxRatesAt(cfg.taxes, currentTick + 1);

  function updateRow(id: string, patch: Partial<AttackRow>) {
    setDraft((prev) => ({ rows: prev.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) }));
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Lohnt sich der Angriff?</h1>
          <p className="mt-1 max-w-2xl text-xs/relaxed text-muted-foreground">
            Vergleicht „abwarten“ mit „angreifen“: Der Flottenverlust geht sofort weg, die erbeuteten Extraktoren holen ihn Tick für Tick
            wieder rein. „Profitabel ab“ ist der Moment, ab dem du mit Angriff insgesamt mehr Rohstoffe hast als ohne.
          </p>
        </div>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Deine Wirtschaft</CardTitle>
            <CardDescription>
              Aus dem Planer, Stand Tick {currentTick} ({clockLabel(cfg, currentTick)})
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.5fr)_repeat(4,minmax(0,1fr))] lg:items-start">
            <Field>
              <FieldLabel>Plan</FieldLabel>
              <Combobox
                items={planOptions}
                value={selectedPlan}
                onValueChange={(option) => {
                  if (option) setViewId(option.id);
                }}
                itemToStringValue={(item) => item.label}
              >
                <ComboboxInput placeholder="Plan wählen" />
                <ComboboxContent>
                  <ComboboxEmpty>Kein Plan gefunden.</ComboboxEmpty>
                  <ComboboxList>
                    {(item: PlanOption) => (
                      <ComboboxItem key={item.id} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
            <Stat label="Extraktoren (produzierend)" value={economy ? formatRes(economy.extractors) : "–"} />
            <Stat
              label="Minen (brutto / Tick)"
              value={economy ? formatRes(economy.mineIncome.met + economy.mineIncome.kris) : "–"}
              hint={economy ? `${formatRes(economy.mineIncome.met)} Met · ${formatRes(economy.mineIncome.kris)} Kris` : null}
            />
            <Stat label="Steuern" value={`${tax.met} % / ${tax.kris} %`} hint="Met / Kris, ab nächstem Tick" />
            <Stat
              label="Einkommen netto / Tick"
              value={incomeWithout === null ? "–" : formatRes(incomeWithout)}
              hint={incomeWithout === null ? null : `${formatRes(incomeWithout * perDay)} pro Tag`}
            />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Angriffe</CardTitle>
            <CardDescription>
              Beute und Flottenverlust schätzt du selbst ein. „Profitabel ab“ wird gelb ab Tick {formatRes(WARN_TICK)} (
              {clockLabel(cfg, WARN_TICK)}), orange ab Tick {formatRes(LATE_TICK)} ({clockLabel(cfg, LATE_TICK)}) und rot ab Tick{" "}
              {formatRes(END_TICK)} ({clockLabel(cfg, END_TICK)}).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Erbeutete Extraktoren</TableHead>
                  <TableHead className="w-40">Kosten pro Extraktor</TableHead>
                  <TableHead>Verlust gesamt</TableHead>
                  <TableHead>Profitabel ab</TableHead>
                  {GAIN_TICKS.map((tick) => (
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
                        <CellValue value={result ? formatRes(result.loss) : "–"} />
                      </TableCell>
                      <TableCell>
                        {result ? (
                          <CellValue
                            className={breakEvenClass(breakEvenTick)}
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
                      {GAIN_TICKS.map((tick, i) => {
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
                          onClick={() => setDraft((prev) => ({ rows: prev.rows.filter((item) => item.id !== row.id) }))}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {draft.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4 + GAIN_TICKS.length + 1} className="text-center text-muted-foreground">
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
                    return { rows: [...prev.rows, last ? newRow(last.capturedExtractors, last.costPerExtractor) : newRow()] };
                  })
                }
              >
                <Plus data-icon="inline-start" />
                Angriff hinzufügen
              </Button>
              <Button type="button" variant="outline" disabled={draft.rows.length === 0} onClick={() => setDraft({ rows: [] })}>
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
