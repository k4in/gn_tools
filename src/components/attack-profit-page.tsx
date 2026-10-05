import { type ReactNode, useMemo, useState } from "react";
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
import { useNow } from "@/hooks/useNow.tsx";
import { useStoredState } from "@/hooks/useStoredState.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card.tsx";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/shadcn/combobox.tsx";
import { Field, FieldLabel } from "@/components/shadcn/field.tsx";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn/input-group.tsx";

const STORAGE_KEY = "gn_tool.attack-profit";
/** Auch nach Rundenende wird noch bis zu einem Jahr weitergerechnet, um den Turning Point zu zeigen. */
const HORIZON_DAYS = 365;
/** Liegt der Turning Point näher als so viele Tage am Rundenende, wird er gelb markiert. */
const WARN_DAYS_BEFORE_ROUND_END = 7;

type PlanOption = {
  id: PlanSlotId;
  label: string;
};

type AttackDraft = {
  capturedExtractors: string;
  costPerExtractor: string;
};

function loadDraft(raw: unknown): AttackDraft {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    capturedExtractors: typeof o.capturedExtractors === "string" ? o.capturedExtractors : "200",
    costPerExtractor: typeof o.costPerExtractor === "string" ? o.costPerExtractor : "50000",
  };
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

/** Restzeit bis zu einem Tick als Dativ, z. B. „in 12 Tagen und 3 Stunden“. */
function formatTimeUntil(ticks: number, cfg: StartConfig): string {
  if (ticks <= 0) return "bereits vorbei";
  const minutes = ticks * cfg.tick_minutes;
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  return `in ${days} ${days === 1 ? "Tag" : "Tagen"} und ${hours} ${hours === 1 ? "Stunde" : "Stunden"}`;
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

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
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

  const captured = parseAmount(draft.capturedExtractors);
  const costPerExtractor = parseAmount(draft.costPerExtractor);
  const perDay = ticksPerDay(cfg);
  const roundEndTick = cfg.round_end_tick;

  const result = useMemo(() => {
    if (!economy) return null;
    return calculateAttackProfit(
      economy,
      { capturedExtractors: captured, costPerExtractor },
      roundEndTick,
      Math.round(HORIZON_DAYS * perDay)
    );
  }, [economy, captured, costPerExtractor, roundEndTick, perDay]);

  const tax = taxRatesAt(cfg.taxes, currentTick + 1);
  const breakEvenTick = result?.breakEvenTicks == null ? null : currentTick + result.breakEvenTicks;
  const breakEvenClass =
    breakEvenTick === null || breakEvenTick > roundEndTick
      ? "text-destructive"
      : breakEvenTick > roundEndTick - WARN_DAYS_BEFORE_ROUND_END * perDay
        ? "text-yellow-500"
        : "text-green-500";

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Lohnt sich der Angriff?</h1>
          <p className="mt-1 max-w-2xl text-xs/relaxed text-muted-foreground">
            Vergleicht „abwarten“ mit „angreifen“: Der Flottenverlust geht sofort weg, die erbeuteten Extraktoren holen ihn Tick für Tick
            wieder rein. Der Turning Point ist der Moment, ab dem du mit Angriff insgesamt mehr Rohstoffe hast als ohne.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Deine Wirtschaft</CardTitle>
              <CardDescription>
                Aus dem Planer, Stand Tick {currentTick} ({clockLabel(cfg, currentTick)})
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
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
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Extraktoren (produzierend)" value={economy ? formatRes(economy.extractors) : "–"} />
                <Stat
                  label="Minen (brutto / Tick)"
                  value={economy ? formatRes(economy.mineIncome.met + economy.mineIncome.kris) : "–"}
                  hint={economy ? `${formatRes(economy.mineIncome.met)} Met · ${formatRes(economy.mineIncome.kris)} Kris` : null}
                />
                <Stat label="Steuern" value={`${tax.met} % / ${tax.kris} %`} hint="Met / Kris, ab nächstem Tick" />
                <Stat
                  label="Einkommen netto / Tick"
                  value={result ? formatRes(result.incomeWithout) : "–"}
                  hint={result ? `${formatRes(result.incomeWithout * perDay)} pro Tag` : null}
                />
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Angriff</CardTitle>
              <CardDescription>Beute und Flottenverlust schätzt du selbst ein.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="captured-extractors">Erbeutete Extraktoren</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="captured-extractors"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={draft.capturedExtractors}
                    onChange={(e) => setDraft((prev) => ({ ...prev, capturedExtractors: e.target.value }))}
                  />
                  <InputGroupAddon align="inline-end">Exen</InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="cost-per-extractor">Kosten pro Extraktor</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="cost-per-extractor"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={draft.costPerExtractor}
                    onChange={(e) => setDraft((prev) => ({ ...prev, costPerExtractor: e.target.value }))}
                  />
                  <InputGroupAddon align="inline-end">Res</InputGroupAddon>
                </InputGroup>
              </Field>
              <Stat label="Flottenverlust gesamt" value={result ? formatRes(result.loss) : "–"} />
            </CardContent>
          </Card>
        </div>

        {result ? (
          <Card>
            <CardHeader>
              <CardTitle>Turning Point</CardTitle>
              <CardDescription>
                Voraussichtliches Rundenende: Tick {formatRes(roundEndTick)} ({clockLabel(cfg, roundEndTick)},{" "}
                {formatTimeUntil(roundEndTick - currentTick, cfg)})
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Profitabel ab"
                value={
                  <span className={breakEvenClass}>
                    {result.breakEvenTicks === null ? "nie" : formatDuration(result.breakEvenTicks, cfg)}
                  </span>
                }
                hint={
                  breakEvenTick === null || result.breakEvenTicks === null
                    ? "auch nicht nach Rundenende"
                    : `${formatRes(result.breakEvenTicks)} Ticks · ${clockLabel(cfg, breakEvenTick)}${breakEvenTick > roundEndTick ? " · nach Rundenende" : ""}`
                }
              />
              <Stat
                label="Mehr-Einkommen / Tick"
                value={signed(result.incomeWith - result.incomeWithout)}
                hint={`${signed((result.incomeWith - result.incomeWithout) * perDay)} pro Tag`}
              />
              <Stat
                label="Vorsprung bei voraussichtlichem Rundenende"
                value={
                  result.gainAtRoundEnd === null ? (
                    "–"
                  ) : (
                    <span className={result.gainAtRoundEnd >= 0 ? "text-green-500" : "text-destructive"}>
                      {signed(result.gainAtRoundEnd)}
                    </span>
                  )
                }
                hint={result.gainAtRoundEnd === null ? "Runde ist bereits vorbei" : "Rohstoffe mit Angriff im Vergleich zu ohne"}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
