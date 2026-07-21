import { useEffect, useMemo, useState } from "react";
import { defaults as defaultConfig } from "@/gn-data/plan";
import { Header } from "@/components/header";
import { Overview } from "@/components/overview/overview";
import { Sidebar } from "@/components/sidebar/sidebar";
import {
  PlanEntryDialog,
  type PlanEntryDialogTarget,
} from "@/components/plan-entry-dialog";
import {
  calculateFastestWayToGoal,
  computeCurrentTick,
  getAvailableRecon,
  getAvailableShips,
  getEarliestAsteroidStartTick,
  getEarliestBuildStartTick,
  getEarliestExtractorStartTick,
  getEarliestTechStartTick,
  getMaxBuildCountAtTick,
  extractorBatchCost,
  getMaxExtractorsAtTick,
  getResourcesAtTick,
  getUnlockedTechs,
  hasTechInPlan,
  newPlanEntryId,
  removePlanEntryCascade,
  type PlanEntry,
  type StartConfig,
} from "@/lib/calculateFastestWayToGoal";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { byName } from "@/lib/calculateFastestWayToGoal";
import { ASTEROID_COST } from "@/lib/calculateFastestWayToGoal";

const STORAGE_KEY = "gn_tool.plan";

function isPlanEntry(raw: unknown): raw is PlanEntry {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return false;
  if (typeof o.startTick !== "number" || !Number.isFinite(o.startTick)) return false;
  const tick = Math.max(0, Math.floor(o.startTick));
  (o as { startTick: number }).startTick = tick;

  switch (o.kind) {
    case "tech":
      return typeof o.name === "string" && !!o.name;
    case "unit":
    case "recon":
      return (
        typeof o.name === "string" &&
        !!o.name &&
        typeof o.count === "number" &&
        o.count > 0
      );
    case "economy": {
      const asteroids =
        typeof o.asteroids === "number" && Number.isFinite(o.asteroids)
          ? Math.max(0, Math.floor(o.asteroids))
          : 0;
      const extractors =
        typeof o.extractors === "number" && Number.isFinite(o.extractors)
          ? Math.max(0, Math.floor(o.extractors))
          : 0;
      if (asteroids <= 0 && extractors <= 0) return false;
      if (extractors > 0 && o.resource !== "met" && o.resource !== "kris") {
        return false;
      }
      return true;
    }
    // legacy kinds — accepted then migrated in normalizePlan
    case "extractors":
      return (
        (o.resource === "met" || o.resource === "kris") &&
        typeof o.count === "number" &&
        o.count > 0
      );
    case "asteroids":
      return typeof o.count === "number" && o.count > 0;
    default:
      return false;
  }
}

function toEconomyEntry(raw: PlanEntry): Extract<PlanEntry, { kind: "economy" }> | null {
  if (raw.kind === "economy") {
    const asteroids = Math.max(0, Math.floor(raw.asteroids));
    const extractors = Math.max(0, Math.floor(raw.extractors));
    if (asteroids <= 0 && extractors <= 0) return null;
    return {
      id: raw.id,
      kind: "economy",
      startTick: Math.max(0, Math.floor(raw.startTick)),
      asteroids,
      extractors,
      resource: extractors > 0 ? raw.resource : "met",
    };
  }
  if (raw.kind === "asteroids") {
    return {
      id: raw.id,
      kind: "economy",
      startTick: Math.max(0, Math.floor(raw.startTick)),
      asteroids: Math.max(1, Math.floor(raw.count)),
      extractors: 0,
      resource: "met",
    };
  }
  if (raw.kind === "extractors") {
    return {
      id: raw.id,
      kind: "economy",
      startTick: Math.max(0, Math.floor(raw.startTick)),
      asteroids: 0,
      extractors: Math.max(1, Math.floor(raw.count)),
      resource: raw.resource,
    };
  }
  return null;
}

function normalizePlan(raw: unknown): PlanEntry[] {
  if (!Array.isArray(raw)) return [...defaultConfig.plan];
  const out: PlanEntry[] = [];
  for (const item of raw) {
    // migrate legacy string entries
    if (typeof item === "string" && item.trim()) {
      out.push({
        id: newPlanEntryId("legacy"),
        kind: "tech",
        name: item.trim(),
        startTick: 0,
      });
      continue;
    }
    if (!isPlanEntry(item)) continue;
    const e = item as PlanEntry;
    if (e.kind === "economy" || e.kind === "asteroids" || e.kind === "extractors") {
      const eco = toEconomyEntry(e);
      if (eco) out.push(eco);
      continue;
    }
    out.push({
      ...e,
      startTick: Math.max(0, Math.floor(e.startTick)),
      ...("count" in e
        ? { count: Math.max(1, Math.floor(e.count)) }
        : {}),
    } as PlanEntry);
  }
  return out.length ? out : [...defaultConfig.plan];
}

function normalizeConfig(raw: unknown): StartConfig {
  const base: StartConfig = {
    start_time: defaultConfig.start_time,
    start_date: defaultConfig.start_date,
    tick_minutes: defaultConfig.tick_minutes,
    max_ticks: defaultConfig.max_ticks,
    starting_resources: {
      metall: defaultConfig.starting_resources.metall,
      kristall: defaultConfig.starting_resources.kristall,
    },
    plan: [...defaultConfig.plan],
  };

  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<StartConfig> & { economyOrders?: unknown };

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

  let plan = normalizePlan(obj.plan);

  // Migrate legacy economyOrders into plan entries
  if (Array.isArray(obj.economyOrders)) {
    for (const item of obj.economyOrders) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id =
        typeof o.id === "string" && o.id ? o.id : newPlanEntryId("eco");
      const count =
        typeof o.count === "number" && o.count > 0 ? Math.floor(o.count) : 0;
      const atTick =
        typeof o.atTick === "number" && Number.isFinite(o.atTick)
          ? Math.max(0, Math.floor(o.atTick))
          : 0;
      if (!count) continue;
      if (o.kind === "asteroids") {
        plan.push({
          id,
          kind: "economy",
          asteroids: count,
          extractors: 0,
          resource: "met",
          startTick: atTick,
        });
      } else if (o.kind === "extractors") {
        plan.push({
          id,
          kind: "economy",
          asteroids: 0,
          extractors: count,
          startTick: atTick,
          resource: o.resource === "kris" ? "kris" : "met",
        });
      }
    }
  }

  const tick_minutes =
    typeof obj.tick_minutes === "number" && obj.tick_minutes > 0
      ? obj.tick_minutes
      : base.tick_minutes;
  const max_ticks =
    typeof obj.max_ticks === "number" && obj.max_ticks > 0
      ? obj.max_ticks
      : base.max_ticks;

  return {
    start_time,
    start_date,
    tick_minutes,
    max_ticks,
    starting_resources: { metall, kristall },
    plan,
  };
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

  const plan = useMemo(() => {
    try {
      return calculateFastestWayToGoal(startCfg);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [startCfg]);

  const unlocked = useMemo(() => getUnlockedTechs(startCfg.plan), [startCfg.plan]);
  const availableShips = useMemo(
    () => getAvailableShips(startCfg.plan),
    [startCfg.plan],
  );
  const availableRecon = useMemo(
    () => getAvailableRecon(startCfg.plan),
    [startCfg.plan],
  );

  const hasObservatorium = hasTechInPlan(startCfg.plan, "Observatorium");
  const hasExtraktorTech = hasTechInPlan(startCfg.plan, "Extraktor");

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
  const nextAction = useMemo(
    () => actionTicks.find((t) => t.tick >= currentTick) ?? null,
    [actionTicks, currentTick],
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogTarget, setDialogTarget] = useState<PlanEntryDialogTarget | null>(
    null,
  );
  const [editingEntry, setEditingEntry] = useState<PlanEntry | null>(null);

  const openAddTech = (name: string) => {
    const tech = byName().get(name);
    if (!tech) return;
    const defaultTick = getEarliestTechStartTick(startCfg, name);
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({ kind: "tech", tech, defaultTick });
    setDialogOpen(true);
  };

  const openAddUnit = (name: string) => {
    const ship = availableShips.find((s) => s.name === name);
    if (!ship) return;
    const defaultTick = getEarliestBuildStartTick(startCfg, "unit", name);
    const maxCount = Math.max(
      1,
      getMaxBuildCountAtTick(startCfg, "unit", name, defaultTick),
    );
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({
      kind: "unit",
      name: ship.name,
      ticks: ship.ticks,
      cost: ship.cost,
      dependencies: ship.dependencies,
      defaultTick,
      defaultCount: maxCount,
      maxCount,
    });
    setDialogOpen(true);
  };

  const openAddRecon = (name: string) => {
    const item = availableRecon.find((s) => s.name === name);
    if (!item) return;
    const defaultTick = getEarliestBuildStartTick(startCfg, "recon", name);
    const maxCount = Math.max(
      1,
      getMaxBuildCountAtTick(startCfg, "recon", name, defaultTick),
    );
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({
      kind: "recon",
      name: item.name,
      ticks: item.ticks,
      cost: item.cost,
      dependencies: item.dependencies,
      defaultTick,
      defaultCount: maxCount,
      maxCount,
    });
    setDialogOpen(true);
  };

  const openAddEconomy = (preset: {
    asteroids?: number;
    extractors?: number;
    resource?: "met" | "kris";
  } = {}) => {
    const defaultTick = Math.max(
      hasObservatorium ? getEarliestAsteroidStartTick(startCfg) : 0,
      hasExtraktorTech ? getEarliestExtractorStartTick(startCfg) : 0,
    );
    const info = getMaxExtractorsAtTick(startCfg, defaultTick);
    const wantAst = preset.asteroids ?? (hasObservatorium ? 1 : 0);
    const wantExt =
      preset.extractors ??
      (hasExtraktorTech ? Math.max(1, info.max) : 0);
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({
      kind: "economy",
      defaultTick,
      defaultAsteroids: wantAst,
      defaultExtractors: wantExt,
      resource: preset.resource ?? "met",
      freeSlots: info.freeSlots,
      asteroidsOwned: info.asteroids,
      alreadyBuilt: info.alreadyBuilt,
      canAsteroids: hasObservatorium,
      canExtractors: hasExtraktorTech,
      costKrisPerAsteroid: ASTEROID_COST.kris,
    });
    setDialogOpen(true);
  };

  const openEditEntry = (id: string) => {
    const entry = startCfg.plan.find((e) => e.id === id);
    if (!entry) return;
    setDialogMode("edit");
    setEditingEntry(entry);

    if (entry.kind === "tech") {
      const tech = byName().get(entry.name);
      if (!tech) return;
      setDialogTarget({
        kind: "tech",
        tech,
        defaultTick: entry.startTick,
      });
    } else if (entry.kind === "unit") {
      const ship = availableShips.find((s) => s.name === entry.name) ?? {
        name: entry.name as never,
        ticks: 0,
        time: 0,
        cost: { met: 0, kris: 0 },
        dependencies: [],
      };
      const maxCount = Math.max(
        entry.count,
        getMaxBuildCountAtTick(startCfg, "unit", entry.name, entry.startTick),
      );
      setDialogTarget({
        kind: "unit",
        name: entry.name,
        ticks: ship.ticks,
        cost: ship.cost,
        dependencies: ship.dependencies,
        defaultTick: entry.startTick,
        defaultCount: entry.count,
        maxCount,
      });
    } else if (entry.kind === "recon") {
      const item = availableRecon.find((s) => s.name === entry.name);
      const maxCount = Math.max(
        entry.count,
        getMaxBuildCountAtTick(startCfg, "recon", entry.name, entry.startTick),
      );
      setDialogTarget({
        kind: "recon",
        name: entry.name,
        ticks: item?.ticks ?? 0,
        cost: item?.cost ?? { met: 0, kris: 0 },
        dependencies: item?.dependencies ?? [],
        defaultTick: entry.startTick,
        defaultCount: entry.count,
        maxCount,
      });
    } else if (
      entry.kind === "economy" ||
      entry.kind === "asteroids" ||
      entry.kind === "extractors"
    ) {
      const eco =
        entry.kind === "economy"
          ? entry
          : entry.kind === "asteroids"
            ? {
                asteroids: entry.count,
                extractors: 0,
                resource: "met" as const,
                startTick: entry.startTick,
              }
            : {
                asteroids: 0,
                extractors: entry.count,
                resource: entry.resource,
                startTick: entry.startTick,
              };
      const info = getMaxExtractorsAtTick(startCfg, eco.startTick);
      const asteroidsOwned = Math.max(0, info.asteroids - eco.asteroids);
      const alreadyBuilt = Math.max(0, info.alreadyBuilt - eco.extractors);
      const freeSlots = Math.max(
        0,
        asteroidsOwned * 20 - alreadyBuilt,
      );
      setDialogTarget({
        kind: "economy",
        defaultTick: eco.startTick,
        defaultAsteroids: eco.asteroids,
        defaultExtractors: eco.extractors,
        resource: eco.resource,
        freeSlots,
        asteroidsOwned,
        alreadyBuilt,
        canAsteroids: hasObservatorium,
        canExtractors: hasExtraktorTech,
        costKrisPerAsteroid: ASTEROID_COST.kris,
      });
    }
    setDialogOpen(true);
  };

  const handleDialogSubmit = (values: {
    startTick: number;
    count?: number;
    resource?: "met" | "kris";
    asteroids?: number;
    extractors?: number;
  }) => {
    if (!dialogTarget) return;

    if (dialogMode === "edit" && editingEntry) {
      setStartCfg((prev) => ({
        ...prev,
        plan: prev.plan.map((e) => {
          if (e.id !== editingEntry.id) return e;
          if (e.kind === "tech") {
            return { ...e, startTick: values.startTick };
          }
          if (
            e.kind === "economy" ||
            e.kind === "asteroids" ||
            e.kind === "extractors"
          ) {
            const asteroids = Math.max(0, values.asteroids ?? 0);
            const extractors = Math.max(0, values.extractors ?? 0);
            return {
              id: e.id,
              kind: "economy" as const,
              startTick: values.startTick,
              asteroids,
              extractors,
              resource: values.resource ?? "met",
            };
          }
          return {
            ...e,
            startTick: values.startTick,
            count: values.count ?? ("count" in e ? e.count : 1),
          } as PlanEntry;
        }),
      }));
      return;
    }

    // add
    if (dialogTarget.kind === "tech") {
      const name = dialogTarget.tech.name;
      setStartCfg((prev) => {
        if (prev.plan.some((e) => e.kind === "tech" && e.name === name)) return prev;
        const entry: PlanEntry = {
          id: newPlanEntryId("tech"),
          kind: "tech",
          name,
          startTick: values.startTick,
        };
        return { ...prev, plan: [...prev.plan, entry] };
      });
      return;
    }

    if (dialogTarget.kind === "unit") {
      const entry: PlanEntry = {
        id: newPlanEntryId("unit"),
        kind: "unit",
        name: dialogTarget.name,
        startTick: values.startTick,
        count: Math.max(1, values.count ?? 1),
      };
      setStartCfg((prev) => ({ ...prev, plan: [...prev.plan, entry] }));
      return;
    }

    if (dialogTarget.kind === "recon") {
      const entry: PlanEntry = {
        id: newPlanEntryId("recon"),
        kind: "recon",
        name: dialogTarget.name,
        startTick: values.startTick,
        count: Math.max(1, values.count ?? 1),
      };
      setStartCfg((prev) => ({ ...prev, plan: [...prev.plan, entry] }));
      return;
    }

    if (dialogTarget.kind === "economy") {
      const asteroids = Math.max(0, values.asteroids ?? 0);
      const extractors = Math.max(0, values.extractors ?? 0);
      if (asteroids <= 0 && extractors <= 0) return;
      const entry: PlanEntry = {
        id: newPlanEntryId("eco"),
        kind: "economy",
        startTick: values.startTick,
        asteroids,
        extractors,
        resource: values.resource ?? dialogTarget.resource,
      };
      setStartCfg((prev) => ({ ...prev, plan: [...prev.plan, entry] }));
    }
  };

  const handleDialogRemove = () => {
    if (!editingEntry) return;
    setStartCfg((prev) => ({
      ...prev,
      plan: removePlanEntryCascade(prev.plan, editingEntry.id),
    }));
    setDialogOpen(false);
    setEditingEntry(null);
  };

  const resetPlan = () => {
    setStartCfg(normalizeConfig(defaultConfig));
  };

  return (
    <TooltipProvider>
      <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
        <Header
          now={now}
          currentTick={currentTick}
          startCfg={startCfg}
          plan={plan}
          nextAction={nextAction}
          onReset={resetPlan}
        />
        <div className="grid min-h-0 flex-1 grid-cols-[26.4rem_minmax(0,1fr)]">
          <Sidebar
            unlocked={unlocked}
            availableShips={availableShips}
            availableRecon={availableRecon}
            hasObservatorium={hasObservatorium}
            hasExtraktorTech={hasExtraktorTech}
            onAddTech={openAddTech}
            onAddUnit={openAddUnit}
            onAddRecon={openAddRecon}
            onAddEconomy={openAddEconomy}
          />
          <Overview
            actionTicks={actionTicks}
            logTicks={plan?.ticks ?? []}
            steps={plan?.steps ?? []}
            maxTick={maxTick}
            currentTick={currentTick}
            hasPlan={!!plan}
            onEditJob={(planEntryId) => {
              if (planEntryId) openEditEntry(planEntryId);
            }}
          />
        </div>

        <PlanEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode={dialogMode}
          target={dialogTarget}
          entry={editingEntry}
          onSubmit={handleDialogSubmit}
          onRemove={dialogMode === "edit" ? handleDialogRemove : undefined}
          resolveMaxCount={(tick) => {
            if (!dialogTarget) return 1;
            // When editing, refund this entry's cost into the affordability budget
            // (simulation still includes the entry, so leftover resources alone undercount).
            if (dialogTarget.kind === "unit") {
              const max = getMaxBuildCountAtTick(
                startCfg,
                "unit",
                dialogTarget.name,
                tick,
              );
              const bonus =
                dialogMode === "edit" && editingEntry?.kind === "unit"
                  ? editingEntry.count
                  : 0;
              return max + bonus;
            }
            if (dialogTarget.kind === "recon") {
              const max = getMaxBuildCountAtTick(
                startCfg,
                "recon",
                dialogTarget.name,
                tick,
              );
              const bonus =
                dialogMode === "edit" && editingEntry?.kind === "recon"
                  ? editingEntry.count
                  : 0;
              return max + bonus;
            }
            return 999;
          }}
          resolveEconomyAtTick={(tick) => {
            const info = getMaxExtractorsAtTick(startCfg, tick);
            const snap = getResourcesAtTick(startCfg, tick);
            let bonusAst = 0;
            let bonusExt = 0;
            let bonusResource: "met" | "kris" = "met";
            if (dialogMode === "edit" && editingEntry) {
              if (editingEntry.kind === "economy") {
                bonusAst = editingEntry.asteroids;
                bonusExt = editingEntry.extractors;
                bonusResource = editingEntry.resource;
              } else if (editingEntry.kind === "asteroids") {
                bonusAst = editingEntry.count;
              } else if (editingEntry.kind === "extractors") {
                bonusExt = editingEntry.count;
                bonusResource = editingEntry.resource;
              }
            }
            const asteroids = Math.max(0, info.asteroids - bonusAst);
            const alreadyBuilt = Math.max(0, info.alreadyBuilt - bonusExt);
            const freeSlots = Math.max(0, asteroids * 20 - alreadyBuilt);
            // Refund costs of the entry being edited so max reflects free budget.
            const refundKris = bonusAst * ASTEROID_COST.kris;
            const refundMet =
              bonusExt > 0
                ? extractorBatchCost(alreadyBuilt, bonusExt)
                : 0;
            void bonusResource;
            return {
              freeSlots,
              asteroids,
              alreadyBuilt,
              met: snap.met + refundMet,
              kris: snap.kris + refundKris,
            };
          }}
        />
      </main>
    </TooltipProvider>
  );
}
