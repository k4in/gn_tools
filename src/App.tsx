import { useEffect, useMemo, useState } from "react";
import {
  clonePlanEntries,
  defaults as defaultConfig,
  isPlanSlotId,
  PLAN_SLOT_IDS,
  planSlotLabel,
  planTemplates,
  type PlanSlotId,
} from "@/gn-data/plan";
import { Header } from "@/components/header";
import { Overview } from "@/components/overview/overview";
import { PlanSwitcher, type PlanViewId } from "@/components/plan-switcher";
import { Sidebar } from "@/components/sidebar/sidebar";
import {
  PlanEntryDialog,
  type PlanEntryDialogTarget,
} from "@/components/plan-entry-dialog";
import {
  calculateFastestWayToGoal,
  computeCurrentTick,
  getAddableTechs,
  getEarliestAsteroidStartTick,
  getEarliestBuildStartTick,
  getEarliestExtractorStartTick,
  getEarliestTechStartTick,
  getExtractorSlotShortage,
  getMaxBuildCountAtTick,
  extractorBatchCost,
  getMaxExtractorsAtTick,
  getReconItems,
  getResourcesAtTick,
  getShips,
  hasTechInPlan,
  missingRequiredTechs,
  newPlanEntryId,
  normalizeTaxes,
  reconByName,
  removePlanEntryCascade,
  shipByName,
  type PlanEntry,
  type StartConfig,
  type TaxSegment,
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
      o.asteroids = asteroids;
      const hasNew =
        typeof o.extractorsMet === "number" || typeof o.extractorsKris === "number";
      if (hasNew) {
        const extractorsMet =
          typeof o.extractorsMet === "number" && Number.isFinite(o.extractorsMet)
            ? Math.max(0, Math.floor(o.extractorsMet))
            : 0;
        const extractorsKris =
          typeof o.extractorsKris === "number" && Number.isFinite(o.extractorsKris)
            ? Math.max(0, Math.floor(o.extractorsKris))
            : 0;
        o.extractorsMet = extractorsMet;
        o.extractorsKris = extractorsKris;
        return asteroids > 0 || extractorsMet > 0 || extractorsKris > 0;
      }
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
    case "trade": {
      if (o.give !== "met" && o.give !== "kris") return false;
      const giveAmount = o.giveAmount;
      const receiveAmount = o.receiveAmount;
      if (typeof giveAmount !== "number" || !Number.isFinite(giveAmount)) return false;
      if (typeof receiveAmount !== "number" || !Number.isFinite(receiveAmount)) return false;
      const giveAmt = Math.max(0, Math.floor(giveAmount));
      const receiveAmt = Math.max(0, Math.floor(receiveAmount));
      o.giveAmount = giveAmt;
      o.receiveAmount = receiveAmt;
      return giveAmt > 0 && receiveAmt > 0;
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
    const legacy = raw as {
      extractors?: number;
      resource?: "met" | "kris";
      extractorsMet?: number;
      extractorsKris?: number;
    };
    let extractorsMet = 0;
    let extractorsKris = 0;
    if (
      typeof legacy.extractorsMet === "number" ||
      typeof legacy.extractorsKris === "number"
    ) {
      extractorsMet = Math.max(0, Math.floor(legacy.extractorsMet ?? 0));
      extractorsKris = Math.max(0, Math.floor(legacy.extractorsKris ?? 0));
    } else {
      const extractors = Math.max(0, Math.floor(legacy.extractors ?? 0));
      if (legacy.resource === "kris") extractorsKris = extractors;
      else extractorsMet = extractors;
    }
    if (asteroids <= 0 && extractorsMet <= 0 && extractorsKris <= 0) return null;
    return {
      id: raw.id,
      kind: "economy",
      startTick: Math.max(0, Math.floor(raw.startTick)),
      asteroids,
      extractorsMet,
      extractorsKris,
    };
  }
  if (raw.kind === "asteroids") {
    return {
      id: raw.id,
      kind: "economy",
      startTick: Math.max(0, Math.floor(raw.startTick)),
      asteroids: Math.max(1, Math.floor(raw.count)),
      extractorsMet: 0,
      extractorsKris: 0,
    };
  }
  if (raw.kind === "extractors") {
    const count = Math.max(1, Math.floor(raw.count));
    return {
      id: raw.id,
      kind: "economy",
      startTick: Math.max(0, Math.floor(raw.startTick)),
      asteroids: 0,
      extractorsMet: raw.resource === "met" ? count : 0,
      extractorsKris: raw.resource === "kris" ? count : 0,
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
    if (e.kind === "trade") {
      out.push({
        id: e.id,
        kind: "trade",
        startTick: Math.max(0, Math.floor(e.startTick)),
        give: e.give === "kris" ? "kris" : "met",
        giveAmount: Math.max(0, Math.floor(e.giveAmount)),
        receiveAmount: Math.max(0, Math.floor(e.receiveAmount)),
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

type ImportedPlan = {
  plan: PlanEntry[];
  taxes: TaxSegment[];
};

type ImportPlanParseResult =
  | { ok: true } & ImportedPlan
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
  let taxesRaw: unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "plan" in parsed) {
    const obj = parsed as { plan: unknown; taxes?: unknown };
    raw = obj.plan;
    taxesRaw = obj.taxes;
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "JSON muss ein Plan-Array oder { plan, taxes } sein." };
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
  return { ok: true, plan, taxes: normalizeTaxes(taxesRaw) };
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
    taxes: [...defaultConfig.taxes],
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
          extractorsMet: 0,
          extractorsKris: 0,
          startTick: atTick,
        });
      } else if (o.kind === "extractors") {
        const isKris = o.resource === "kris";
        plan.push({
          id,
          kind: "economy",
          asteroids: 0,
          extractorsMet: isKris ? 0 : count,
          extractorsKris: isKris ? count : 0,
          startTick: atTick,
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
    taxes: normalizeTaxes(obj.taxes),
    plan,
  };
}

const STORAGE_VERSION = 3 as const;

type StoredPlan = {
  plan: PlanEntry[];
  taxes: TaxSegment[];
};

type PersistedAppState = {
  version: typeof STORAGE_VERSION;
  start_time: string;
  start_date: string;
  tick_minutes: number;
  max_ticks: number;
  starting_resources: { metall: number; kristall: number };
  activePlanId: PlanSlotId;
  /** Kosmetisch: welcher Slot gerade gespielt wird. Fehlt in alten Saves. */
  livePlanId: PlanSlotId | null;
  plans: Record<PlanSlotId, StoredPlan>;
};

function sharedFromConfig(
  cfg: Pick<
    StartConfig,
    "start_time" | "start_date" | "tick_minutes" | "max_ticks" | "starting_resources"
  >,
) {
  return {
    start_time: cfg.start_time,
    start_date: cfg.start_date,
    tick_minutes: cfg.tick_minutes,
    max_ticks: cfg.max_ticks,
    starting_resources: {
      metall: cfg.starting_resources.metall,
      kristall: cfg.starting_resources.kristall,
    },
  };
}

function defaultSlotPlan(): PlanEntry[] {
  return clonePlanEntries(normalizePlan(defaultConfig.plan));
}

function cloneStoredPlan(stored: StoredPlan): StoredPlan {
  return {
    plan: clonePlanEntries(stored.plan),
    taxes: stored.taxes.map((seg) => ({ ...seg })),
  };
}

function normalizeStoredPlan(raw: unknown, fallbackTaxes: TaxSegment[] = []): StoredPlan {
  if (Array.isArray(raw)) {
    return { plan: normalizePlan(raw), taxes: fallbackTaxes };
  }
  if (raw && typeof raw === "object") {
    const o = raw as { plan?: unknown; taxes?: unknown };
    if ("plan" in o) {
      return {
        plan: normalizePlan(o.plan),
        taxes: o.taxes !== undefined ? normalizeTaxes(o.taxes) : fallbackTaxes,
      };
    }
  }
  return { plan: defaultSlotPlan(), taxes: fallbackTaxes };
}

function configFromState(state: PersistedAppState, planId: PlanSlotId): StartConfig {
  const stored = state.plans[planId];
  return {
    ...sharedFromConfig(state),
    plan: stored.plan,
    taxes: stored.taxes,
  };
}

function createDefaultState(plan1?: PlanEntry[], shared?: StartConfig): PersistedAppState {
  const cfg = shared ?? normalizeConfig(defaultConfig);
  return {
    version: STORAGE_VERSION,
    ...sharedFromConfig(cfg),
    activePlanId: 1,
    livePlanId: null,
    plans: {
      1: {
        plan: clonePlanEntries(plan1 ?? cfg.plan),
        taxes: normalizeTaxes(cfg.taxes),
      },
      2: { plan: defaultSlotPlan(), taxes: [] },
      3: { plan: defaultSlotPlan(), taxes: [] },
    },
  };
}

function loadStoredState(): PersistedAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: unknown = JSON.parse(raw);
    const version =
      parsed && typeof parsed === "object"
        ? (parsed as { version?: unknown }).version
        : undefined;
    if (version === 2 || version === 3) {
      const obj = parsed as Partial<PersistedAppState> & {
        taxes?: unknown;
        plans?: Partial<Record<PlanSlotId, unknown>>;
      };
      const fallbackTaxes = normalizeTaxes(obj.taxes);
      const slot1 = normalizeStoredPlan(obj.plans?.[1], fallbackTaxes);
      const cfg = normalizeConfig({
        ...obj,
        plan: slot1.plan,
        taxes: slot1.taxes,
      });
      return {
        version: STORAGE_VERSION,
        ...sharedFromConfig(cfg),
        activePlanId: isPlanSlotId(obj.activePlanId) ? obj.activePlanId : 1,
        livePlanId: isPlanSlotId(obj.livePlanId) ? obj.livePlanId : null,
        plans: {
          1: slot1,
          2: normalizeStoredPlan(obj.plans?.[2], fallbackTaxes),
          3: normalizeStoredPlan(obj.plans?.[3], fallbackTaxes),
        },
      };
    }
    const cfg = normalizeConfig(parsed);
    return createDefaultState(cfg.plan, cfg);
  } catch {
    return createDefaultState();
  }
}

function defaultAddTick(
  inspectTick: number | null,
  currentTick: number,
  earliest = 0,
): number {
  const preferred = inspectTick != null ? inspectTick : currentTick;
  return Math.max(0, preferred, earliest);
}

export default function App() {
  const [appState, setAppState] = useState<PersistedAppState>(() => loadStoredState());
  const [viewId, setViewId] = useState<PlanViewId>(appState.activePlanId);
  const viewingOwnPlan = isPlanSlotId(viewId);
  const activeSlot: PlanSlotId = viewingOwnPlan ? viewId : appState.activePlanId;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (err) {
      console.error("Konnte Plan nicht speichern", err);
    }
  }, [appState]);

  const startCfg = useMemo(
    () => configFromState(appState, activeSlot),
    [appState, activeSlot],
  );

  const updateCurrentPlan = (updater: (plan: PlanEntry[]) => PlanEntry[]) => {
    setAppState((prev) => {
      const slot = isPlanSlotId(viewId) ? viewId : prev.activePlanId;
      const current = prev.plans[slot];
      return {
        ...prev,
        plans: { ...prev.plans, [slot]: { ...current, plan: updater(current.plan) } },
      };
    });
  };

  const viewCfg = useMemo((): StartConfig => {
    if (viewingOwnPlan) return startCfg;
    const template = planTemplates.find((item) => item.id === viewId);
    if (!template) return startCfg;
    return { ...startCfg, plan: template.plan, taxes: [] };
  }, [startCfg, viewId, viewingOwnPlan]);

  const plan = useMemo(() => {
    try {
      return calculateFastestWayToGoal(viewCfg);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [viewCfg]);

  const addableTechs = useMemo(() => getAddableTechs(viewCfg.plan), [viewCfg.plan]);
  const neededTechs = useMemo(
    () => missingRequiredTechs(viewCfg.plan),
    [viewCfg.plan],
  );
  const plannedTechs = useMemo(
    () => new Set(viewCfg.plan.filter((e) => e.kind === "tech").map((e) => e.name)),
    [viewCfg.plan],
  );
  const allShips = useMemo(() => getShips(), []);
  const allRecon = useMemo(() => getReconItems(), []);

  const hasObservatorium = hasTechInPlan(viewCfg.plan, "Observatorium");
  const hasExtraktorTech = hasTechInPlan(viewCfg.plan, "Extraktor");
  const hasHandelsplatz = hasTechInPlan(viewCfg.plan, "Handelsplatz");
  const roidBlocked =
    !hasTechInPlan(viewCfg.plan, "Marineakademie") ||
    !viewCfg.plan.some((e) => e.kind === "unit" && e.name === "Cleptor");

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
  const nextAction = useMemo(() => {
    const ticks = actionTicks.filter((t) =>
      t.started.some((job) => job.type !== "custom" && job.type !== "trade"),
    );
    return ticks.find((t) => t.tick >= currentTick) ?? null;
  }, [actionTicks, currentTick]);

  const [inspectTick, setInspectTick] = useState<number | null>(null);

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
    const defaultTick = defaultAddTick(
      inspectTick,
      currentTick,
      getEarliestTechStartTick(startCfg, name),
    );
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({ kind: "tech", tech, defaultTick });
    setDialogOpen(true);
  };

  const openAddUnit = (name: string) => {
    if (!viewingOwnPlan) return;
    const ship = shipByName(name);
    if (!ship) return;
    const defaultTick = defaultAddTick(
      inspectTick,
      currentTick,
      getEarliestBuildStartTick(startCfg, "unit", name),
    );
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
    const item = reconByName(name);
    if (!item) return;
    const defaultTick = defaultAddTick(
      inspectTick,
      currentTick,
      getEarliestBuildStartTick(startCfg, "recon", name),
    );
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
    extractorsMet?: number;
    extractorsKris?: number;
  } = {}) => {
    if (!viewingOwnPlan) return;
    const earliest =
      hasExtraktorTech
        ? getEarliestExtractorStartTick(startCfg)
        : hasObservatorium
          ? getEarliestAsteroidStartTick(startCfg)
          : 0;
    const defaultTick = defaultAddTick(inspectTick, currentTick, earliest);
    const info = getMaxExtractorsAtTick(startCfg, defaultTick);
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({
      kind: "economy",
      defaultTick,
      defaultAsteroids: preset.asteroids ?? 0,
      defaultExtractorsMet: preset.extractorsMet ?? 0,
      defaultExtractorsKris: preset.extractorsKris ?? 0,
      freeSlots: info.freeSlots,
      asteroidsOwned: info.asteroids,
      alreadyBuilt: info.alreadyBuilt,
      canAsteroids: true,
      canExtractors: true,
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
      defaultTick: defaultAddTick(inspectTick, currentTick),
      defaultLabel: "",
      defaultMet: 0,
      defaultKris: 0,
    });
    setDialogOpen(true);
  };

  const openAddTrade = () => {
    if (!viewingOwnPlan) return;
    const doneTick = plan?.steps.find((s) => s.name === "Handelsplatz")?.endTick ?? 0;
    setDialogMode("add");
    setEditingEntry(null);
    setDialogTarget({
      kind: "trade",
      defaultTick: defaultAddTick(inspectTick, currentTick, doneTick),
      defaultGive: "met",
      defaultGiveAmount: 0,
      defaultReceiveAmount: 0,
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
      defaultTick: defaultAddTick(inspectTick, currentTick),
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
      const ship = shipByName(entry.name) ?? {
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
      const item = reconByName(entry.name);
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
          ? {
              asteroids: entry.asteroids,
              extractorsMet: entry.extractorsMet,
              extractorsKris: entry.extractorsKris,
              startTick: entry.startTick,
            }
          : entry.kind === "asteroids"
            ? {
                asteroids: entry.count,
                extractorsMet: 0,
                extractorsKris: 0,
                startTick: entry.startTick,
              }
            : {
                asteroids: 0,
                extractorsMet: entry.resource === "met" ? entry.count : 0,
                extractorsKris: entry.resource === "kris" ? entry.count : 0,
                startTick: entry.startTick,
              };
      const info = getMaxExtractorsAtTick(startCfg, eco.startTick);
      const asteroidsOwned = Math.max(0, info.asteroids - eco.asteroids);
      const alreadyBuilt = Math.max(
        0,
        info.alreadyBuilt - eco.extractorsMet - eco.extractorsKris,
      );
      const freeSlots = Math.max(
        0,
        asteroidsOwned * 20 - alreadyBuilt,
      );
      setDialogTarget({
        kind: "economy",
        defaultTick: eco.startTick,
        defaultAsteroids: eco.asteroids,
        defaultExtractorsMet: eco.extractorsMet,
        defaultExtractorsKris: eco.extractorsKris,
        freeSlots,
        asteroidsOwned,
        alreadyBuilt,
        canAsteroids: true,
        canExtractors: true,
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
    } else if (entry.kind === "trade") {
      setDialogTarget({
        kind: "trade",
        defaultTick: entry.startTick,
        defaultGive: entry.give,
        defaultGiveAmount: entry.giveAmount,
        defaultReceiveAmount: entry.receiveAmount,
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
    asteroids?: number;
    extractorsMet?: number;
    extractorsKris?: number;
    label?: string;
    cost?: { met: number; kris: number };
    give?: "met" | "kris";
    giveAmount?: number;
    receiveAmount?: number;
    targetMet?: number;
    targetKris?: number;
    duration?: number;
  }) => {
    if (!dialogTarget) return;

    if (dialogMode === "edit" && editingEntry) {
      updateCurrentPlan((plan) =>
        plan.map((e) => {
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
            const extractorsMet = Math.max(0, values.extractorsMet ?? 0);
            const extractorsKris = Math.max(0, values.extractorsKris ?? 0);
            return {
              id: e.id,
              kind: "economy" as const,
              startTick: values.startTick,
              asteroids,
              extractorsMet,
              extractorsKris,
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
          if (e.kind === "trade") {
            const give = values.give === "kris" ? "kris" : "met";
            return {
              ...e,
              startTick: values.startTick,
              give,
              giveAmount: Math.max(0, values.giveAmount ?? e.giveAmount),
              receiveAmount: Math.max(0, values.receiveAmount ?? e.receiveAmount),
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
      );
      return;
    }

    // add
    if (dialogTarget.kind === "tech") {
      const name = dialogTarget.tech.name;
      updateCurrentPlan((plan) => {
        if (plan.some((e) => e.kind === "tech" && e.name === name)) return plan;
        const entry: PlanEntry = {
          id: newPlanEntryId("tech"),
          kind: "tech",
          name,
          startTick: values.startTick,
        };
        return [...plan, entry];
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
      updateCurrentPlan((plan) => [...plan, entry]);
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
      updateCurrentPlan((plan) => [...plan, entry]);
      return;
    }

    if (dialogTarget.kind === "economy") {
      const asteroids = Math.max(0, values.asteroids ?? 0);
      const extractorsMet = Math.max(0, values.extractorsMet ?? 0);
      const extractorsKris = Math.max(0, values.extractorsKris ?? 0);
      if (asteroids <= 0 && extractorsMet <= 0 && extractorsKris <= 0) return;
      const entry: PlanEntry = {
        id: newPlanEntryId("eco"),
        kind: "economy",
        startTick: values.startTick,
        asteroids,
        extractorsMet,
        extractorsKris,
      };
      updateCurrentPlan((plan) => [...plan, entry]);
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
      updateCurrentPlan((plan) => [...plan, entry]);
      return;
    }

    if (dialogTarget.kind === "trade") {
      const give = values.give === "kris" ? "kris" : "met";
      const giveAmount = Math.max(0, values.giveAmount ?? 0);
      const receiveAmount = Math.max(0, values.receiveAmount ?? 0);
      if (giveAmount <= 0 || receiveAmount <= 0) return;
      const entry: PlanEntry = {
        id: newPlanEntryId("trade"),
        kind: "trade",
        startTick: values.startTick,
        give,
        giveAmount,
        receiveAmount,
      };
      updateCurrentPlan((plan) => [...plan, entry]);
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
      updateCurrentPlan((plan) => [...plan, entry]);
    }
  };

  const handleDialogRemove = () => {
    if (!editingEntry) return;
    updateCurrentPlan((plan) => removePlanEntryCascade(plan, editingEntry.id));
    setDialogOpen(false);
    setEditingEntry(null);
  };

  const resetPlan = (sourceId: string) => {
    setAppState((prev) => {
      const slot = isPlanSlotId(viewId) ? viewId : prev.activePlanId;
      let next: StoredPlan | null = null;
      if (sourceId.startsWith("template:")) {
        const templateId = sourceId.slice("template:".length);
        const template = planTemplates.find((item) => item.id === templateId);
        if (!template) return prev;
        next = { plan: clonePlanEntries(normalizePlan(template.plan)), taxes: [] };
      } else if (sourceId.startsWith("plan:")) {
        const id = Number(sourceId.slice("plan:".length));
        if (!isPlanSlotId(id) || id === slot) return prev;
        next = cloneStoredPlan(prev.plans[id]);
      }
      if (!next) return prev;
      return {
        ...prev,
        plans: { ...prev.plans, [slot]: next },
      };
    });
  };

  return (
    <TooltipProvider>
      <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
        <Header
          now={now}
          currentTick={currentTick}
          startCfg={viewCfg}
          plan={plan}
          nextAction={nextAction}
          onApplyStart={({ start_date, start_time, tick_minutes }) => {
            setAppState((prev) => ({ ...prev, start_date, start_time, tick_minutes }));
          }}
        />
        <PlanSwitcher
          viewId={viewId}
          livePlanId={appState.livePlanId}
          onViewChange={(id) => {
            setViewId(id);
            if (isPlanSlotId(id)) {
              setAppState((prev) => ({ ...prev, activePlanId: id }));
            }
          }}
        />
        <div className={viewingOwnPlan ? "grid min-h-0 flex-1 grid-cols-[26.4rem_minmax(0,1fr)]" : "grid min-h-0 flex-1 grid-cols-1"}>
          {viewingOwnPlan && (
            <Sidebar
              techs={addableTechs}
              neededTechs={neededTechs}
              plannedTechs={plannedTechs}
              ships={allShips}
              recon={allRecon}
              hasObservatorium={hasObservatorium}
              hasExtraktorTech={hasExtraktorTech}
              roidBlocked={roidBlocked}
              onAddTech={openAddTech}
              onAddUnit={openAddUnit}
              onAddRecon={openAddRecon}
              onAddEconomy={openAddEconomy}
              onAddRoid={openAddRoid}
              onAddCustom={openAddCustom}
              onAddTrade={openAddTrade}
              hasHandelsplatz={hasHandelsplatz}
            />
          )}
          <Overview
            actionTicks={actionTicks}
            logTicks={plan?.ticks ?? []}
            steps={plan?.steps ?? []}
            maxTick={maxTick}
            currentTick={currentTick}
            inspectTick={inspectTick}
            onInspectTick={setInspectTick}
            hasPlan={!!plan}
            slotShortage={plan ? getExtractorSlotShortage(plan) : null}
            exportJson={
              viewingOwnPlan
                ? JSON.stringify({ plan: startCfg.plan, taxes: startCfg.taxes }, null, 2)
                : undefined
            }
            exportPlanSlot={viewingOwnPlan ? activeSlot : undefined}
            parseImportPlan={viewingOwnPlan ? parseImportedPlan : undefined}
            onImportPlan={
              viewingOwnPlan
                ? (imported) => {
                    setAppState((prev) => {
                      const slot = isPlanSlotId(viewId) ? viewId : prev.activePlanId;
                      return {
                        ...prev,
                        plans: {
                          ...prev.plans,
                          [slot]: { plan: imported.plan, taxes: imported.taxes },
                        },
                      };
                    });
                  }
                : undefined
            }
            resetSources={
              viewingOwnPlan
                ? [
                    ...planTemplates.map((template) => ({
                      id: `template:${template.id}`,
                      label: template.label,
                    })),
                    ...PLAN_SLOT_IDS.filter((id) => id !== activeSlot).map((id) => ({
                      id: `plan:${id}`,
                      label: planSlotLabel(id),
                    })),
                  ]
                : undefined
            }
            onResetPlan={viewingOwnPlan ? resetPlan : undefined}
            taxes={viewCfg.taxes}
            onApplyTaxes={
              viewingOwnPlan
                ? (next) => {
                    setAppState((prev) => {
                      const slot = isPlanSlotId(viewId) ? viewId : prev.activePlanId;
                      const current = prev.plans[slot];
                      return {
                        ...prev,
                        plans: { ...prev.plans, [slot]: { ...current, taxes: next } },
                      };
                    });
                  }
                : undefined
            }
            isLivePlan={viewingOwnPlan && appState.livePlanId === activeSlot}
            onSetLivePlan={
              viewingOwnPlan
                ? () => {
                    setAppState((prev) => ({ ...prev, livePlanId: activeSlot }));
                  }
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
            if (dialogMode === "edit" && editingEntry) {
              if (editingEntry.kind === "economy") {
                bonusAst = editingEntry.asteroids;
                bonusExt = editingEntry.extractorsMet + editingEntry.extractorsKris;
              } else if (editingEntry.kind === "asteroids") {
                bonusAst = editingEntry.count;
              } else if (editingEntry.kind === "extractors") {
                bonusExt = editingEntry.count;
              }
            }
            const asteroids = Math.max(0, info.asteroids - bonusAst);
            const alreadyBuilt = Math.max(0, info.alreadyBuilt - bonusExt);
            const freeSlots = Math.max(0, asteroids * 20 - alreadyBuilt);
            // Refund costs of the entry being edited so max reflects free budget.
            const refundKris = bonusAst * ASTEROID_COST.kris;
            const refundMet =
              bonusExt > 0 ? extractorBatchCost(alreadyBuilt, bonusExt) : 0;
            let met = snap.met + refundMet;
            let kris = snap.kris + refundKris;
            if (dialogMode === "edit" && editingEntry?.kind === "trade") {
              if (editingEntry.give === "met") met += editingEntry.giveAmount;
              else kris += editingEntry.giveAmount;
            }
            return {
              freeSlots,
              asteroids,
              alreadyBuilt,
              met,
              kris,
            };
          }}
        />
      </main>
    </TooltipProvider>
  );
}
