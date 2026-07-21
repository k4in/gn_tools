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
import { InputGroup, InputGroupInput } from "@/components/shadcn/input-group";
import {
  ASTEROID_COST,
  ASTEROID_SLOT_CAPACITY,
  extractorBatchCost,
  extractorUnitCost,
  formatRes,
  maxAffordableExtractors,
  type PlanEntry,
} from "@/lib/calculateFastestWayToGoal";
import type { TechTreeEntry } from "@/gn-data/techtree";
import type { Ship } from "@/gn-data/ships";
import type { Utility } from "@/gn-data/utility";

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
  defaultExtractors: number;
  resource: "met" | "kris";
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

export type PlanEntryDialogTarget =
  | TechTarget
  | CountableTarget
  | EconomyTarget;

export type PlanEntryDialogSubmit = {
  startTick: number;
  count?: number;
  resource?: "met" | "kris";
  asteroids?: number;
  extractors?: number;
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
  const [extractorCount, setExtractorCount] = useState(0);
  const [resource, setResource] = useState<"met" | "kris">("met");

  useEffect(() => {
    if (!open || !target) return;
    if (mode === "edit" && entry) {
      setStartTick(entry.startTick);
      if (entry.kind === "economy") {
        setAsteroidCount(Math.max(0, entry.asteroids));
        setExtractorCount(Math.max(0, entry.extractors));
        setResource(entry.resource);
        return;
      }
      if (entry.kind === "asteroids") {
        setAsteroidCount(Math.max(0, entry.count));
        setExtractorCount(0);
        setResource("met");
        return;
      }
      if (entry.kind === "extractors") {
        setAsteroidCount(0);
        setExtractorCount(Math.max(0, entry.count));
        setResource(entry.resource);
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
      setExtractorCount(Math.max(0, target.defaultExtractors));
      setResource(target.resource);
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
    const e = Math.max(0, extractorCount);
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
  }, [target, liveEconomy, asteroidCount, extractorCount]);

  if (!target) return null;

  const title = (() => {
    if (target.kind === "tech") return target.tech.name;
    if (target.kind === "unit" || target.kind === "recon") return target.name;
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
      const e = Math.max(0, extractorCount);
      if (a <= 0 && e <= 0) return false;
      if (a > 0 && !target.canAsteroids) return false;
      if (e > 0 && !target.canExtractors) return false;
      if (economyCosts && e > economyCosts.maxExtractors) return false;
      return true;
    }
    return false;
  })();

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (target.kind === "tech") {
      onSubmit({ startTick });
    } else if (target.kind === "economy") {
      onSubmit({
        startTick,
        asteroids: Math.max(0, asteroidCount),
        extractors: Math.max(0, extractorCount),
        resource,
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
                    {extractorCount > 0
                      ? ` (nächster ${formatRes(economyCosts.nextCost)} M)`
                      : ""}
                  </dd>
                  <dt>Slots nach Asteroiden</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {economyCosts.freeAfterAst}
                  </dd>
                </dl>
              )}
              {extractorCount > 0 &&
                economyCosts &&
                extractorCount > economyCosts.maxExtractors && (
                  <p className="text-amber-500">
                    Zu viele Extraktoren — begrenzt durch Slots und/oder Metall bei diesem Tick.
                  </p>
                )}
              {asteroidCount > 0 && !target.canAsteroids && (
                <p className="text-amber-500">Observatorium fehlt im Plan.</p>
              )}
              {extractorCount > 0 && !target.canExtractors && (
                <p className="text-amber-500">Extraktor-Tech fehlt im Plan.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-28">
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

            {target.kind === "economy" && (
              <>
                <Field className="w-28">
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
                <Field className="w-28">
                  <FieldLabel htmlFor="plan-extractors">Extraktoren</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="plan-extractors"
                      type="number"
                      min={0}
                      disabled={!target.canExtractors}
                      value={extractorCount}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        setExtractorCount(Math.max(0, Math.floor(n)));
                      }}
                      className="tabular-nums"
                    />
                  </InputGroup>
                </Field>
              </>
            )}
          </div>

          {target.kind === "economy" && target.canExtractors && (
            <div className="flex gap-2 text-xs">
              <Button
                type="button"
                size="sm"
                variant={resource === "met" ? "default" : "outline"}
                onClick={() => setResource("met")}
              >
                Metall
              </Button>
              <Button
                type="button"
                size="sm"
                variant={resource === "kris" ? "default" : "outline"}
                onClick={() => setResource("kris")}
              >
                Kristall
              </Button>
            </div>
          )}

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
