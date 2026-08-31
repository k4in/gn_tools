import { useEffect, useMemo, useState } from "react";
import { defaults as defaultConfig, planTemplates } from "@/gn-data/plan";
import { Header } from "@/components/header";
import { Overview } from "@/components/overview/overview";
import { MY_PLAN_VIEW, PlanSwitcher, type PlanViewId } from "@/components/plan-switcher";
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
  getExtractorSlotShortage,
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
    case "custom": {
      if (typeof o.label !== "string" || !o.label.trim()) return false;
      const cost = o.cost;
      if (!cost || typeof cost !== "object") return false;
      const c = cost as Record<string, unknown>;
      if (typeof c.met !== "number" || !Number.isFinite(c.met)) return false;
      if (typeof c.kris !== "number" || !Number.isFinite(c.kris)) return false;
      c.met = Math.max(0, Math.floor(c.met));
      c.kris = Math.max(0, Math.floor(c.kris));
      o.label = o.label.trim();
      return true;
    }
    case "roid": {
      const targetMet = o.targetMet;
      const targetKris = o.targetKris;
      const duration = o.duration;
      if (typeof targetMet !== "number" || !Number.isFinite(targetMet)) return false;
      if (typeof targetKris !== "number" || !Number.isFinite(targetKris)) return false;
      if (typeof duration !== "number" || !Number.isFinite(duration)) return false;
      const met = Math.max(0, Math.floor(targetMet));
      const kris = Math.max(0, Math.floor(targetKris));
      o.targetMet = met;
      o.targetKris = kris;
      o.duration = Math.min(10, Math.max(1, Math.floor(duration)));
      return met > 0 || kris > 0;
    }
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

const MAX_IMPORT_PLAN_ENTRIES = 1000;

function collectPlanEntries(raw: unknown): PlanEntry[] | null {
  if (!Array.isArray(raw)) return null;
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
    if (e.kind === "custom") {
      out.push({
        id: e.id,
        kind: "custom",
        startTick: Math.max(0, Math.floor(e.startTick)),
        label: e.label.trim(),
        cost: {
          met: Math.max(0, Math.floor(e.cost.met)),
          kris: Math.max(0, Math.floor(e.cost.kris)),
        },
      });
      continue;
    }
    if (e.kind === "roid") {
      out.push({
        id: e.id,
        kind: "roid",
        startTick: Math.max(0, Math.floor(e.startTick)),
        targetMet: Math.max(0, Math.floor(e.targetMet)),
        targetKris: Math.max(0, Math.floor(e.targetKris)),
        duration: Math.min(10, Math.max(1, Math.floor(e.duration))),
      });
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
  return out;
}

function normalizePlan(raw: unknown): PlanEntry[] {
  const out = collectPlanEntries(raw);
  return out && out.length ? out : [...defaultConfig.plan];
}

type ImportPlanParseResult =
  | { ok: true; plan: PlanEntry[] }
  | { ok: false; error: string };

function parseImportedPlan(text: string): ImportPlanParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Kein JSON eingefügt." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Ungültiges JSON." };
  }
  let raw: unknown = parsed;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "plan" in parsed) {
    raw = (parsed as { plan: unknown }).plan;
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "JSON muss ein Plan-Array sein." };
  }
  if (raw.length > MAX_IMPORT_PLAN_ENTRIES) {
    return {
      ok: false,
      error: `Maximal ${MAX_IMPORT_PLAN_ENTRIES} Einträge.`,
    };
  }
  const plan = collectPlanEntries(raw);
  if (!plan || plan.length === 0) {
    return { ok: false, error: "Keine gültigen Plan-Einträge gefunden." };
  }
  return { ok: true, plan };
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
  const [viewId, setViewId] = useState<PlanViewId>(MY_PLAN_VIEW);
  const viewingOwnPlan = viewId === MY_PLAN_VIEW;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(startCfg));
    } catch (err) {
      console.error("Konnte Plan nicht speichern", err);
    }
  }, [startCfg]);

  const viewCfg = useMemo((): StartConfig => {
    if (viewingOwnPlan) return startCfg;
    const template = planTemplates.find((item) => item.id === viewId);
    if (!template) return startCfg;
    return { ...startCfg, plan: template.plan };
  }, [startCfg, viewId, viewingOwnPlan]);

  const plan = useMemo(() => {
    try {
      return calculateFastestWayToGoal(viewCfg);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [viewCfg]);

  const unlocked = useMemo(() => getUnlockedTechs(viewCfg.plan), [viewCfg.plan]);
  const availableShips = useMemo(
    () => getAvailableShips(viewCfg.plan),
    [viewCfg.plan],
  );
  const availableRecon = useMemo(
    () => getAvailableRecon(viewCfg.plan),
    [viewCfg.plan],
  );

  const hasObservatorium = hasTechInPlan(viewCfg.plan, "Observatorium");
  const hasExtraktorTech = hasTechInPlan(viewCfg.plan, "Extraktor");

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
    if (!viewingOwnPlan) return;
    const tech = byName().get(name);
    if (!tech) return;
    const defaultTick = getEarliestTechStartTick(startCfg, name);
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({ kind: "tech", tech, defaultTick });
    setDialogOpen(true);
  };

  const openAddUnit = (name: string) => {
    if (!viewingOwnPlan) return;
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
    if (!viewingOwnPlan) return;
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
    if (!viewingOwnPlan) return;
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

  const openAddCustom = () => {
    if (!viewingOwnPlan) return;
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({
      kind: "custom",
      defaultTick: Math.max(0, currentTick),
      defaultLabel: "",
      defaultMet: 0,
      defaultKris: 0,
    });
    setDialogOpen(true);
  };

  const occupiedRoids = (exceptId?: string) =>
    startCfg.plan
      .filter(
        (e): e is Extract<PlanEntry, { kind: "roid" }> =>
          e.kind === "roid" && e.id !== exceptId,
      )
      .map((e) => ({
        startTick: e.startTick,
        duration: e.duration,
        targetMet: e.targetMet,
        targetKris: e.targetKris,
      }));

  const openAddRoid = () => {
    if (!viewingOwnPlan) return;
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({
      kind: "roid",
      defaultTick: Math.max(0, currentTick),
      defaultTargetMet: 0,
      defaultTargetKris: 0,
      defaultDuration: 1,
      occupiedRoids: occupiedRoids(),
    });
    setDialogOpen(true);
  };

  const openEditEntry = (id: string) => {
    if (!viewingOwnPlan) return;
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
    } else if (entry.kind === "custom") {
      setDialogTarget({
        kind: "custom",
        defaultTick: entry.startTick,
        defaultLabel: entry.label,
        defaultMet: entry.cost.met,
        defaultKris: entry.cost.kris,
      });
    } else if (entry.kind === "roid") {
      setDialogTarget({
        kind: "roid",
        defaultTick: entry.startTick,
        defaultTargetMet: entry.targetMet,
        defaultTargetKris: entry.targetKris,
        defaultDuration: entry.duration,
        occupiedRoids: occupiedRoids(entry.id),
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
    label?: string;
    cost?: { met: number; kris: number };
    targetMet?: number;
    targetKris?: number;
    duration?: number;
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
          if (e.kind === "custom") {
            return {
              ...e,
              startTick: values.startTick,
              label: (values.label ?? e.label).trim() || e.label,
              cost: {
                met: Math.max(0, values.cost?.met ?? e.cost.met),
                kris: Math.max(0, values.cost?.kris ?? e.cost.kris),
              },
            };
          }
          if (e.kind === "roid") {
            return {
              ...e,
              startTick: values.startTick,
              targetMet: Math.max(0, values.targetMet ?? e.targetMet),
              targetKris: Math.max(0, values.targetKris ?? e.targetKris),
              duration: Math.min(10, Math.max(1, values.duration ?? e.duration)),
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
      return;
    }

    if (dialogTarget.kind === "custom") {
      const label = (values.label ?? "").trim();
      if (!label) return;
      const entry: PlanEntry = {
        id: newPlanEntryId("custom"),
        kind: "custom",
        startTick: values.startTick,
        label,
        cost: {
          met: Math.max(0, values.cost?.met ?? 0),
          kris: Math.max(0, values.cost?.kris ?? 0),
        },
      };
      setStartCfg((prev) => ({ ...prev, plan: [...prev.plan, entry] }));
      return;
    }

    if (dialogTarget.kind === "roid") {
      const targetMet = Math.max(0, values.targetMet ?? 0);
      const targetKris = Math.max(0, values.targetKris ?? 0);
      const duration = Math.min(10, Math.max(1, values.duration ?? 1));
      if (targetMet <= 0 && targetKris <= 0) return;
      const entry: PlanEntry = {
        id: newPlanEntryId("roid"),
        kind: "roid",
        startTick: values.startTick,
        targetMet,
        targetKris,
        duration,
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

  const resetPlan = (templateId: string) => {
    const template = planTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setStartCfg((prev) =>
      normalizeConfig({
        ...defaultConfig,
        start_date: prev.start_date,
        start_time: prev.start_time,
        tick_minutes: prev.tick_minutes,
        plan: template.plan,
      }),
    );
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
          onApplyStart={({ start_date, start_time, tick_minutes }) => {
            setStartCfg((prev) => ({ ...prev, start_date, start_time, tick_minutes }));
          }}
          onReset={resetPlan}
        />
        <PlanSwitcher viewId={viewId} onViewChange={setViewId} />
        <div className={viewingOwnPlan ? "grid min-h-0 flex-1 grid-cols-[26.4rem_minmax(0,1fr)]" : "grid min-h-0 flex-1 grid-cols-1"}>
          {viewingOwnPlan && (
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
              onAddRoid={openAddRoid}
              onAddCustom={openAddCustom}
            />
          )}
          <Overview
            actionTicks={actionTicks}
            logTicks={plan?.ticks ?? []}
            steps={plan?.steps ?? []}
            maxTick={maxTick}
            currentTick={currentTick}
            hasPlan={!!plan}
            slotShortage={plan ? getExtractorSlotShortage(plan) : null}
            exportJson={viewingOwnPlan ? JSON.stringify(startCfg.plan, null, 2) : undefined}
            parseImportPlan={viewingOwnPlan ? parseImportedPlan : undefined}
            onImportPlan={
              viewingOwnPlan
                ? (plan) => setStartCfg((prev) => ({ ...prev, plan }))
                : undefined
            }
            onEditJob={
              viewingOwnPlan
                ? (planEntryId) => {
                    if (planEntryId) openEditEntry(planEntryId);
                  }
                : undefined
            }
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
