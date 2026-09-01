import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Field, FieldLabel } from "@/components/shadcn/field";
import { Input } from "@/components/shadcn/input";
import { InputGroup, InputGroupInput } from "@/components/shadcn/input-group";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/shadcn/combobox";
import {
  ASTEROID_COST,
  ASTEROID_SLOT_CAPACITY,
  extractorBatchCost,
  extractorUnitCost,
  formatRes,
  formatRoidPlanLabel,
  maxAffordableExtractors,
  ROID_DURATION_MAX,
  ROID_DURATION_MIN,
  roidsOverlap,
  type PlanEntry,
} from "@/lib/calculateFastestWayToGoal";
import type { TechTreeEntry } from "@/gn-data/techtree";
import type { Ship } from "@/gn-data/ships";
import type { Utility } from "@/gn-data/utility";

const ROID_DURATION_ITEMS = Array.from(
  { length: ROID_DURATION_MAX - ROID_DURATION_MIN + 1 },
  (_, i) => String(ROID_DURATION_MIN + i),
);

export type PlanEntryDialogMode = "add" | "edit";

type TechTarget = {
  kind: "tech";
  tech: TechTreeEntry;
  defaultTick: number;
};

type CountableTarget = {
  kind: "unit" | "recon";
  name: string;
  ticks: number;
  cost: { met: number; kris: number };
  dependencies: string[];
  defaultTick: number;
  defaultCount: number;
  maxCount: number;
};

/** Unified asteroids + extractors dialog target. */
type EconomyTarget = {
  kind: "economy";
  defaultTick: number;
  defaultAsteroids: number;
  defaultExtractorsMet: number;
  defaultExtractorsKris: number;
  /** Free slots before this entry's own asteroids/extractors. */
  freeSlots: number;
  asteroidsOwned: number;
  alreadyBuilt: number;
  /** Whether Observatorium is available for asteroid part. */
  canAsteroids: boolean;
  /** Whether Extraktor tech is available. */
  canExtractors: boolean;
  costKrisPerAsteroid: number;
};

type CustomTarget = {
  kind: "custom";
  defaultTick: number;
  defaultLabel: string;
  defaultMet: number;
  defaultKris: number;
};

export type OccupiedRoid = {
  startTick: number;
  duration: number;
  targetMet: number;
  targetKris: number;
};

type RoidTarget = {
  kind: "roid";
  defaultTick: number;
  defaultTargetMet: number;
  defaultTargetKris: number;
  defaultDuration: number;
  occupiedRoids: OccupiedRoid[];
};

export type PlanEntryDialogTarget =
  | TechTarget
  | CountableTarget
  | EconomyTarget
  | CustomTarget
  | RoidTarget;

export type PlanEntryDialogSubmit = {
  startTick: number;
  count?: number;
  asteroids?: number;
  extractorsMet?: number;
  extractorsKris?: number;
  label?: string;
  cost?: { met: number; kris: number };
  targetMet?: number;
  targetKris?: number;
  duration?: number;
};

export type PlanEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PlanEntryDialogMode;
  target: PlanEntryDialogTarget | null;
  /** Existing entry when editing. */
  entry?: PlanEntry | null;
  onSubmit: (values: PlanEntryDialogSubmit) => void;
  onRemove?: () => void;
  /** Dynamic max/count when tick changes (units/recon). */
  resolveMaxCount?: (startTick: number) => number;
  resolveEconomyAtTick?: (startTick: number) => {
    freeSlots: number;
    asteroids: number;
    alreadyBuilt: number;
    /** Ressourcen am Tick (ggf. mit Edit-Refund des aktuellen Eintrags). */
    met: number;
    kris: number;
  };
};

export function PlanEntryDialog({
  open,
  onOpenChange,
  mode,
  target,
  entry,
  onSubmit,
  onRemove,
  resolveMaxCount,
  resolveEconomyAtTick,
}: PlanEntryDialogProps) {
  const [startTick, setStartTick] = useState(0);
  const [count, setCount] = useState(1);
  const [asteroidCount, setAsteroidCount] = useState(0);
  const [extractorMetCount, setExtractorMetCount] = useState(0);
  const [extractorKrisCount, setExtractorKrisCount] = useState(0);
  const [label, setLabel] = useState("");
  const [met, setMet] = useState(0);
  const [kris, setKris] = useState(0);
  const [targetMet, setTargetMet] = useState(0);
  const [targetKris, setTargetKris] = useState(0);
  const [duration, setDuration] = useState(ROID_DURATION_MIN);

  useEffect(() => {
    if (!open || !target) return;
    if (mode === "edit" && entry) {
      setStartTick(entry.startTick);
      if (entry.kind === "economy") {
        setAsteroidCount(Math.max(0, entry.asteroids));
        setExtractorMetCount(Math.max(0, entry.extractorsMet));
        setExtractorKrisCount(Math.max(0, entry.extractorsKris));
        return;
      }
      if (entry.kind === "asteroids") {
        setAsteroidCount(Math.max(0, entry.count));
        setExtractorMetCount(0);
        setExtractorKrisCount(0);
        return;
      }
      if (entry.kind === "extractors") {
        setAsteroidCount(0);
        setExtractorMetCount(entry.resource === "met" ? Math.max(0, entry.count) : 0);
        setExtractorKrisCount(entry.resource === "kris" ? Math.max(0, entry.count) : 0);
        return;
      }
      if (entry.kind === "custom") {
        setLabel(entry.label);
        setMet(Math.max(0, entry.cost.met));
        setKris(Math.max(0, entry.cost.kris));
        return;
      }
      if (entry.kind === "roid") {
        setTargetMet(Math.max(0, entry.targetMet));
        setTargetKris(Math.max(0, entry.targetKris));
        setDuration(
          Math.min(ROID_DURATION_MAX, Math.max(ROID_DURATION_MIN, entry.duration)),
        );
        return;
      }
      if ("count" in entry) setCount(entry.count);
      return;
    }

    setStartTick(target.defaultTick);
    if (target.kind === "unit" || target.kind === "recon") {
      setCount(Math.max(1, target.defaultCount));
    } else if (target.kind === "economy") {
      setAsteroidCount(Math.max(0, target.defaultAsteroids));
      setExtractorMetCount(Math.max(0, target.defaultExtractorsMet));
      setExtractorKrisCount(Math.max(0, target.defaultExtractorsKris));
    } else if (target.kind === "custom") {
      setLabel(target.defaultLabel);
      setMet(Math.max(0, target.defaultMet));
      setKris(Math.max(0, target.defaultKris));
    } else if (target.kind === "roid") {
      setTargetMet(Math.max(0, target.defaultTargetMet));
      setTargetKris(Math.max(0, target.defaultTargetKris));
      setDuration(
        Math.min(
          ROID_DURATION_MAX,
          Math.max(ROID_DURATION_MIN, target.defaultDuration),
        ),
      );
    } else {
      setCount(1);
    }
  }, [open, target, mode, entry]);

  const liveMax = useMemo(() => {
    if (!target) return 1;
    if (resolveMaxCount) return Math.max(0, resolveMaxCount(startTick));
    if (target.kind === "unit" || target.kind === "recon") return target.maxCount;
    return 999;
  }, [target, startTick, resolveMaxCount]);

  const liveEconomy = useMemo(() => {
    if (!target || target.kind !== "economy") return null;
    if (resolveEconomyAtTick) return resolveEconomyAtTick(startTick);
    return {
      freeSlots: target.freeSlots,
      asteroids: target.asteroidsOwned,
      alreadyBuilt: target.alreadyBuilt,
      met: 0,
      kris: 0,
    };
  }, [target, startTick, resolveEconomyAtTick]);

  const unitTotalCost = useMemo(() => {
    if (!target || (target.kind !== "unit" && target.kind !== "recon")) return null;
    const n = Math.max(0, count);
    return {
      met: target.cost.met * n,
      kris: target.cost.kris * n,
    };
  }, [target, count]);

  const economyCosts = useMemo(() => {
    if (!target || target.kind !== "economy" || !liveEconomy) return null;
    const a = Math.max(0, asteroidCount);
    const e = Math.max(0, extractorMetCount + extractorKrisCount);
    const costPerAst = target.costKrisPerAsteroid || ASTEROID_COST.kris;
    const slotsFromNew = a * ASTEROID_SLOT_CAPACITY;
    const freeAfterAst = liveEconomy.freeSlots + slotsFromNew;
    const alreadyBuilt = liveEconomy.alreadyBuilt;
    const totalKris = a * costPerAst;
    // Asteroiden zuerst zahlen → restliches Metall bestimmt Max-Extraktoren.
    const krisAfterAst = Math.max(0, liveEconomy.kris - totalKris);
    const maxExtractors = maxAffordableExtractors({
      met: liveEconomy.met,
      kris: krisAfterAst,
      alreadyBuilt,
      asteroids: liveEconomy.asteroids + a,
      slots: alreadyBuilt + freeAfterAst,
      allowBuyAsteroids: false,
    });
    const nextCost = e > 0 ? extractorUnitCost(alreadyBuilt + 1) : 0;
    const totalMet = extractorBatchCost(alreadyBuilt, e);
    return {
      alreadyBuilt,
      freeAfterAst,
      nextCost,
      totalMet,
      totalKris,
      maxExtractors,
    };
  }, [target, liveEconomy, asteroidCount, extractorMetCount, extractorKrisCount]);

  if (!target) return null;

  const title = (() => {
    if (target.kind === "tech") return target.tech.name;
    if (target.kind === "unit" || target.kind === "recon") return target.name;
    if (target.kind === "custom") return label.trim() || "Custom-Ausgabe";
    if (target.kind === "roid") {
      return targetMet > 0 || targetKris > 0
        ? formatRoidPlanLabel(targetMet, targetKris)
        : "Roid";
    }
    return "Asteroiden & Extraktoren";
  })();

  const canSubmit = (() => {
    if (startTick < 0) return false;
    if (target.kind === "tech") return true;
    if (target.kind === "unit" || target.kind === "recon") {
      return count >= 1 && count <= Math.max(1, liveMax);
    }
    if (target.kind === "economy") {
      const a = Math.max(0, asteroidCount);
      const metEx = Math.max(0, extractorMetCount);
      const krisEx = Math.max(0, extractorKrisCount);
      if (a <= 0 && metEx <= 0 && krisEx <= 0) return false;
      if (a > 0 && !target.canAsteroids) return false;
      if ((metEx > 0 || krisEx > 0) && !target.canExtractors) return false;
      return true;
    }
    if (target.kind === "custom") {
      return label.trim().length > 0 && met >= 0 && kris >= 0;
    }
    if (target.kind === "roid") {
      if (targetMet <= 0 && targetKris <= 0) return false;
      if (duration < ROID_DURATION_MIN || duration > ROID_DURATION_MAX) return false;
      const overlaps = target.occupiedRoids.some((r) =>
        roidsOverlap(startTick, duration, r.startTick, r.duration),
      );
      return !overlaps;
    }
    return false;
  })();

  const overlappingRoid =
    target.kind === "roid"
      ? target.occupiedRoids.find((r) =>
          roidsOverlap(startTick, duration, r.startTick, r.duration),
        ) ?? null
      : null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (target.kind === "tech") {
      onSubmit({ startTick });
    } else if (target.kind === "economy") {
      onSubmit({
        startTick,
        asteroids: Math.max(0, asteroidCount),
        extractorsMet: Math.max(0, extractorMetCount),
        extractorsKris: Math.max(0, extractorKrisCount),
      });
    } else if (target.kind === "custom") {
      onSubmit({
        startTick,
        label: label.trim(),
        cost: { met: Math.max(0, met), kris: Math.max(0, kris) },
      });
    } else if (target.kind === "roid") {
      onSubmit({
        startTick,
        targetMet: Math.max(0, targetMet),
        targetKris: Math.max(0, targetKris),
        duration,
      });
    } else {
      onSubmit({ startTick, count: Math.max(1, count) });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Plan-Eintrag bearbeiten" : "Zum Plan hinzufügen"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          {target.kind === "tech" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Typ</dt>
              <dd>{target.tech.type === "building" ? "Gebäude" : "Forschung"}</dd>
              <dt className="text-muted-foreground">Dauer</dt>
              <dd className="tabular-nums">{target.tech.ticks} Ticks</dd>
              <dt className="text-muted-foreground">Kosten</dt>
              <dd className="tabular-nums">
                {formatRes(target.tech.cost.met)} M · {formatRes(target.tech.cost.kris)} K
              </dd>
              <dt className="text-muted-foreground">Voraussetzungen</dt>
              <dd>
                {target.tech.dependencies.length
                  ? target.tech.dependencies.join(", ")
                  : "—"}
              </dd>
            </dl>
          )}

          {(target.kind === "unit" || target.kind === "recon") && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Dauer / Stück</dt>
              <dd className="tabular-nums">{target.ticks} Ticks</dd>
              <dt className="text-muted-foreground">Kosten / Stück</dt>
              <dd className="tabular-nums">
                {formatRes(target.cost.met)} M · {formatRes(target.cost.kris)} K
              </dd>
              {unitTotalCost && (
                <>
                  <dt className="text-muted-foreground">Gesamtkosten</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {formatRes(unitTotalCost.met)} M · {formatRes(unitTotalCost.kris)} K
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Voraussetzungen</dt>
              <dd>
                {target.dependencies.length ? target.dependencies.join(", ") : "—"}
              </dd>
            </dl>
          )}

          {target.kind === "economy" && (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="tabular-nums">
                Besitzt: {liveEconomy?.asteroids ?? 0} Asteroiden ·{" "}
                {liveEconomy?.alreadyBuilt ?? 0} Extraktoren ·{" "}
                {liveEconomy?.freeSlots ?? 0} freie Slots
              </p>
              {economyCosts && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt>Asteroiden-Kosten</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {formatRes(economyCosts.totalKris)} K
                  </dd>
                  <dt>Extraktor-Kosten</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {formatRes(economyCosts.totalMet)} M
                    {extractorMetCount + extractorKrisCount > 0
                      ? ` (nächster ${formatRes(economyCosts.nextCost)} M)`
                      : ""}
                  </dd>
                  <dt>Slots nach Asteroiden</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {economyCosts.freeAfterAst}
                  </dd>
                </dl>
              )}
              {extractorMetCount + extractorKrisCount > 0 &&
                economyCosts &&
                extractorMetCount + extractorKrisCount > economyCosts.maxExtractors && (
                  <p className="text-amber-500">
                    Mehr Extraktoren als Slots/Metall bei diesem Tick — ohne Asteroidenplatz liefern sie keine Rohstoffe.
                  </p>
                )}
              {asteroidCount > 0 && !target.canAsteroids && (
                <p className="text-amber-500">Observatorium fehlt im Plan.</p>
              )}
              {(extractorMetCount > 0 || extractorKrisCount > 0) && !target.canExtractors && (
                <p className="text-amber-500">Extraktor-Tech fehlt im Plan.</p>
              )}
            </div>
          )}

          {target.kind === "custom" && (
            <Field className="w-full">
              <FieldLabel htmlFor="plan-custom-label">Label</FieldLabel>
              <Input
                id="plan-custom-label"
                type="text"
                value={label}
                placeholder="z.B. Scans, Umzug"
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
          )}

          {target.kind === "roid" && (
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p>
                Pro Tick 10% der restlichen Ziel-Exen (immer abgerundet), kostenlos.
                Ertrag ab dem nächsten Tick, Asteroidenplätze werden gebraucht.
              </p>
              {overlappingRoid && (
                <p className="text-amber-500">
                  Überlappt mit{" "}
                  {formatRoidPlanLabel(
                    overlappingRoid.targetMet,
                    overlappingRoid.targetKris,
                  )}
                  .
                </p>
              )}
            </div>
          )}

          <div className={target.kind === "economy" ? "flex flex-col gap-3" : "flex flex-wrap items-end gap-3"}>
            <Field className={target.kind === "economy" ? "w-full" : "w-28"}>
              <FieldLabel htmlFor="plan-start-tick">Start-Tick</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="plan-start-tick"
                  type="number"
                  min={0}
                  value={startTick}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setStartTick(Math.max(0, Math.floor(n)));
                  }}
                  className="tabular-nums"
                />
              </InputGroup>
            </Field>

            {(target.kind === "unit" || target.kind === "recon") && (
              <Field className="w-28">
                <FieldLabel htmlFor="plan-count">Anzahl</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="plan-count"
                    type="number"
                    min={1}
                    max={Math.max(1, liveMax)}
                    value={count}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setCount(Math.max(1, Math.floor(n)));
                    }}
                    className="tabular-nums"
                  />
                </InputGroup>
              </Field>
            )}

            {target.kind === "custom" && (
              <>
                <Field className="w-28">
                  <FieldLabel htmlFor="plan-custom-met">Metall</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="plan-custom-met"
                      type="number"
                      min={0}
                      value={met}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setMet(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
                <Field className="w-28">
                  <FieldLabel htmlFor="plan-custom-kris">Kristall</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="plan-custom-kris"
                      type="number"
                      min={0}
                      value={kris}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setKris(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
              </>
            )}

            {target.kind === "roid" && (
              <>
                <Field className="w-28">
                  <FieldLabel htmlFor="plan-roid-met">Target M-Exen</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="plan-roid-met"
                      type="number"
                      min={0}
                      value={targetMet}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setTargetMet(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
                <Field className="w-28">
                  <FieldLabel htmlFor="plan-roid-kris">Target K-Exen</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="plan-roid-kris"
                      type="number"
                      min={0}
                      value={targetKris}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setTargetKris(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
                <Field className="w-32">
                  <FieldLabel>Angriffslänge</FieldLabel>
                  <Combobox
                    items={ROID_DURATION_ITEMS}
                    value={String(duration)}
                    onValueChange={(value) => {
                      if (value == null) return;
                      const n = Number(value);
                      if (n >= ROID_DURATION_MIN && n <= ROID_DURATION_MAX) {
                        setDuration(n);
                      }
                    }}
                  >
                    <ComboboxInput showTrigger className="w-32" />
                    <ComboboxContent>
                      <ComboboxList>
                        {ROID_DURATION_ITEMS.map((item) => (
                          <ComboboxItem key={item} value={item}>
                            {item} {item === "1" ? "Tick" : "Ticks"}
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
              </>
            )}

            {target.kind === "economy" && (
              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel htmlFor="plan-asteroids">Asteroiden</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="plan-asteroids"
                      type="number"
                      min={0}
                      disabled={!target.canAsteroids}
                      value={asteroidCount}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setAsteroidCount(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-extractors-met">Met-Exen</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="plan-extractors-met"
                      type="number"
                      min={0}
                      disabled={!target.canExtractors}
                      value={extractorMetCount}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setExtractorMetCount(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-extractors-kris">Kris-Exen</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="plan-extractors-kris"
                      type="number"
                      min={0}
                      disabled={!target.canExtractors}
                      value={extractorKrisCount}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setExtractorKrisCount(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
              </div>
            )}
          </div>

          {(target.kind === "unit" || target.kind === "recon") && liveMax > 0 && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Max. bei Tick {startTick}: {liveMax}
            </p>
          )}

          {target.kind === "economy" && economyCosts && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Max. Extraktoren bei Tick {startTick} (Slots + Metall, nach Asteroiden-Kosten):{" "}
              {economyCosts.maxExtractors}
              {" · "}Slots: {economyCosts.freeAfterAst}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {mode === "edit" && onRemove ? (
            <Button type="button" variant="destructive" onClick={onRemove}>
              Entfernen
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
              {mode === "edit" ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Helper to build tech dialog target from TechTreeEntry. */
export function techDialogTarget(
  tech: TechTreeEntry,
  defaultTick: number,
): TechTarget {
  return { kind: "tech", tech, defaultTick };
}

export function shipDialogTarget(
  ship: Ship,
  defaultTick: number,
  defaultCount: number,
  maxCount: number,
): CountableTarget {
  return {
    kind: "unit",
    name: ship.name,
    ticks: ship.ticks,
    cost: ship.cost,
    dependencies: ship.dependencies,
    defaultTick,
    defaultCount,
    maxCount,
  };
}

export function reconDialogTarget(
  item: Utility,
  defaultTick: number,
  defaultCount: number,
  maxCount: number,
): CountableTarget {
  return {
    kind: "recon",
    name: item.name,
    ticks: item.ticks,
    cost: item.cost,
    dependencies: item.dependencies,
    defaultTick,
    defaultCount,
    maxCount,
  };
}
