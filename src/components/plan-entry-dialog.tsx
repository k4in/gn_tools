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
  extractorBatchCost,
  extractorUnitCost,
  formatRes,
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

type ExtractorTarget = {
  kind: "extractors";
  resource: "met" | "kris";
  defaultTick: number;
  defaultCount: number;
  maxCount: number;
  freeSlots: number;
  asteroids: number;
};

type AsteroidTarget = {
  kind: "asteroids";
  defaultTick: number;
  defaultCount: number;
  costKris: number;
};

export type PlanEntryDialogTarget =
  | TechTarget
  | CountableTarget
  | ExtractorTarget
  | AsteroidTarget;

export type PlanEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PlanEntryDialogMode;
  target: PlanEntryDialogTarget | null;
  /** Existing entry when editing. */
  entry?: PlanEntry | null;
  onSubmit: (values: {
    startTick: number;
    count?: number;
    resource?: "met" | "kris";
  }) => void;
  onRemove?: () => void;
  /** Dynamic max/count when tick changes (units/recon/extractors). */
  resolveMaxCount?: (startTick: number) => number;
  resolveFreeSlots?: (startTick: number) => {
    freeSlots: number;
    asteroids: number;
    alreadyBuilt: number;
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
  resolveFreeSlots,
}: PlanEntryDialogProps) {
  const [startTick, setStartTick] = useState(0);
  const [count, setCount] = useState(1);
  const [resource, setResource] = useState<"met" | "kris">("met");

  useEffect(() => {
    if (!open || !target) return;
    if (mode === "edit" && entry) {
      setStartTick(entry.startTick);
      if ("count" in entry) setCount(entry.count);
      if (entry.kind === "extractors") setResource(entry.resource);
      return;
    }
    setStartTick(target.defaultTick);
    if (target.kind === "unit" || target.kind === "recon" || target.kind === "extractors") {
      setCount(Math.max(1, target.defaultCount));
    } else if (target.kind === "asteroids") {
      setCount(Math.max(1, target.defaultCount));
    } else {
      setCount(1);
    }
    if (target.kind === "extractors") setResource(target.resource);
  }, [open, target, mode, entry]);

  const liveMax = useMemo(() => {
    if (!target) return 1;
    if (resolveMaxCount) return Math.max(0, resolveMaxCount(startTick));
    if (target.kind === "unit" || target.kind === "recon" || target.kind === "extractors") {
      return target.maxCount;
    }
    return 999;
  }, [target, startTick, resolveMaxCount]);

  const liveSlots = useMemo(() => {
    if (!target || target.kind !== "extractors") return null;
    if (resolveFreeSlots) return resolveFreeSlots(startTick);
    return { freeSlots: target.freeSlots, asteroids: target.asteroids, alreadyBuilt: 0 };
  }, [target, startTick, resolveFreeSlots]);

  const unitTotalCost = useMemo(() => {
    if (!target || (target.kind !== "unit" && target.kind !== "recon")) return null;
    const n = Math.max(0, count);
    return {
      met: target.cost.met * n,
      kris: target.cost.kris * n,
    };
  }, [target, count]);

  const extractorCosts = useMemo(() => {
    if (!target || target.kind !== "extractors" || !liveSlots) return null;
    const alreadyBuilt = liveSlots.alreadyBuilt;
    const nextCost = extractorUnitCost(alreadyBuilt + 1);
    const total = extractorBatchCost(alreadyBuilt, Math.max(0, count));
    return { alreadyBuilt, nextCost, total };
  }, [target, liveSlots, count]);

  if (!target) return null;

  const title = (() => {
    if (target.kind === "tech") return target.tech.name;
    if (target.kind === "unit" || target.kind === "recon") return target.name;
    if (target.kind === "extractors") {
      return resource === "met" ? "Metallextraktoren" : "Kristallextraktoren";
    }
    return "Asteroiden scannen";
  })();

  const extractorBlocked =
    target.kind === "extractors" && (liveSlots?.freeSlots ?? 0) <= 0;

  const canSubmit = (() => {
    if (startTick < 0) return false;
    if (target.kind === "tech") return true;
    if (count < 1) return false;
    if (target.kind === "asteroids") return true;
    // liveMax already includes the current entry's budget when editing
    const maxAllowed = Math.max(1, liveMax);
    if (target.kind === "extractors") {
      return !extractorBlocked && count <= maxAllowed;
    }
    return count <= maxAllowed;
  })();

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (target.kind === "tech") {
      onSubmit({ startTick });
    } else if (target.kind === "extractors") {
      onSubmit({ startTick, count: Math.max(1, count), resource });
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

          {target.kind === "asteroids" && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="tabular-nums">
                Kosten / Stück: {formatRes(target.costKris)} K · 20 Extraktor-Slots
              </p>
              <p className="tabular-nums font-medium text-foreground">
                Gesamtkosten: {formatRes(target.costKris * Math.max(0, count))} K
              </p>
            </div>
          )}

          {target.kind === "extractors" && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="tabular-nums">
                Freie Slots: {liveSlots?.freeSlots ?? 0} · Asteroiden:{" "}
                {liveSlots?.asteroids ?? 0}
                {extractorCosts ? ` · bereits gebaut: ${extractorCosts.alreadyBuilt}` : ""}
              </p>
              {extractorCosts && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt>Nächster Extraktor</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {formatRes(extractorCosts.nextCost)} M
                  </dd>
                  <dt>Gesamtkosten ({Math.max(0, count)}×)</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {formatRes(extractorCosts.total)} M
                  </dd>
                </dl>
              )}
              {extractorBlocked && (
                <p className="text-amber-500">
                  Keine freien Extraktor-Slots — zuerst Asteroiden scannen.
                </p>
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

            {target.kind !== "tech" && (
              <Field className="w-28">
                <FieldLabel htmlFor="plan-count">Anzahl</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="plan-count"
                    type="number"
                    min={1}
                    max={target.kind === "asteroids" ? undefined : Math.max(1, liveMax)}
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
          </div>

          {target.kind === "extractors" && mode === "add" && (
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

          {target.kind !== "tech" && target.kind !== "asteroids" && liveMax > 0 && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Max. bei Tick {startTick}: {liveMax}
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
