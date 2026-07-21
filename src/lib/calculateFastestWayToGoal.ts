import {
  getExtractorCost,
  getExtractorYield,
  getRequiredAsteroidAmount,
} from "@/gn-data/extractor";
import { type PlanEntry } from "@/gn-data/plan";
import { ships, type Ship } from "@/gn-data/ships";
import { techtree, type TechTreeEntry } from "@/gn-data/techtree";
import { utilities, type Utility } from "@/gn-data/utility";

export type { PlanEntry };

export const TICK_MINUTES = 15;
const MAX_TICKS = 5000;

const asteroidUtility = utilities.find((u) => u.name === "Asteroid");
const ASTEROID_COST_KRIS = asteroidUtility?.cost.kris ?? 10_000;
/** Plätze pro Asteroid — abgeleitet aus getRequiredAsteroidAmount. */
const EXTRACTOR_SLOT_PER_ASTEROID = (() => {
  let n = 1;
  while (getRequiredAsteroidAmount(n) === 1) n += 1;
  return n - 1;
})();
const EXTRACTOR_INCOME_PER_UNIT = getExtractorYield(1);

/** Absolute income per completed building (not cumulative across tiers). */
const INCOME_BY_BUILDING: Record<string, { met: number; kris: number }> = {
  Koloniezentrum: { met: 500, kris: 500 },
  Kristallmine: { met: 0, kris: 1000 },
  Metallmine: { met: 1000, kris: 0 },
  "Zweite Kristallmine": { met: 0, kris: 2000 },
  "Zweite Metallmine": { met: 2000, kris: 0 },
  "Tiefe Kristallminen": { met: 0, kris: 4000 },
  "Tiefe Metallminen": { met: 4000, kris: 0 },
  "Vollautomatisierte Kristallmine": { met: 0, kris: 10000 },
  "Vollautomatisierte Metallmine": { met: 10000, kris: 0 },
};

// ---------------------------------------------------------------------------
// Plan model
// ---------------------------------------------------------------------------

export type StartConfig = {
  start_time: string;
  start_date: string;
  starting_resources: { metall: number; kristall: number };
  plan: PlanEntry[];
};

export type Res = { met: number; kris: number };

export type JobKind = TechTreeEntry["type"] | "economy" | "unit" | "recon";

export type Job = {
  name: string;
  type: JobKind;
  startTick: number;
  endTick: number;
  cost: Res;
  /** Verknüpfung zum Plan-Eintrag (für Timeline-Edit). */
  planEntryId?: string;
};

export type NamedJob = {
  name: string;
  type: JobKind;
  planEntryId?: string;
};

export type ActiveJob = NamedJob & {
  remainingTicks: number;
};

export type TickSnapshot = {
  tick: number;
  clockLabel: string;
  met: number;
  kris: number;
  incomeMet: number;
  incomeKris: number;
  active: ActiveJob[];
  started: NamedJob[];
  finished: NamedJob[];
  asteroids: number;
  extractorsMet: number;
  extractorsKris: number;
};

export type PlanResult = {
  goal: string;
  finishTick: number;
  steps: Job[];
  ticks: TickSnapshot[];
  /** Tech-Namen im Plan (explizit). */
  targetSet: string[];
  /** Tech-Namen auf dem kritischen Pfad zum letzten Tech-Ziel. */
  critical: Set<string>;
  peakWaitTicks: number;
  finalRes: Res;
  start: StartConfig;
  asteroids: number;
  extractorsMet: number;
  extractorsKris: number;
  /** Tatsächlicher Start-Tick je Plan-Eintrag-id. */
  entryActualStart: Record<string, number>;
  /** Fertigstellungs-Tick je Plan-Eintrag-id. */
  entryFinishTicks: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function byName(entries: TechTreeEntry[] = techtree): Map<string, TechTreeEntry> {
  return new Map(entries.map((e) => [e.name, e]));
}

export function getTechtree(): TechTreeEntry[] {
  return techtree;
}

export function shipByName(name: string): Ship | undefined {
  return ships.find((s) => s.name === name);
}

export function reconByName(name: string): Utility | undefined {
  return utilities.find((u) => u.name === name && u.name !== "Asteroid");
}

export function getReconItems(): Utility[] {
  return utilities.filter((u) => u.name !== "Asteroid");
}

export function getShips(): Ship[] {
  return ships;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addRes(a: Res, b: Res): Res {
  return { met: a.met + b.met, kris: a.kris + b.kris };
}

function canAfford(res: Res, cost: Res) {
  return res.met >= cost.met && res.kris >= cost.kris;
}

function pay(res: Res, cost: Res): Res {
  return { met: res.met - cost.met, kris: res.kris - cost.kris };
}

function requiredClosure(goal: string, map: Map<string, TechTreeEntry>) {
  const needed = new Set<string>();
  const visit = (name: string) => {
    if (needed.has(name)) return;
    const entry = map.get(name);
    if (!entry) throw new Error(`Unbekannte Technologie: ${name}`);
    needed.add(name);
    for (const dep of entry.dependencies) visit(dep);
  };
  visit(goal);
  return needed;
}

function criticalPathTicks(
  name: string,
  map: Map<string, TechTreeEntry>,
  memo = new Map<string, number>(),
): number {
  const cached = memo.get(name);
  if (cached !== undefined) return cached;
  const entry = map.get(name)!;
  const depMax = entry.dependencies.length
    ? Math.max(...entry.dependencies.map((d) => criticalPathTicks(d, map, memo)))
    : 0;
  const total = depMax + entry.ticks;
  memo.set(name, total);
  return total;
}

function criticalPathSet(goal: string, map: Map<string, TechTreeEntry>) {
  const path = new Set<string>();
  let current: string | undefined = goal;
  while (current) {
    path.add(current);
    const entry: TechTreeEntry = map.get(current)!;
    if (!entry.dependencies.length) break;
    current = entry.dependencies.reduce((best, d) =>
      criticalPathTicks(d, map) > criticalPathTicks(best, map) ? d : best,
    );
  }
  return path;
}

function incomeFrom(completed: Set<string>): Res {
  let met = 0;
  let kris = 0;
  for (const name of completed) {
    const inc = INCOME_BY_BUILDING[name];
    if (!inc) continue;
    met = Math.max(met, inc.met);
    kris = Math.max(kris, inc.kris);
  }
  return { met, kris };
}

function parseStartMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Lokale Start-DateTime aus plan-defaults (ohne TZ-Drift durch ISO-Parse). */
function startDateTime(startCfg: StartConfig): Date {
  const [y, mo, d] = startCfg.start_date.split("-").map(Number);
  const [h, m] = startCfg.start_time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

/**
 * Verstrichene Ticks seit Planstart: floor((now − start) / 15min).
 */
export function computeCurrentTick(startCfg: StartConfig, now: Date = new Date()): number {
  const start = startDateTime(startCfg);
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (TICK_MINUTES * 60 * 1000));
}

export function formatWallClock(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${d}.${mo}.${y} ${hh}:${mm}`;
}

function tickDateTime(startCfg: StartConfig, tick: number): Date {
  const start = startDateTime(startCfg);
  return new Date(start.getTime() + tick * TICK_MINUTES * 60 * 1000);
}

/** Restzeit bis zu einem Tick, z.B. "in 2 Stunden und 05 Minuten". */
export function formatTimeUntilTick(
  startCfg: StartConfig,
  tick: number,
  now: Date = new Date(),
): string {
  const target = tickDateTime(startCfg, tick);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "jetzt";

  const totalMinutes = Math.ceil(diffMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `in ${minutes} ${minutes === 1 ? "Minute" : "Minuten"}`;
  }
  if (minutes === 0) {
    return `in ${hours} ${hours === 1 ? "Stunde" : "Stunden"}`;
  }
  return `in ${hours} ${hours === 1 ? "Stunde" : "Stunden"} und ${String(minutes).padStart(2, "0")} Minuten`;
}

export function clockLabel(startCfg: StartConfig, tick: number) {
  const base = parseStartMinutes(startCfg.start_time);
  const total = base + tick * TICK_MINUTES;
  const dayOffset = Math.floor(total / (24 * 60));
  const mins = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  const date = new Date(`${startCfg.start_date}T00:00:00`);
  date.setDate(date.getDate() + dayOffset);
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${d}.${mo}.${y} ${hh}:${mm}`;
}

export function formatRes(n: number) {
  return Math.round(n).toLocaleString("de-DE");
}

export function extractorUnitCost(index1Based: number): number {
  return getExtractorCost(index1Based);
}

/** Gesamtkosten der ersten n Extraktoren (65+130+…+n*65). */
export function totalExtractorCost(count: number): number {
  if (count <= 0) return 0;
  let sum = 0;
  for (let i = 1; i <= count; i++) sum += getExtractorCost(i);
  return sum;
}

/**
 * Kosten für `count` weitere Extraktoren, wenn bereits `alreadyBuilt` stehen.
 * Index ist 1-basiert: nächster kostet (alreadyBuilt+1)*65.
 */
export function extractorBatchCost(alreadyBuilt: number, count: number): number {
  if (count <= 0) return 0;
  let sum = 0;
  const base = Math.max(0, alreadyBuilt);
  for (let i = 1; i <= count; i++) sum += getExtractorCost(base + i);
  return sum;
}

export function newPlanEntryId(prefix = "plan"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** @deprecated use newPlanEntryId */
export function newEconomyOrderId(): string {
  return newPlanEntryId("eco");
}

export function formatPlanEntryLabel(entry: PlanEntry): string {
  switch (entry.kind) {
    case "tech":
      return entry.name;
    case "unit":
      return entry.count === 1 ? entry.name : `${entry.count}× ${entry.name}`;
    case "recon":
      return entry.count === 1 ? entry.name : `${entry.count}× ${entry.name}`;
    case "extractors": {
      const base =
        entry.resource === "met"
          ? entry.count === 1
            ? "1 Metallextraktor"
            : `${entry.count} Metallextraktoren`
          : entry.count === 1
            ? "1 Kristallextraktor"
            : `${entry.count} Kristallextraktoren`;
      return base;
    }
    case "asteroids":
      return entry.count === 1
        ? "1 Asteroid scannen"
        : `${entry.count} Asteroiden scannen`;
  }
}

/**
 * Max. Extraktoren, die mit aktuellem Metall + Kristall (Asteroiden) finanzierbar sind.
 */
export function maxAffordableExtractors(opts: {
  met: number;
  kris: number;
  alreadyBuilt?: number;
  asteroids?: number;
  slots?: number;
  maxAsteroids?: number;
  /** Wenn false: keine Auto-Asteroiden-Käufe. */
  allowBuyAsteroids?: boolean;
}): number {
  let met = opts.met;
  let kris = opts.kris;
  let built = opts.alreadyBuilt ?? 0;
  let asteroids = opts.asteroids ?? 0;
  let slots = opts.slots ?? asteroids * EXTRACTOR_SLOT_PER_ASTEROID;
  const maxAsteroids = opts.maxAsteroids ?? 50;
  const allowBuy = opts.allowBuyAsteroids ?? true;

  let canBuild = 0;
  while (true) {
    while (
      allowBuy &&
      built + canBuild >= slots &&
      asteroids < maxAsteroids &&
      kris >= ASTEROID_COST_KRIS
    ) {
      kris -= ASTEROID_COST_KRIS;
      asteroids += 1;
      slots += EXTRACTOR_SLOT_PER_ASTEROID;
    }
    if (built + canBuild >= slots) break;
    const cost = extractorUnitCost(built + canBuild + 1);
    if (met < cost) break;
    met -= cost;
    canBuild += 1;
  }
  return canBuild;
}

function totalExtractorIncome(extractorsMet: number, extractorsKris: number): Res {
  return {
    met: extractorsMet * EXTRACTOR_INCOME_PER_UNIT,
    kris: extractorsKris * EXTRACTOR_INCOME_PER_UNIT,
  };
}

export function plannedTechNames(plan: PlanEntry[]): string[] {
  return plan.filter((e): e is Extract<PlanEntry, { kind: "tech" }> => e.kind === "tech").map(
    (e) => e.name,
  );
}

/**
 * Freigeschaltete Technologien: Dependencies sind im Plan als Tech enthalten,
 * Tech selbst noch nicht im Plan.
 */
export function getUnlockedTechs(plan: PlanEntry[]): TechTreeEntry[] {
  const owned = new Set(plannedTechNames(plan));
  return techtree
    .filter((e) => !owned.has(e.name))
    .filter((e) => e.dependencies.every((d) => owned.has(d)))
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

/** Schiffe, deren Tech-Dependencies im Plan stehen. */
export function getAvailableShips(plan: PlanEntry[]): Ship[] {
  const owned = new Set(plannedTechNames(plan));
  return ships.filter((s) => s.dependencies.every((d) => owned.has(d)));
}

/** Recon-Utilities (ohne Asteroid), deren Dependencies im Plan stehen. */
export function getAvailableRecon(plan: PlanEntry[]): Utility[] {
  const owned = new Set(plannedTechNames(plan));
  return getReconItems().filter((u) => u.dependencies.every((d) => owned.has(d)));
}

export function hasTechInPlan(plan: PlanEntry[], name: string): boolean {
  return plan.some((e) => e.kind === "tech" && e.name === name);
}

/** Freie Extraktor-Slots aus geplanten Asteroiden / bereits gebauten Extraktoren (sim-agnostisch grob). */
export function extractorSlotsFromAsteroids(asteroids: number): number {
  return asteroids * EXTRACTOR_SLOT_PER_ASTEROID;
}

export const ASTEROID_SLOT_CAPACITY = EXTRACTOR_SLOT_PER_ASTEROID;
export const ASTEROID_COST = { met: 0, kris: ASTEROID_COST_KRIS } as const;

/**
 * Entfernt einen Plan-Eintrag und alle Einträge, die (transitiv) von entfernten
 * Tech-Einträgen abhängen.
 */
export function removePlanEntryCascade(plan: PlanEntry[], id: string): PlanEntry[] {
  const map = byName();
  const toRemove = new Set<string>([id]);
  const removedTechNames = new Set<string>();

  const seed = plan.find((e) => e.id === id);
  if (!seed) return plan;
  if (seed.kind === "tech") removedTechNames.add(seed.name);

  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of plan) {
      if (toRemove.has(entry.id)) continue;

      if (entry.kind === "tech") {
        const tech = map.get(entry.name);
        if (!tech) continue;
        const depsOnRemoved = tech.dependencies.some((d) => removedTechNames.has(d));
        // auch transitive: Closure schneidet removedTechNames
        const closure = requiredClosure(entry.name, map);
        const hits = [...removedTechNames].some((n) => n !== entry.name && closure.has(n));
        if (depsOnRemoved || hits) {
          toRemove.add(entry.id);
          removedTechNames.add(entry.name);
          changed = true;
        }
      } else if (entry.kind === "unit") {
        const ship = shipByName(entry.name);
        if (ship?.dependencies.some((d) => removedTechNames.has(d))) {
          toRemove.add(entry.id);
          changed = true;
        }
      } else if (entry.kind === "recon") {
        const item = reconByName(entry.name);
        if (item?.dependencies.some((d) => removedTechNames.has(d))) {
          toRemove.add(entry.id);
          changed = true;
        }
      } else if (entry.kind === "extractors") {
        if (removedTechNames.has("Extraktor")) {
          toRemove.add(entry.id);
          changed = true;
        }
      } else if (entry.kind === "asteroids") {
        if (removedTechNames.has("Observatorium")) {
          toRemove.add(entry.id);
          changed = true;
        }
      }
    }
  }

  return plan.filter((e) => !toRemove.has(e.id));
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

type PendingUnit = {
  entryId: string;
  name: string;
  type: "unit" | "recon";
  duration: number;
  unitCost: Res;
  remaining: number;
  desiredTick: number;
};

type PendingExtractors = {
  entryId: string;
  resource: "met" | "kris";
  remaining: number;
  desiredTick: number;
};

type PendingAsteroids = {
  entryId: string;
  remaining: number;
  desiredTick: number;
};

/**
 * Plan-getriebene Simulation:
 * - Jeder Plan-Eintrag hat desired startTick (User-Input)
 * - Tatsächlicher Start: max(desired, earliest feasible) — nie früher als desired
 * - Ressourcenkonflikte: Insertions-Reihenfolge (Array-Index)
 * - Unbegrenzt parallele Jobs
 */
function simulatePlan(
  plan: PlanEntry[],
  map: Map<string, TechTreeEntry>,
  startCfg: StartConfig,
): Omit<PlanResult, "start" | "critical"> {
  let res: Res = {
    met: startCfg.starting_resources.metall,
    kris: startCfg.starting_resources.kristall,
  };
  const completed = new Set<string>();
  const completedAt = new Map<string, number>();
  let active: Job[] = [];
  const steps: Job[] = [];
  const ticks: TickSnapshot[] = [];
  let peakWaitTicks = 0;
  let waitStreak = 0;

  let asteroids = 0;
  let extractorsMet = 0;
  let extractorsKris = 0;
  let extractorSlots = 0;

  const entryActualStart: Record<string, number> = {};
  const entryFinishTicks: Record<string, number> = {};
  const entryDone = new Set<string>();

  // Pending work derived from plan (insertion order preserved)
  const techEntries = plan.filter(
    (e): e is Extract<PlanEntry, { kind: "tech" }> => e.kind === "tech",
  );
  const pendingTechs = new Map<string, { entryId: string; desiredTick: number }>();
  for (const e of techEntries) {
    if (!map.has(e.name)) throw new Error(`Unbekannte Technologie: ${e.name}`);
    // duplicate tech names: only first counts as build target; later ignored
    if (!pendingTechs.has(e.name) && !completed.has(e.name)) {
      pendingTechs.set(e.name, { entryId: e.id, desiredTick: e.startTick });
    }
  }

  const pendingUnits: PendingUnit[] = [];
  const pendingExtractors: PendingExtractors[] = [];
  const pendingAsteroids: PendingAsteroids[] = [];

  for (const e of plan) {
    if (e.kind === "unit") {
      const ship = shipByName(e.name);
      if (!ship) throw new Error(`Unbekanntes Schiff: ${e.name}`);
      pendingUnits.push({
        entryId: e.id,
        name: e.name,
        type: "unit",
        duration: ship.ticks,
        unitCost: { met: ship.cost.met, kris: ship.cost.kris },
        remaining: Math.max(1, e.count),
        desiredTick: e.startTick,
      });
    } else if (e.kind === "recon") {
      const item = reconByName(e.name);
      if (!item) throw new Error(`Unbekanntes Recon-Item: ${e.name}`);
      pendingUnits.push({
        entryId: e.id,
        name: e.name,
        type: "recon",
        duration: item.ticks,
        unitCost: { met: item.cost.met, kris: item.cost.kris },
        remaining: Math.max(1, e.count),
        desiredTick: e.startTick,
      });
    } else if (e.kind === "extractors") {
      pendingExtractors.push({
        entryId: e.id,
        resource: e.resource,
        remaining: Math.max(1, e.count),
        desiredTick: e.startTick,
      });
    } else if (e.kind === "asteroids") {
      pendingAsteroids.push({
        entryId: e.id,
        remaining: Math.max(1, e.count),
        desiredTick: e.startTick,
      });
    }
  }

  const totalExtractors = () => extractorsMet + extractorsKris;

  const isReady = (name: string) => {
    const e = map.get(name)!;
    return e.dependencies.every((d) => completed.has(d));
  };

  const allDone = () => {
    if (pendingTechs.size > 0) return false;
    if (pendingUnits.some((u) => u.remaining > 0)) return false;
    if (pendingExtractors.some((u) => u.remaining > 0)) return false;
    if (pendingAsteroids.some((u) => u.remaining > 0)) return false;
    // active tech/unit jobs still running → wait
    if (active.length > 0) return false;
    return true;
  };

  const markEntryStart = (id: string, tick: number) => {
    if (entryActualStart[id] === undefined) entryActualStart[id] = tick;
  };

  const markEntryFinish = (id: string, tick: number) => {
    entryFinishTicks[id] = tick;
    entryDone.add(id);
  };

  const tryStart = (tick: number) => {
    const startedJobs: NamedJob[] = [];
    const finishedJobs: NamedJob[] = [];
    let spent: Res = { met: 0, kris: 0 };

    // Insertion order: walk plan array
    for (const entry of plan) {
      if (entry.kind === "tech") {
        const pending = pendingTechs.get(entry.name);
        if (!pending || pending.entryId !== entry.id) continue;
        if (tick < pending.desiredTick) continue;
        if (completed.has(entry.name)) {
          pendingTechs.delete(entry.name);
          continue;
        }
        if (active.some((j) => j.name === entry.name)) continue;
        if (!isReady(entry.name)) continue;
        const tech = map.get(entry.name)!;
        const cost = { met: tech.cost.met, kris: tech.cost.kris };
        if (!canAfford(res, cost)) continue;

        res = pay(res, cost);
        spent = addRes(spent, cost);
        const job: Job = {
          name: entry.name,
          type: tech.type,
          startTick: tick,
          endTick: tick + tech.ticks,
          cost,
          planEntryId: entry.id,
        };
        active.push(job);
        steps.push(job);
        startedJobs.push({ name: entry.name, type: tech.type, planEntryId: entry.id });
        markEntryStart(entry.id, tick);
        pendingTechs.delete(entry.name);
        continue;
      }

      if (entry.kind === "unit" || entry.kind === "recon") {
        const pending = pendingUnits.find((u) => u.entryId === entry.id);
        if (!pending || pending.remaining <= 0) continue;
        if (tick < pending.desiredTick) continue;

        // deps: for units/recon check tech deps completed
        const deps =
          entry.kind === "unit"
            ? shipByName(entry.name)?.dependencies ?? []
            : reconByName(entry.name)?.dependencies ?? [];
        if (!deps.every((d) => completed.has(d))) continue;

        // Batch as many as affordable this tick into one job ("500 Cleptor bauen")
        let built = 0;
        let batchCost: Res = { met: 0, kris: 0 };
        while (pending.remaining > 0 && canAfford(res, pending.unitCost)) {
          res = pay(res, pending.unitCost);
          batchCost = addRes(batchCost, pending.unitCost);
          spent = addRes(spent, pending.unitCost);
          pending.remaining -= 1;
          built += 1;
        }
        if (built <= 0) continue;

        const label =
          built === 1 ? `1 ${entry.name} bauen` : `${built} ${entry.name} bauen`;
        const duration = pending.duration;
        const job: Job = {
          name: label,
          type: pending.type,
          startTick: tick,
          endTick: tick + duration,
          cost: batchCost,
          planEntryId: entry.id,
        };
        if (duration <= 0) {
          steps.push(job);
          startedJobs.push({ name: label, type: pending.type, planEntryId: entry.id });
          finishedJobs.push({ name: label, type: pending.type, planEntryId: entry.id });
        } else {
          active.push(job);
          steps.push(job);
          startedJobs.push({ name: label, type: pending.type, planEntryId: entry.id });
        }
        markEntryStart(entry.id, tick);
        if (pending.remaining <= 0) {
          markEntryFinish(entry.id, tick + Math.max(0, duration));
        }
        continue;
      }

      if (entry.kind === "asteroids") {
        const pending = pendingAsteroids.find((p) => p.entryId === entry.id);
        if (!pending || pending.remaining <= 0) continue;
        if (tick < pending.desiredTick) continue;
        if (!completed.has("Observatorium")) continue;

        let bought = 0;
        while (pending.remaining > 0 && canAfford(res, { met: 0, kris: ASTEROID_COST_KRIS })) {
          const cost = { met: 0, kris: ASTEROID_COST_KRIS };
          res = pay(res, cost);
          spent = addRes(spent, cost);
          asteroids += 1;
          extractorSlots += EXTRACTOR_SLOT_PER_ASTEROID;
          pending.remaining -= 1;
          bought += 1;
          const name = `Asteroid scannen #${asteroids}`;
          const job: Job = {
            name,
            type: "economy",
            startTick: tick,
            endTick: tick,
            cost,
            planEntryId: entry.id,
          };
          steps.push(job);
          startedJobs.push({ name, type: "economy", planEntryId: entry.id });
          finishedJobs.push({ name, type: "economy", planEntryId: entry.id });
          markEntryStart(entry.id, tick);
        }
        if (bought > 0 && pending.remaining <= 0) {
          markEntryFinish(entry.id, tick);
        }
        continue;
      }

      if (entry.kind === "extractors") {
        const pending = pendingExtractors.find((p) => p.entryId === entry.id);
        if (!pending || pending.remaining <= 0) continue;
        if (tick < pending.desiredTick) continue;
        if (!completed.has("Extraktor")) continue;

        let built = 0;
        while (pending.remaining > 0 && totalExtractors() < extractorSlots) {
          const nextIndex = totalExtractors() + 1;
          const cost = { met: extractorUnitCost(nextIndex), kris: 0 };
          if (!canAfford(res, cost)) break;
          res = pay(res, cost);
          spent = addRes(spent, cost);
          if (pending.resource === "met") extractorsMet += 1;
          else extractorsKris += 1;
          pending.remaining -= 1;
          built += 1;
          const label =
            pending.resource === "met"
              ? `Extraktor (Metall) #${extractorsMet}`
              : `Extraktor (Kristall) #${extractorsKris}`;
          const job: Job = {
            name: label,
            type: "economy",
            startTick: tick,
            endTick: tick,
            cost,
            planEntryId: entry.id,
          };
          steps.push(job);
          startedJobs.push({ name: label, type: "economy", planEntryId: entry.id });
          finishedJobs.push({ name: label, type: "economy", planEntryId: entry.id });
          markEntryStart(entry.id, tick);
        }
        if (built > 0 && pending.remaining <= 0) {
          markEntryFinish(entry.id, tick);
        }
      }
    }

    return { startedJobs, finishedJobs, spent };
  };

  const snapshot = (
    tick: number,
    started: NamedJob[],
    finished: NamedJob[],
    delta: Res,
  ): TickSnapshot => ({
    tick,
    clockLabel: clockLabel(startCfg, tick),
    met: res.met,
    kris: res.kris,
    incomeMet: delta.met,
    incomeKris: delta.kris,
    active: active
      .map((j) => ({
        name: j.name,
        type: j.type,
        remainingTicks: Math.max(0, j.endTick - tick),
        planEntryId: j.planEntryId,
      }))
      .sort((a, b) => a.remainingTicks - b.remainingTicks || a.name.localeCompare(b.name)),
    started,
    finished,
    asteroids,
    extractorsMet,
    extractorsKris,
  });

  const resultAt = (finishTick: number) => ({
    goal: techEntries.at(-1)?.name ?? (plan.length ? formatPlanEntryLabel(plan[plan.length - 1]!) : "Plan"),
    finishTick,
    steps,
    ticks,
    targetSet: techEntries.map((e) => e.name),
    peakWaitTicks,
    finalRes: res,
    asteroids,
    extractorsMet,
    extractorsKris,
    entryActualStart: { ...entryActualStart },
    entryFinishTicks: { ...entryFinishTicks },
  });

  // Empty plan
  if (plan.length === 0) {
    ticks.push(
      snapshot(0, [], [], { met: 0, kris: 0 }),
    );
    return resultAt(0);
  }

  // t = 0
  {
    const { startedJobs, finishedJobs, spent } = tryStart(0);
    ticks.push(
      snapshot(0, startedJobs, finishedJobs, { met: -spent.met, kris: -spent.kris }),
    );
    if (allDone()) return resultAt(0);
  }

  for (let t = 1; t <= MAX_TICKS; t++) {
    const finishing = active.filter((j) => j.endTick === t);
    active = active.filter((j) => j.endTick !== t);
    const finishedJobs: NamedJob[] = [];
    for (const job of finishing) {
      // techs mark completed by name; units don't add to completed tech set
      if (job.type === "building" || job.type === "research") {
        completed.add(job.name);
        completedAt.set(job.name, t);
        if (job.planEntryId) markEntryFinish(job.planEntryId, t);
      } else if (job.planEntryId && entryFinishTicks[job.planEntryId] === undefined) {
        // unit/recon multi: finish already marked when last started with endTick
        const stillActive = active.some((j) => j.planEntryId === job.planEntryId);
        const stillPending = pendingUnits.some(
          (u) => u.entryId === job.planEntryId && u.remaining > 0,
        );
        if (!stillActive && !stillPending) markEntryFinish(job.planEntryId, t);
      }
      finishedJobs.push({
        name: job.name,
        type: job.type,
        planEntryId: job.planEntryId,
      });
    }

    // Income starts on the finish tick (endTick), not one tick later.
    // e.g. Koloniezentrum 2 ticks from 17:45 → done at 18:15 and produces at 18:15.
    const producing = new Set(
      [...completed].filter((n) => (completedAt.get(n) ?? 0) <= t),
    );
    const mineIncome = incomeFrom(producing);
    const extIncome = totalExtractorIncome(extractorsMet, extractorsKris);
    const income: Res = {
      met: mineIncome.met + extIncome.met,
      kris: mineIncome.kris + extIncome.kris,
    };
    if (income.met || income.kris) {
      res = addRes(res, income);
    }

    const { startedJobs, finishedJobs: instantFinished, spent } = tryStart(t);
    const allFinished = [...finishedJobs, ...instantFinished];

    const waiting =
      !allDone() && startedJobs.length === 0 && active.length === 0;

    if (waiting) {
      waitStreak += 1;
      peakWaitTicks = Math.max(peakWaitTicks, waitStreak);
    } else {
      waitStreak = 0;
    }

    const delta: Res = {
      met: income.met - spent.met,
      kris: income.kris - spent.kris,
    };
    ticks.push(snapshot(t, startedJobs, allFinished, delta));

    if (allDone()) {
      const finishTick = Math.max(
        0,
        ...Object.values(entryFinishTicks),
        ...steps.map((s) => s.endTick),
        t,
      );
      return resultAt(finishTick);
    }

    // Deadlock detection
    if (
      active.length === 0 &&
      income.met === 0 &&
      income.kris === 0 &&
      startedJobs.length === 0
    ) {
      const stuckTech = [...pendingTechs.keys()].some((n) => {
        if (!isReady(n)) return true;
        const c = map.get(n)!.cost;
        return !canAfford(res, { met: c.met, kris: c.kris });
      });
      const stuckAst = pendingAsteroids.some(
        (p) =>
          p.remaining > 0 &&
          t >= p.desiredTick &&
          (!completed.has("Observatorium") || res.kris < ASTEROID_COST_KRIS),
      );
      const stuckExt = pendingExtractors.some(
        (p) =>
          p.remaining > 0 &&
          t >= p.desiredTick &&
          (!completed.has("Extraktor") ||
            totalExtractors() >= extractorSlots ||
            res.met < extractorUnitCost(totalExtractors() + 1)),
      );
      if (
        (pendingTechs.size > 0 ||
          pendingUnits.some((u) => u.remaining > 0) ||
          pendingAsteroids.some((p) => p.remaining > 0) ||
          pendingExtractors.some((p) => p.remaining > 0)) &&
        (stuckTech || stuckAst || stuckExt || pendingUnits.some((u) => u.remaining > 0))
      ) {
        // If purely waiting for income that will never come
        const anyFutureIncome =
          [...completed].some((n) => INCOME_BY_BUILDING[n]) ||
          extractorsMet + extractorsKris > 0;
        if (!anyFutureIncome) {
          throw new Error(
            `Plan nicht erreichbar: keine Produktion und unzureichende Ressourcen bei Tick ${t}`,
          );
        }
      }
    }
  }

  throw new Error(`Plan nicht in ${MAX_TICKS} Ticks abgeschlossen`);
}

/**
 * Berechnet den Zeitplan anhand der Plan-Einträge (desired startTick + Insertion-Order).
 */
export function calculateFastestWayToGoal(startCfg: StartConfig): PlanResult {
  const map = byName(techtree);
  const plan =
    startCfg.plan.length > 0
      ? startCfg.plan
      : [
          {
            id: "fallback_koloniezentrum",
            kind: "tech" as const,
            name: "Koloniezentrum",
            startTick: 0,
          },
        ];

  const lastTech = [...plan].reverse().find((s) => s.kind === "tech");
  const critical = lastTech ? criticalPathSet(lastTech.name, map) : new Set<string>();

  const sim = simulatePlan(plan, map, { ...startCfg, plan });

  // Fix goal label (ternary precedence bug-safe)
  const goal =
    lastTech?.name ??
    (plan.length ? formatPlanEntryLabel(plan[plan.length - 1]!) : "Koloniezentrum");

  return {
    ...sim,
    goal,
    critical,
    start: { ...startCfg, plan },
  };
}

/**
 * Frühester Tick, an dem eine Tech starten könnte (Deps fertig + Ressourcen),
 * basierend auf der Simulation des aktuellen Plans. Nie kleiner als 0.
 */
export function getEarliestTechStartTick(
  startCfg: StartConfig,
  techName: string,
): number {
  const map = byName();
  const tech = map.get(techName);
  if (!tech) return 0;

  let plan: PlanResult;
  try {
    plan = calculateFastestWayToGoal(startCfg);
  } catch {
    return 0;
  }

  // Deps ready: max endTick of dependency jobs (or 0 if none)
  let depsReady = 0;
  for (const dep of tech.dependencies) {
    const job = plan.steps.find((s) => s.name === dep);
    if (job) depsReady = Math.max(depsReady, job.endTick);
    else if (!startCfg.plan.some((e) => e.kind === "tech" && e.name === dep)) {
      // dep not in plan — shouldn't happen for unlocked techs
      depsReady = Math.max(depsReady, 0);
    }
  }

  const cost = { met: tech.cost.met, kris: tech.cost.kris };
  for (const snap of plan.ticks) {
    if (snap.tick < depsReady) continue;
    if (snap.met >= cost.met && snap.kris >= cost.kris) return snap.tick;
  }

  // Project beyond plan end with steady income from completed mines + extractors
  const last = plan.ticks[plan.ticks.length - 1];
  const steady = last ? estimateSteadyIncome(plan) : { met: 0, kris: 0 };
  let met = plan.finalRes.met;
  let kris = plan.finalRes.kris;
  for (let t = (last?.tick ?? 0) + 1; t <= MAX_TICKS; t++) {
    met += steady.met;
    kris += steady.kris;
    if (met >= cost.met && kris >= cost.kris) return Math.max(t, depsReady);
  }
  return depsReady;
}

function estimateSteadyIncome(plan: PlanResult): Res {
  const completed = new Set(
    plan.steps
      .filter((s) => s.type === "building" || s.type === "research")
      .filter((s) => s.endTick <= plan.finishTick)
      .map((s) => s.name),
  );
  const mine = incomeFrom(completed);
  return {
    met: mine.met + plan.extractorsMet * EXTRACTOR_INCOME_PER_UNIT,
    kris: mine.kris + plan.extractorsKris * EXTRACTOR_INCOME_PER_UNIT,
  };
}

/**
 * Frühester sinnvoller Tick für Unit/Recon (Deps fertig + mind. 1 Stück finanzierbar).
 */
export function getEarliestBuildStartTick(
  startCfg: StartConfig,
  kind: "unit" | "recon",
  name: string,
): number {
  const item = kind === "unit" ? shipByName(name) : reconByName(name);
  if (!item) return 0;

  let plan: PlanResult;
  try {
    plan = calculateFastestWayToGoal(startCfg);
  } catch {
    return 0;
  }

  let depsReady = 0;
  for (const dep of item.dependencies) {
    const job = plan.steps.find((s) => s.name === dep);
    if (job) depsReady = Math.max(depsReady, job.endTick);
  }

  const cost = { met: item.cost.met, kris: item.cost.kris };
  for (const snap of plan.ticks) {
    if (snap.tick < depsReady) continue;
    if (snap.met >= cost.met && snap.kris >= cost.kris) return snap.tick;
  }

  const steady = estimateSteadyIncome(plan);
  let met = plan.finalRes.met;
  let kris = plan.finalRes.kris;
  const lastTick = plan.ticks[plan.ticks.length - 1]?.tick ?? 0;
  for (let t = lastTick + 1; t <= MAX_TICKS; t++) {
    met += steady.met;
    kris += steady.kris;
    if (met >= cost.met && kris >= cost.kris) return Math.max(t, depsReady);
  }
  return depsReady;
}

/**
 * Max. Anzahl Units/Recon, die am gegebenen Tick mit Snapshot-Ressourcen
 * (nach bestehenden Plan-Ausgaben) finanzierbar sind.
 */
export function getMaxBuildCountAtTick(
  startCfg: StartConfig,
  kind: "unit" | "recon",
  name: string,
  tick: number,
): number {
  const item = kind === "unit" ? shipByName(name) : reconByName(name);
  if (!item) return 0;
  const cost = item.cost;
  if (cost.met <= 0 && cost.kris <= 0) return 99;

  let plan: PlanResult;
  try {
    plan = calculateFastestWayToGoal(startCfg);
  } catch {
    return 0;
  }

  const snap =
    plan.ticks.find((t) => t.tick === tick) ??
    plan.ticks.filter((t) => t.tick <= tick).at(-1) ??
    null;

  let met = snap?.met ?? plan.finalRes.met;
  let kris = snap?.kris ?? plan.finalRes.kris;

  // If tick is beyond simulation, project income
  if (snap && snap.tick < tick) {
    const steady = estimateSteadyIncome(plan);
    const dt = tick - snap.tick;
    met += steady.met * dt;
    kris += steady.kris * dt;
  } else if (!snap) {
    const steady = estimateSteadyIncome(plan);
    const last = plan.ticks[plan.ticks.length - 1]?.tick ?? 0;
    const dt = Math.max(0, tick - last);
    met = plan.finalRes.met + steady.met * dt;
    kris = plan.finalRes.kris + steady.kris * dt;
  }

  let count = 0;
  while (met >= cost.met && kris >= cost.kris) {
    met -= cost.met;
    kris -= cost.kris;
    count += 1;
    if (count >= 999) break;
  }
  return count;
}

/**
 * Ressourcen-Snapshot an einem Tick (ggf. projiziert).
 */
export function getResourcesAtTick(
  startCfg: StartConfig,
  tick: number,
): { met: number; kris: number; asteroids: number; extractorsMet: number; extractorsKris: number } {
  let plan: PlanResult;
  try {
    plan = calculateFastestWayToGoal(startCfg);
  } catch {
    return {
      met: startCfg.starting_resources.metall,
      kris: startCfg.starting_resources.kristall,
      asteroids: 0,
      extractorsMet: 0,
      extractorsKris: 0,
    };
  }

  const snap =
    plan.ticks.find((t) => t.tick === tick) ??
    plan.ticks.filter((t) => t.tick <= tick).at(-1);

  if (snap && snap.tick === tick) {
    return {
      met: snap.met,
      kris: snap.kris,
      asteroids: snap.asteroids,
      extractorsMet: snap.extractorsMet,
      extractorsKris: snap.extractorsKris,
    };
  }

  const steady = estimateSteadyIncome(plan);
  const base = snap ?? {
    tick: 0,
    met: plan.finalRes.met,
    kris: plan.finalRes.kris,
    asteroids: plan.asteroids,
    extractorsMet: plan.extractorsMet,
    extractorsKris: plan.extractorsKris,
  };
  const dt = Math.max(0, tick - base.tick);
  return {
    met: base.met + steady.met * dt,
    kris: base.kris + steady.kris * dt,
    asteroids: "asteroids" in base ? base.asteroids : plan.asteroids,
    extractorsMet: "extractorsMet" in base ? base.extractorsMet : plan.extractorsMet,
    extractorsKris: "extractorsKris" in base ? base.extractorsKris : plan.extractorsKris,
  };
}

/**
 * Max. Extraktoren an Tick, ohne Auto-Asteroiden-Kauf.
 * `freeSlots` begrenzt zusätzlich.
 */
export function getMaxExtractorsAtTick(
  startCfg: StartConfig,
  tick: number,
): { max: number; freeSlots: number; asteroids: number; alreadyBuilt: number } {
  const r = getResourcesAtTick(startCfg, tick);
  const alreadyBuilt = r.extractorsMet + r.extractorsKris;
  const slots = r.asteroids * EXTRACTOR_SLOT_PER_ASTEROID;
  const freeSlots = Math.max(0, slots - alreadyBuilt);
  const maxByRes = maxAffordableExtractors({
    met: r.met,
    kris: r.kris,
    alreadyBuilt,
    asteroids: r.asteroids,
    slots,
    allowBuyAsteroids: false,
  });
  return {
    max: Math.min(maxByRes, freeSlots),
    freeSlots,
    asteroids: r.asteroids,
    alreadyBuilt,
  };
}

export function getEarliestExtractorStartTick(startCfg: StartConfig): number {
  let plan: PlanResult;
  try {
    plan = calculateFastestWayToGoal(startCfg);
  } catch {
    return 0;
  }
  const job = plan.steps.find((s) => s.name === "Extraktor");
  return job?.endTick ?? 0;
}

export function getEarliestAsteroidStartTick(startCfg: StartConfig): number {
  let plan: PlanResult;
  try {
    plan = calculateFastestWayToGoal(startCfg);
  } catch {
    return 0;
  }
  const job = plan.steps.find((s) => s.name === "Observatorium");
  return job?.endTick ?? 0;
}

/** @deprecated use calculateFastestWayToGoal */
export const planFastestToGoal = calculateFastestWayToGoal;
