import { useEffect, useMemo, useState } from "react";
import planData from "@/gn-data/plan.json";
import {
  calculateFastestWayToGoal,
  clockLabel,
  computeCurrentTick,
  formatEconomyOrderLabel,
  formatRes,
  formatTimeUntilTick,
  formatWallClock,
  getTechtree,
  getUnlockedTechs,
  isExtractorPlanEntry,
  maxAffordableExtractors,
  newEconomyOrderId,
  type EconomyOrder,
  type Job,
  type JobKind,
  type StartConfig,
  type TickSnapshot,
} from "@/lib/calculateFastestWayToGoal";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/shadcn/field";
import {
  InputGroup,
  InputGroupInput,
} from "@/components/shadcn/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "gn_tool.plan";
const FALLBACK_PLAN = ["Koloniezentrum"] as const;
const defaultConfig = planData as StartConfig;
/** Feste Meilensteine in der Übersicht (unabhängig vom letzten Plan-Eintrag). */
const MILESTONES = ["Extraktor", "Kaperschiff", "Schildschiff"] as const;

function normalizeConfig(raw: unknown): StartConfig {
  const base: StartConfig = {
    start_time: defaultConfig.start_time,
    start_date: defaultConfig.start_date,
    starting_resources: {
      metall: defaultConfig.starting_resources.metall,
      kristall: defaultConfig.starting_resources.kristall,
    },
    plan: defaultConfig.plan?.length ? [...defaultConfig.plan] : [...FALLBACK_PLAN],
    economyOrders: normalizeEconomyOrders(
      (defaultConfig as { economyOrders?: unknown }).economyOrders,
    ),
  };

  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<StartConfig>;

  const start_time =
    typeof obj.start_time === "string" && obj.start_time.trim()
      ? obj.start_time
      : base.start_time;
  const start_date =
    typeof obj.start_date === "string" && obj.start_date.trim()
      ? obj.start_date
      : base.start_date;

  const res = obj.starting_resources;
  const metall =
    res && typeof res.metall === "number" && Number.isFinite(res.metall)
      ? res.metall
      : base.starting_resources.metall;
  const kristall =
    res && typeof res.kristall === "number" && Number.isFinite(res.kristall)
      ? res.kristall
      : base.starting_resources.kristall;

  const plan =
    Array.isArray(obj.plan) && obj.plan.every((x) => typeof x === "string") && obj.plan.length > 0
      ? [...obj.plan]
      : base.plan;

  const economyOrders = normalizeEconomyOrders(
    (obj as { economyOrders?: unknown }).economyOrders,
  );

  return {
    start_time,
    start_date,
    starting_resources: { metall, kristall },
    plan,
    economyOrders,
  };
}

function normalizeEconomyOrders(raw: unknown): EconomyOrder[] {
  if (!Array.isArray(raw)) return [];
  const out: EconomyOrder[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : newEconomyOrderId();
    const count = typeof o.count === "number" && o.count > 0 ? Math.floor(o.count) : 0;
    const atTick =
      typeof o.atTick === "number" && Number.isFinite(o.atTick)
        ? Math.max(0, Math.floor(o.atTick))
        : 0;
    if (!count) continue;
    if (o.kind === "asteroids") {
      out.push({ id, kind: "asteroids", count, atTick });
    } else if (o.kind === "extractors") {
      const resource = o.resource === "kris" ? "kris" : "met";
      out.push({ id, kind: "extractors", count, resource, atTick });
    }
  }
  return out;
}

function loadStoredConfig(): StartConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = normalizeConfig(defaultConfig);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return normalizeConfig(defaultConfig);
  }
}

export default function App() {
  const [startCfg, setStartCfg] = useState<StartConfig>(() => loadStoredConfig());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(startCfg));
    } catch (err) {
      console.error("Konnte Plan nicht speichern", err);
    }
  }, [startCfg]);

  const planNames = startCfg.plan;
  const economyOrders = startCfg.economyOrders ?? [];
  const hasObservatorium = planNames.includes("Observatorium");
  const hasExtraktorTech = planNames.includes("Extraktor");
  const canUseEconomy = hasExtraktorTech; // laut Spec: Extraktor-Tech freischalten

  const plan = useMemo(() => {
    try {
      return calculateFastestWayToGoal(startCfg);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [startCfg]);

  /** Default-Tick: Fertigstellung Extraktor (bzw. Observatorium). */
  const defaultEconomyTick = useMemo(() => {
    if (!plan) return 0;
    const ext = plan.steps.find((s) => s.name === "Extraktor");
    if (ext) return ext.endTick;
    const obs = plan.steps.find((s) => s.name === "Observatorium");
    return obs?.endTick ?? plan.finishTick;
  }, [plan]);

  /** Max. Extraktoren finanzierbar zum Zeitpunkt der Extraktor-Tech-Fertigstellung. */
  const maxExtractorsAtTech = useMemo(() => {
    if (!plan || !hasExtraktorTech) return 0;
    const job = plan.steps.find((s) => s.name === "Extraktor");
    if (!job) return 0;
    const snap = plan.ticks.find((t) => t.tick === job.endTick);
    let met = snap?.met ?? plan.finalRes.met;
    let kris = snap?.kris ?? plan.finalRes.kris;
    for (const s of plan.steps) {
      if (s.startTick === job.endTick && s.type === "economy") {
        met += s.cost.met;
        kris += s.cost.kris;
      }
    }
    return maxAffordableExtractors({
      met,
      kris,
      alreadyBuilt: 0,
      asteroids: 0,
      slots: 0,
    });
  }, [plan, hasExtraktorTech]);

  const [asteroidCount, setAsteroidCount] = useState(1);
  const [asteroidTick, setAsteroidTick] = useState(0);
  const [extractorCount, setExtractorCount] = useState(1);
  const [extractorResource, setExtractorResource] = useState<"met" | "kris">("met");
  const [extractorTick, setExtractorTick] = useState(0);

  useEffect(() => {
    setAsteroidTick(defaultEconomyTick);
    setExtractorTick(defaultEconomyTick);
  }, [defaultEconomyTick]);

  useEffect(() => {
    if (canUseEconomy && maxExtractorsAtTech > 0) {
      setExtractorCount(maxExtractorsAtTech);
    }
  }, [canUseEconomy, maxExtractorsAtTech]);

  const unlocked = useMemo(() => getUnlockedTechs(planNames), [planNames]);
  const techByName = useMemo(() => {
    const m = new Map(getTechtree().map((t) => [t.name, t]));
    return m;
  }, []);

  const maxTick = Math.max(plan?.finishTick ?? 1, 1);
  const actionTicks = useMemo(
    () => (plan ? plan.ticks.filter((t) => t.started.length > 0) : []),
    [plan],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentTick = computeCurrentTick(startCfg, now);
  const upcomingActions = useMemo(
    () => actionTicks.filter((t) => t.tick >= currentTick).slice(0, 3),
    [actionTicks, currentTick],
  );
  const nextAction = upcomingActions[0] ?? null;
  const followingActions = upcomingActions.slice(1);

  const addToPlan = (name: string) => {
    setStartCfg((prev) =>
      prev.plan.includes(name)
        ? prev
        : { ...prev, plan: [...prev.plan, name] },
    );
  };

  const addAsteroidOrder = () => {
    const count = Math.max(1, Math.floor(asteroidCount) || 1);
    const atTick = Math.max(0, Math.floor(asteroidTick) || 0);
    const order: EconomyOrder = {
      id: newEconomyOrderId(),
      kind: "asteroids",
      count,
      atTick,
    };
    setStartCfg((prev) => ({
      ...prev,
      economyOrders: [...(prev.economyOrders ?? []), order],
    }));
  };

  const addExtractorOrder = () => {
    const count = Math.max(1, Math.floor(extractorCount) || 1);
    const atTick = Math.max(0, Math.floor(extractorTick) || 0);
    const order: EconomyOrder = {
      id: newEconomyOrderId(),
      kind: "extractors",
      count,
      resource: extractorResource,
      atTick,
    };
    setStartCfg((prev) => ({
      ...prev,
      economyOrders: [...(prev.economyOrders ?? []), order],
    }));
  };

  const removeEconomyOrder = (id: string) => {
    setStartCfg((prev) => ({
      ...prev,
      economyOrders: (prev.economyOrders ?? []).filter((o) => o.id !== id),
    }));
  };

  const removeFromPlan = (index: number) => {
    setStartCfg((prev) => {
      const next = prev.plan.filter((_, i) => i !== index);
      return {
        ...prev,
        plan: next.length > 0 ? next : [...FALLBACK_PLAN],
      };
    });
  };

  const movePlanItem = (index: number, direction: -1 | 1) => {
    setStartCfg((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.plan.length) return prev;
      const next = [...prev.plan];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return { ...prev, plan: next };
    });
  };

  const resetPlan = () => {
    setStartCfg(normalizeConfig(defaultConfig));
  };

  return (
    <TooltipProvider>
      <main className="min-h-svh bg-background text-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
          {/* Übersicht */}
          <Card>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 md:gap-8">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Aktuell
                    </p>
                    <p className="mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums">
                      {formatWallClock(now)}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                      {currentTick < 0
                        ? `Start in ${Math.abs(currentTick)} Ticks`
                        : `Tick ${currentTick}`}
                    </p>
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Meilensteine
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {MILESTONES.map((name) => {
                        const job = plan?.steps.find((s) => s.name === name);
                        const finishTick = job?.endTick;
                        return (
                          <li key={name} className="text-sm">
                            <p className="font-medium">{name}</p>
                            {finishTick !== undefined ? (
                              <>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  Tick {finishTick} · {clockLabel(startCfg, finishTick)}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {formatTimeUntilTick(startCfg, finishTick, now)}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">noch nicht im Plan</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {!plan && (
                      <p className="mt-2 text-sm text-destructive">Plan nicht berechenbar</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-8">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Nächste Aktion
                  </p>
                  {nextAction ? (
                    <Card size="sm" className="bg-background/50 ring-foreground/5">
                      <CardContent className="flex flex-col gap-1.5">
                        <p className="text-sm font-medium tabular-nums">
                          Tick {nextAction.tick} · {nextAction.clockLabel}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatTimeUntilTick(startCfg, nextAction.tick, now)}
                        </p>
                        <div className="text-sm leading-snug">
                          <JobList items={nextAction.started} />
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-sm text-muted-foreground">Keine weiteren Aktionen</p>
                  )}

                  {followingActions.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1">
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Danach
                      </p>
                      <ul className="flex flex-col gap-2">
                        {followingActions.map((t) => (
                          <li key={t.tick}>
                            <Card size="sm" className="ring-foreground/5">
                              <CardContent className="flex flex-col gap-1 py-2">
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  Tick {t.tick} · {t.clockLabel}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {formatTimeUntilTick(startCfg, t.tick, now)}
                                </p>
                                <div className="text-sm leading-snug">
                                  <JobList items={t.started} />
                                </div>
                              </CardContent>
                            </Card>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {plan ? (
                <Timeline steps={plan.steps} maxTick={maxTick} />
              ) : (
                <p className="text-sm text-muted-foreground">Kein Plan berechenbar.</p>
              )}
            </CardContent>
          </Card>

          {/* Gebäude & Forschung */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Gebäude & Forschung</CardTitle>
              <CardDescription>
                Links freigeschaltete Technologien wählen — sie werden dem Plan hinzugefügt.
              </CardDescription>
              <CardAction>
                <Button type="button" variant="outline" size="sm" onClick={resetPlan}>
                  Zurücksetzen
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Verfügbar */}
                <Card size="sm" className="h-[28rem] max-h-[50vh] min-h-[16rem] bg-background/40">
                  <CardHeader className="border-b py-2">
                    <CardTitle className="text-[11px] tracking-wide text-muted-foreground uppercase">
                      Verfügbar ({unlocked.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-auto p-2">
                    <ul className="flex flex-col gap-1">
                      {unlocked.length === 0 ? (
                        <li className="px-2 py-3 text-sm text-muted-foreground">
                          Keine weiteren freigeschalteten Technologien
                        </li>
                      ) : (
                        unlocked.map((tech) => (
                          <li key={tech.name}>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => addToPlan(tech.name)}
                              className="h-auto w-full justify-between gap-2 px-2 py-2 text-left font-normal whitespace-normal"
                            >
                              <span className="min-w-0">
                                <span className={jobTypeClass(tech.type)}>{tech.name}</span>
                                <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                                  {tech.ticks} Ticks · {formatRes(tech.cost.met)} Met ·{" "}
                                  {formatRes(tech.cost.kris)} Kris
                                </span>
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">+</span>
                            </Button>
                          </li>
                        ))
                      )}
                    </ul>
                  </CardContent>
                </Card>

                {/* Plan */}
                <Card size="sm" className="h-[28rem] max-h-[50vh] min-h-[16rem] bg-background/40">
                  <CardHeader className="border-b py-2">
                    <CardTitle className="text-[11px] tracking-wide text-muted-foreground uppercase">
                      Plan ({planNames.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-auto p-2">
                    <ol className="flex flex-col gap-1">
                      {planNames.map((name, i) => {
                        const tech = techByName.get(name);
                        const isEcon = isExtractorPlanEntry(name);
                        const fin = plan?.stepFinishTicks[i];
                        const canUp = i > 0;
                        const canDown = i < planNames.length - 1;
                        return (
                          <li
                            key={`${name}-${i}`}
                            className="flex items-start justify-between gap-2 rounded-md border border-border/60 px-2 py-2 text-sm"
                          >
                            <span className="min-w-0">
                              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>{" "}
                              <span
                                className={
                                  tech
                                    ? jobTypeClass(tech.type)
                                    : isEcon
                                      ? jobTypeClass("economy")
                                      : ""
                                }
                              >
                                {name}
                              </span>
                              {fin !== undefined && fin >= 0 && (
                                <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                                  fertig Tick {fin}
                                  {plan ? ` · ${clockLabel(startCfg, fin)}` : ""}
                                </span>
                              )}
                            </span>
                            <span className="flex shrink-0 items-center gap-0.5">
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => movePlanItem(i, -1)}
                                      disabled={!canUp}
                                    />
                                  }
                                >
                                  ↑
                                </TooltipTrigger>
                                <TooltipContent>Nach oben</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => movePlanItem(i, 1)}
                                      disabled={!canDown}
                                    />
                                  }
                                >
                                  ↓
                                </TooltipTrigger>
                                <TooltipContent>Nach unten</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => removeFromPlan(i)}
                                    />
                                  }
                                >
                                  ×
                                </TooltipTrigger>
                                <TooltipContent>Entfernen</TooltipContent>
                              </Tooltip>
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Extraktoren & Einheiten */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Extraktoren & Einheiten</CardTitle>
              <CardDescription>
                Asteroiden und Extraktoren mit Ziel-Tick planen. Verfügbar sobald Extraktor im
                Tech-Plan ist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!canUseEconomy ? (
                <p className="text-sm text-muted-foreground">
                  Noch gesperrt — füge zuerst{" "}
                  <span className="font-medium text-foreground">Extraktor</span> im
                  Gebäude-&-Forschung-Plan hinzu.
                  {hasObservatorium ? "" : " (Observatorium wird für Asteroiden-Scans benötigt.)"}
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Asteroiden scannen */}
                    <Card size="sm" className="bg-background/40">
                      <CardHeader>
                        <CardTitle className="text-[11px] tracking-wide text-muted-foreground uppercase">
                          Asteroiden scannen
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FieldGroup className="gap-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <Field className="w-28">
                              <FieldLabel htmlFor="asteroid-count">Anzahl</FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="asteroid-count"
                                  type="number"
                                  min={1}
                                  value={asteroidCount}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (!Number.isFinite(n)) return;
                                    setAsteroidCount(Math.max(1, Math.floor(n)));
                                  }}
                                  className="tabular-nums"
                                />
                              </InputGroup>
                            </Field>
                            <Field className="w-28">
                              <FieldLabel htmlFor="asteroid-tick">Ab Tick</FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="asteroid-tick"
                                  type="number"
                                  min={0}
                                  value={asteroidTick}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (!Number.isFinite(n)) return;
                                    setAsteroidTick(Math.max(0, Math.floor(n)));
                                  }}
                                  className="tabular-nums"
                                />
                              </InputGroup>
                            </Field>
                            <Button type="button" variant="secondary" size="sm" onClick={addAsteroidOrder}>
                              Hinzufügen
                            </Button>
                          </div>
                          <FieldDescription className="tabular-nums">
                            Vorschlag Tick {defaultEconomyTick}
                            {plan ? ` · ${clockLabel(startCfg, defaultEconomyTick)}` : ""} · 10.000
                            Kris / Asteroid
                          </FieldDescription>
                        </FieldGroup>
                      </CardContent>
                    </Card>

                    {/* Extraktoren bauen */}
                    <Card size="sm" className="bg-background/40">
                      <CardHeader>
                        <CardTitle className="text-[11px] tracking-wide text-muted-foreground uppercase">
                          Extraktoren bauen
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FieldGroup className="gap-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <Field className="w-28">
                              <FieldLabel htmlFor="extractor-count">Anzahl</FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="extractor-count"
                                  type="number"
                                  min={1}
                                  value={extractorCount}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (!Number.isFinite(n)) return;
                                    setExtractorCount(Math.max(1, Math.floor(n)));
                                  }}
                                  className="tabular-nums"
                                />
                              </InputGroup>
                            </Field>
                            <Field className="w-28">
                              <FieldLabel htmlFor="extractor-tick">Ab Tick</FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id="extractor-tick"
                                  type="number"
                                  min={0}
                                  value={extractorTick}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (!Number.isFinite(n)) return;
                                    setExtractorTick(Math.max(0, Math.floor(n)));
                                  }}
                                  className="tabular-nums"
                                />
                              </InputGroup>
                            </Field>
                            <FieldSet className="w-auto gap-1.5">
                              <FieldLegend variant="label">Typ</FieldLegend>
                              <RadioGroup
                                value={extractorResource}
                                onValueChange={(value) => {
                                  if (value === "met" || value === "kris") {
                                    setExtractorResource(value);
                                  }
                                }}
                                className="flex w-auto flex-row gap-3"
                              >
                                <Field orientation="horizontal" className="w-auto">
                                  <RadioGroupItem value="met" id="extractor-res-met" />
                                  <FieldLabel htmlFor="extractor-res-met" className="font-normal">
                                    Metall
                                  </FieldLabel>
                                </Field>
                                <Field orientation="horizontal" className="w-auto">
                                  <RadioGroupItem value="kris" id="extractor-res-kris" />
                                  <FieldLabel htmlFor="extractor-res-kris" className="font-normal">
                                    Kristall
                                  </FieldLabel>
                                </Field>
                              </RadioGroup>
                            </FieldSet>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={addExtractorOrder}
                            >
                              Hinzufügen
                            </Button>
                          </div>
                          <FieldDescription className="tabular-nums">
                            Max. nach Extraktor-Tech: {maxExtractorsAtTech} · braucht
                            Asteroiden-Slots (20 / Asteroid)
                          </FieldDescription>
                        </FieldGroup>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Geplante Economy-Orders */}
                  <Card size="sm" className="bg-background/40">
                    <CardHeader className="border-b py-2">
                      <CardTitle className="text-[11px] tracking-wide text-muted-foreground uppercase">
                        Geplant ({economyOrders.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {economyOrders.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-muted-foreground">
                          Noch keine Economy-Aktionen.
                        </p>
                      ) : (
                        <ul className="divide-y divide-border/60">
                          {economyOrders.map((order) => {
                            const fin = plan?.economyOrderFinishTicks[order.id];
                            return (
                              <li
                                key={order.id}
                                className="flex items-start justify-between gap-2 px-3 py-2 text-sm"
                              >
                                <span className="min-w-0">
                                  <span className={jobTypeClass("economy")}>
                                    {formatEconomyOrderLabel(order)}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                                    geplant ab Tick {order.atTick}
                                    {plan ? ` · ${clockLabel(startCfg, order.atTick)}` : ""}
                                    {fin !== undefined
                                      ? ` · fertig Tick ${fin} · ${clockLabel(startCfg, fin)}`
                                      : " · noch nicht erfüllt"}
                                  </span>
                                </span>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => removeEconomyOrder(order.id)}
                                      />
                                    }
                                  >
                                    ×
                                  </TooltipTrigger>
                                  <TooltipContent>Entfernen</TooltipContent>
                                </Tooltip>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Nur Ticks mit User-Aktion (Start) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aktionsplan</CardTitle>
            </CardHeader>
            <CardContent>
              {plan ? (
                <TickTable ticks={actionTicks} variant="actions" currentTick={currentTick} />
              ) : (
                <p className="text-sm text-muted-foreground">Kein Plan berechenbar.</p>
              )}
            </CardContent>
          </Card>

          {/* Vollständiges Tick-Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tick-Protokoll</CardTitle>
            </CardHeader>
            <CardContent>
              {plan ? (
                <TickTable
                  ticks={plan.ticks}
                  variant="log"
                  currentTick={currentTick}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Kein Plan berechenbar.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </TooltipProvider>
  );
}

function deltaClass(n: number) {
  if (n > 0) return "text-green-500";
  if (n < 0) return "text-red-500";
  return "";
}

function formatDelta(n: number) {
  if (!n) return "—";
  return `${n > 0 ? "+" : ""}${formatRes(n)}`;
}

function TickTable({
  ticks,
  variant = "log",
  currentTick,
}: {
  ticks: TickSnapshot[];
  variant?: "actions" | "log";
  currentTick: number;
}) {
  const showResources = variant === "log";
  const highlightTick = ticks.reduce<number | null>((best, t) => {
    if (t.tick > currentTick) return best;
    if (best === null || t.tick > best) return t.tick;
    return best;
  }, null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tick</TableHead>
          <TableHead>Uhrzeit</TableHead>
          {showResources && (
            <>
              <TableHead className="text-right">Met</TableHead>
              <TableHead className="text-right">Kris</TableHead>
              <TableHead className="text-right">+M</TableHead>
              <TableHead className="text-right">+K</TableHead>
            </>
          )}
          <TableHead>Aktiv</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>Ende</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ticks.map((t) => {
          const isCurrent = highlightTick !== null && t.tick === highlightTick;
          return (
            <TableRow key={t.tick}>
              <TableCell>{t.tick}</TableCell>
              <TableCell className={cn(isCurrent && "text-green-500")}>
                {t.clockLabel}
              </TableCell>
              {showResources && (
                <>
                  <TableCell className="text-right">{formatRes(t.met)}</TableCell>
                  <TableCell className="text-right">{formatRes(t.kris)}</TableCell>
                  <TableCell className={cn("text-right", deltaClass(t.incomeMet))}>
                    {formatDelta(t.incomeMet)}
                  </TableCell>
                  <TableCell className={cn("text-right", deltaClass(t.incomeKris))}>
                    {formatDelta(t.incomeKris)}
                  </TableCell>
                </>
              )}
              <TableCell>
                {t.active.length ? (
                  <JobList
                    items={t.active.map((j) => ({
                      name: j.name,
                      type: j.type,
                      suffix: `(${j.remainingTicks})`,
                    }))}
                  />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {t.started.length ? <JobList items={t.started} /> : "—"}
              </TableCell>
              <TableCell>
                {t.finished.length ? <JobList items={t.finished} /> : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function jobTypeClass(type: JobKind) {
  if (type === "building") return "text-amber-500";
  if (type === "research") return "text-fuchsia-500";
  return "text-sky-500";
}

type DisplayJob = { name: string; type: JobKind; suffix?: string };

/** Asteroiden/Extraktoren pro Tick zusammenfassen statt einzeln zu listen. */
function collapseEconomyJobs(items: DisplayJob[]): DisplayJob[] {
  let asteroids = 0;
  let extractorsMet = 0;
  let extractorsKris = 0;
  let extractorsGeneric = 0;
  const rest: DisplayJob[] = [];

  for (const item of items) {
    // Nur Economy-Jobs zusammenfassen — nicht die Tech "Extraktor"
    if (item.type === "economy" && item.name.startsWith("Asteroid scannen")) {
      asteroids += 1;
      continue;
    }
    if (item.type === "economy" && item.name.startsWith("Extraktor (Metall)")) {
      extractorsMet += 1;
      continue;
    }
    if (item.type === "economy" && item.name.startsWith("Extraktor (Kristall)")) {
      extractorsKris += 1;
      continue;
    }
    if (item.type === "economy" && /^Extraktor\b/.test(item.name)) {
      extractorsGeneric += 1;
      continue;
    }
    rest.push(item);
  }

  const out: DisplayJob[] = [];
  if (asteroids > 0) {
    out.push({
      name:
        asteroids === 1
          ? "1 Asteroid scannen"
          : `${asteroids} Asteroiden scannen`,
      type: "economy",
    });
  }
  if (extractorsMet > 0) {
    out.push({
      name:
        extractorsMet === 1
          ? "1 Metallextraktor bauen"
          : `${extractorsMet} Metallextraktoren bauen`,
      type: "economy",
    });
  }
  if (extractorsKris > 0) {
    out.push({
      name:
        extractorsKris === 1
          ? "1 Kristallextraktor bauen"
          : `${extractorsKris} Kristallextraktoren bauen`,
      type: "economy",
    });
  }
  if (extractorsGeneric > 0) {
    out.push({
      name:
        extractorsGeneric === 1
          ? "1 Extraktor bauen"
          : `${extractorsGeneric} Extraktoren bauen`,
      type: "economy",
    });
  }
  return [...out, ...rest];
}

function JobList({
  items,
}: {
  items: DisplayJob[];
}) {
  const collapsed = collapseEconomyJobs(items);
  return (
    <span className="inline">
      {collapsed.map((item, i) => (
        <span key={`${item.name}-${i}`}>
          {i > 0 && <span className="text-muted-foreground">, </span>}
          <span className={jobTypeClass(item.type)}>
            {item.name}
            {item.suffix ? (
              <span className="text-muted-foreground"> {item.suffix}</span>
            ) : null}
          </span>
        </span>
      ))}
    </span>
  );
}

function Timeline({ steps, maxTick }: { steps: Job[]; maxTick: number }) {
  const rows: Job[][] = [];
  const sorted = [...steps]
    .filter((s) => s.type !== "economy")
    .sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick);
  for (const job of sorted) {
    let placed = false;
    for (const row of rows) {
      const last = row[row.length - 1];
      if (last.endTick <= job.startTick) {
        row.push(job);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([job]);
  }

  const rowHeight = 36;
  const height = Math.max(rows.length, 1) * rowHeight + 8;
  const markers: number[] = [];
  for (let t = 0; t <= maxTick; t += 12) markers.push(t);
  if (markers[markers.length - 1] !== maxTick) markers.push(maxTick);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative rounded-md bg-muted/50" style={{ height }}>
        {rows.map((row, rowIndex) =>
          row.map((s) => {
            const left = (s.startTick / maxTick) * 100;
            const width = Math.max(((s.endTick - s.startTick) / maxTick) * 100, 0.5);
            const isBuilding = s.type === "building";
            const top = 4 + rowIndex * rowHeight;
            return (
              <div
                key={`${s.name}-${s.startTick}`}
                title={`${s.name}: t${s.startTick}–${s.endTick}`}
                className={[
                  "absolute overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] leading-tight shadow-sm",
                  isBuilding
                    ? "bg-amber-500 text-amber-950"
                    : "bg-fuchsia-500 text-fuchsia-950",
                ].join(" ")}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top,
                  height: rowHeight - 8,
                }}
              >
                <span className="block truncate font-semibold">{s.name}</span>
              </div>
            );
          }),
        )}
      </div>
      <div className="relative h-6 border-t border-border pt-1">
        {markers.map((t) => (
          <span
            key={t}
            className="absolute text-[10px] text-muted-foreground tabular-nums"
            style={{
              left: `${(t / maxTick) * 100}%`,
              transform:
                t === 0 ? "none" : t === maxTick ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
