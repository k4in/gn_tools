import { clonePlanEntries, defaults as defaultConfig, isPlanSlotId, type PlanEntry, type PlanSlotId } from "@/lib/gn-data/plan.ts";
import {
  clampAttackDuration,
  clampAttackRoidDuration,
  newPlanEntryId,
  normalizeRoidMulti,
  normalizeTaxes,
  type StartConfig,
  type TaxSegment,
} from "@/lib/calculate-fastest-way-to-goal.ts";
import { parseHistoryWindow, type HistoryWindow } from "@/lib/history-window.ts";

/** Persistenz des Planers im localStorage – auch von anderen Tools (z. B. Angriffs-Rentabilität) gelesen. */
export const PLAN_STORAGE_KEY = "gn_tool.plan";

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
      return typeof o.name === "string" && !!o.name && typeof o.count === "number" && o.count > 0;
    case "economy": {
      const asteroids = typeof o.asteroids === "number" && Number.isFinite(o.asteroids) ? Math.max(0, Math.floor(o.asteroids)) : 0;
      o.asteroids = asteroids;
      const hasNew = typeof o.extractorsMet === "number" || typeof o.extractorsKris === "number";
      if (hasNew) {
        const extractorsMet =
          typeof o.extractorsMet === "number" && Number.isFinite(o.extractorsMet) ? Math.max(0, Math.floor(o.extractorsMet)) : 0;
        const extractorsKris =
          typeof o.extractorsKris === "number" && Number.isFinite(o.extractorsKris) ? Math.max(0, Math.floor(o.extractorsKris)) : 0;
        o.extractorsMet = extractorsMet;
        o.extractorsKris = extractorsKris;
        return asteroids > 0 || extractorsMet > 0 || extractorsKris > 0;
      }
      const extractors = typeof o.extractors === "number" && Number.isFinite(o.extractors) ? Math.max(0, Math.floor(o.extractors)) : 0;
      if (asteroids <= 0 && extractors <= 0) return false;
      if (extractors > 0 && o.resource !== "met" && o.resource !== "kris") {
        return false;
      }
      return true;
    }
    // legacy kinds — accepted then migrated in normalizePlan
    case "extractors":
      return (o.resource === "met" || o.resource === "kris") && typeof o.count === "number" && o.count > 0;
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
      return giveAmt > 0 || receiveAmt > 0;
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
      const multi = normalizeRoidMulti(o.multi);
      if (multi) o.multi = multi;
      else delete o.multi;
      return met > 0 || kris > 0;
    }
    case "catastrophe": {
      const duration = o.duration;
      if (typeof duration !== "number" || !Number.isFinite(duration)) return false;
      o.duration = Math.min(25, Math.max(1, Math.floor(duration)));
      return true;
    }
    case "attack": {
      const duration = o.duration;
      if (typeof duration !== "number" || !Number.isFinite(duration)) return false;
      o.duration = clampAttackDuration(duration);
      if (typeof o.roidDuration === "number" && Number.isFinite(o.roidDuration)) {
        o.roidDuration = clampAttackRoidDuration(o.roidDuration, o.duration as number);
      } else {
        delete o.roidDuration;
      }
      // Ziel-Exen sind optional (ältere Angriffsflüge hatten keine).
      function exen(v: unknown) {
        return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
      }
      o.targetMet = exen(o.targetMet);
      o.targetKris = exen(o.targetKris);
      const multi = normalizeRoidMulti(o.multi);
      if (multi) o.multi = multi;
      else delete o.multi;
      if (o.noReturn === true) o.noReturn = true;
      else delete o.noReturn;
      return true;
    }
    case "snapshot": {
      function num(v: unknown) {
        return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
      }
      const met = num(o.met);
      const kris = num(o.kris);
      const extractorsMet = num(o.extractorsMet);
      const extractorsKris = num(o.extractorsKris);
      const asteroids = num(o.asteroids);
      if (met === null || kris === null || extractorsMet === null || extractorsKris === null || asteroids === null) {
        return false;
      }
      o.met = met;
      o.kris = kris;
      o.extractorsMet = extractorsMet;
      o.extractorsKris = extractorsKris;
      o.asteroids = asteroids;
      return true;
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
    if (typeof legacy.extractorsMet === "number" || typeof legacy.extractorsKris === "number") {
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

const TECH_RENAMES: Record<string, string> = {
  "Aufwertung des Militärscans": "Erweiterter Militärscan",
  "Aufwertung des Nachrichtenscans": "Erweiterter Nachrichtenscan",
};

function renameTech(name: string): string {
  return TECH_RENAMES[name] ?? name;
}

function migratePlanEntry(entry: PlanEntry): PlanEntry {
  if (entry.kind !== "tech") return entry;
  const name = renameTech(entry.name);
  return name === entry.name ? entry : { ...entry, name };
}

function collectPlanEntries(raw: unknown): PlanEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PlanEntry[] = [];
  for (const item of raw) {
    // migrate legacy string entries
    if (typeof item === "string" && item.trim()) {
      out.push({
        id: newPlanEntryId("legacy"),
        kind: "tech",
        name: renameTech(item.trim()),
        startTick: 0,
      });
      continue;
    }
    if (!isPlanEntry(item)) continue;
    const e = migratePlanEntry(item as PlanEntry);
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
        ...(e.multi ? { multi: normalizeRoidMulti(e.multi) } : {}),
      });
      continue;
    }
    if (e.kind === "catastrophe") {
      out.push({
        id: e.id,
        kind: "catastrophe",
        startTick: Math.max(0, Math.floor(e.startTick)),
        duration: Math.min(25, Math.max(1, Math.floor(e.duration))),
      });
      continue;
    }
    if (e.kind === "attack") {
      out.push({
        id: e.id,
        kind: "attack",
        startTick: Math.max(0, Math.floor(e.startTick)),
        duration: clampAttackDuration(e.duration),
        roidDuration: clampAttackRoidDuration(e.roidDuration, e.duration),
        targetMet: Math.max(0, Math.floor(e.targetMet)),
        targetKris: Math.max(0, Math.floor(e.targetKris)),
        ...(e.multi ? { multi: normalizeRoidMulti(e.multi) } : {}),
        ...(e.noReturn ? { noReturn: true } : {}),
      });
      continue;
    }
    if (e.kind === "snapshot") {
      out.push({
        id: e.id,
        kind: "snapshot",
        startTick: Math.max(0, Math.floor(e.startTick)),
        met: Math.max(0, Math.floor(e.met)),
        kris: Math.max(0, Math.floor(e.kris)),
        extractorsMet: Math.max(0, Math.floor(e.extractorsMet)),
        extractorsKris: Math.max(0, Math.floor(e.extractorsKris)),
        asteroids: Math.max(0, Math.floor(e.asteroids)),
      });
      continue;
    }
    out.push({
      ...e,
      startTick: Math.max(0, Math.floor(e.startTick)),
      ...("count" in e ? { count: Math.max(1, Math.floor(e.count)) } : {}),
    } as PlanEntry);
  }
  return out;
}

export function normalizePlan(raw: unknown): PlanEntry[] {
  const out = collectPlanEntries(raw);
  return out && out.length ? out : [...defaultConfig.plan];
}

export type ImportedPlan = {
  plan: PlanEntry[];
  taxes: TaxSegment[];
};

export type ImportPlanParseResult = ({ ok: true } & ImportedPlan) | { ok: false; error: string };

export function parseImportedPlan(text: string): ImportPlanParseResult {
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

  const start_time = typeof obj.start_time === "string" && obj.start_time.trim() ? obj.start_time : base.start_time;
  const start_date = typeof obj.start_date === "string" && obj.start_date.trim() ? obj.start_date : base.start_date;

  const res = obj.starting_resources;
  const metall = res && typeof res.metall === "number" && Number.isFinite(res.metall) ? res.metall : base.starting_resources.metall;
  const kristall =
    res && typeof res.kristall === "number" && Number.isFinite(res.kristall) ? res.kristall : base.starting_resources.kristall;

  let plan = normalizePlan(obj.plan);

  // Migrate legacy economyOrders into plan entries
  if (Array.isArray(obj.economyOrders)) {
    for (const item of obj.economyOrders) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" && o.id ? o.id : newPlanEntryId("eco");
      const count = typeof o.count === "number" && o.count > 0 ? Math.floor(o.count) : 0;
      const atTick = typeof o.atTick === "number" && Number.isFinite(o.atTick) ? Math.max(0, Math.floor(o.atTick)) : 0;
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

  const tick_minutes = typeof obj.tick_minutes === "number" && obj.tick_minutes > 0 ? obj.tick_minutes : base.tick_minutes;
  const max_ticks = typeof obj.max_ticks === "number" && obj.max_ticks > base.max_ticks ? obj.max_ticks : base.max_ticks;

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

export type StoredPlan = {
  plan: PlanEntry[];
  taxes: TaxSegment[];
};

export type PersistedAppState = {
  version: typeof STORAGE_VERSION;
  start_time: string;
  start_date: string;
  tick_minutes: number;
  max_ticks: number;
  starting_resources: { metall: number; kristall: number };
  activePlanId: PlanSlotId;
  /** Kosmetisch: welcher Slot gerade gespielt wird. Fehlt in alten Saves. */
  livePlanId: PlanSlotId | null;
  /** Anzeige: Vergangenheit kürzen. Fehlt in alten Saves → recent. */
  historyWindow: HistoryWindow;
  plans: Record<PlanSlotId, StoredPlan>;
};

function sharedFromConfig(cfg: Pick<StartConfig, "start_time" | "start_date" | "tick_minutes" | "max_ticks" | "starting_resources">) {
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

export function cloneStoredPlan(stored: StoredPlan): StoredPlan {
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

export function configFromState(state: PersistedAppState, planId: PlanSlotId): StartConfig {
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
    historyWindow: "recent",
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

export function loadStoredState(): PersistedAppState {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultState();
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: unknown = JSON.parse(raw);
    const version = parsed && typeof parsed === "object" ? (parsed as { version?: unknown }).version : undefined;
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
        historyWindow: parseHistoryWindow(obj.historyWindow),
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
