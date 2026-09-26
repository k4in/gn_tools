import type { TechTreeEntry } from "@/gn-data/techtree";
import {
  byName,
  calculateFastestWayToGoal,
  maxTicksOf,
  newPlanEntryId,
  unitByName,
  type PlanEntry,
  type PlanResult,
  type StartConfig,
} from "@/lib/calculateFastestWayToGoal";

/**
 * Techtree rückwärts einplanen: Für Schiffe und Geschütze zu einem gewünschten
 * Start-Tick werden alle fehlenden Voraussetzungen so spät wie möglich
 * eingeplant, damit sie genau rechtzeitig fertig sind.
 *
 * Verfügbar erst, wenn die Raumstation samt ihren Voraussetzungen im Plan
 * steht. Dann enthält keine Kette Einkommensgebäude oder sich ausschließende
 * Forschungen, es geht nur noch um Militär-Techs.
 *
 * Regeln:
 * - Techs, die schon im Plan stehen, bleiben unverändert. Ihr Fertig-Tick aus
 *   der Simulation ist eine feste Randbedingung.
 * - Eine Voraussetzung muss fertig sein, wenn der früheste Eintrag startet, der
 *   sie braucht. Fertigstellungen eines Ticks zählen vor neuen Starts, die Kette
 *   ist also lückenlos.
 * - Reichen die Rohstoffe am spätesten Tick nicht, wird Tick für Tick früher
 *   probiert. Kein bestehender Eintrag darf dadurch später starten.
 * - Frühester erlaubter Tick ist 0.
 *
 * Abgearbeitet wird von hinten nach vorn. Einen Eintrag von Tick X auf X'
 * vorzuziehen ändert an den Rohstoffen ab X nichts, schon platzierte (spätere)
 * Kettenglieder bleiben also gültig. Noch nicht platzierte (frühere) Glieder
 * stehen während der Prüfung vorläufig an ihrem rein zeitlich spätesten Tick im
 * Plan, denn ihre Kosten fallen spätestens dort an.
 */

/** Diese Forschung muss samt Voraussetzungen im Plan stehen. */
export const PREREQUISITES_UNLOCKED_BY = "Raumstation";

export type PrerequisiteTarget = {
  /** Schiff oder Geschütz. */
  name: string;
  count: number;
};

export type ScheduledPrerequisite = {
  name: string;
  type: TechTreeEntry["type"];
  startTick: number;
  endTick: number;
};

export type ExistingPrerequisite = {
  name: string;
  /** Fertig-Tick laut Simulation; null, wenn der Eintrag nie fertig wird. */
  finishTick: number | null;
};

export type PrerequisiteFailure = "time" | "resources" | "existing-late";

export type PrerequisitePlan =
  | {
      status: "ok";
      /** Neu eingeplante Voraussetzungen, zeitlich sortiert. */
      added: ScheduledPrerequisite[];
      /** Direkt benötigte Voraussetzungen, die schon im Plan stehen. */
      existing: ExistingPrerequisite[];
      /** Die neuen Plan-Einträge, bereit zum Einfügen vor dem Ziel. */
      entries: PlanEntry[];
    }
  | {
      status: "failed";
      reason: PrerequisiteFailure;
      detail: string;
      /** Frühester Start-Tick fürs Ziel, an dem die Kette aufgeht; null, wenn keiner gefunden wurde. */
      earliestTick: number | null;
    };

type Failed = Extract<PrerequisitePlan, { status: "failed" }>;
type Ok = Extract<PrerequisitePlan, { status: "ok" }>;

/** Schlüssel des Ziels in den Dependents-Mengen. */
const TARGET = "";
const TARGET_ENTRY_ID = "__prerequisite_target";

type MissingNode = { tech: TechTreeEntry; dependents: Set<string> };

type Graph = {
  map: Map<string, TechTreeEntry>;
  /** Tech-Name → Eintrags-id der Techs im Plan (erster Eintrag je Name, wie in der Simulation). */
  owned: Map<string, string>;
  missing: Map<string, MissingNode>;
  /** Bereits geplante Techs, die das Ziel oder ein neues Kettenglied direkt braucht. */
  existing: Map<string, Set<string>>;
};

function plannedTechs(plan: PlanEntry[]): Map<string, string> {
  const owned = new Map<string, string>();
  for (const e of plan) {
    if (e.kind === "tech" && !owned.has(e.name)) owned.set(e.name, e.id);
  }
  return owned;
}

/** Steht die Raumstation samt allen Voraussetzungen im Plan? */
export function prerequisitesAvailable(plan: PlanEntry[]): boolean {
  const map = byName();
  const owned = plannedTechs(plan);
  const visit = (name: string): boolean =>
    owned.has(name) && (map.get(name)?.dependencies ?? []).every(visit);
  return visit(PREREQUISITES_UNLOCKED_BY);
}

function collectGraph(plan: PlanEntry[], target: PrerequisiteTarget): Graph {
  const map = byName();
  const owned = plannedTechs(plan);
  const missing = new Map<string, MissingNode>();
  const existing = new Map<string, Set<string>>();

  const visit = (name: string, dependent: string) => {
    if (owned.has(name)) {
      const set = existing.get(name) ?? new Set<string>();
      set.add(dependent);
      existing.set(name, set);
      return;
    }
    let node = missing.get(name);
    if (!node) {
      const tech = map.get(name);
      if (!tech) return;
      node = { tech, dependents: new Set() };
      missing.set(name, node);
      for (const dep of tech.dependencies) visit(dep, name);
    }
    node.dependents.add(dependent);
  };
  for (const dep of unitByName(target.name)?.dependencies ?? []) visit(dep, TARGET);

  return { map, owned, missing, existing };
}

function simulate(cfg: StartConfig, plan: PlanEntry[]): PlanResult | null {
  try {
    return calculateFastestWayToGoal({ ...cfg, plan });
  } catch {
    return null;
  }
}

function failed(reason: PrerequisiteFailure, detail: string): Failed {
  return { status: "failed", reason, detail, earliestTick: null };
}

/**
 * Schneller Vorfilter für die Platzierung: Startet eine Tech bei Tick t, sinkt
 * jeder Kontostand ab t um ihre Kosten. Ist der niedrigste Kontostand ab t
 * kleiner als die Kosten, würde ein anderer Eintrag verdrängt, die Simulation
 * kann man sich sparen. Gerechnet ohne das Ziel, das sich verschieben darf.
 */
function affordabilityFilter(
  cfg: StartConfig,
  plan: PlanEntry[],
  tech: TechTreeEntry,
  latest: number,
): (tick: number) => boolean {
  if (latest < 0) return () => true;
  const result = simulate(cfg, plan);
  if (!result) return () => true;
  const snaps = [...result.ticks].sort((a, b) => a.tick - b.tick);
  // Niedrigster Kontostand ab Tick t, für t = 0 … latest.
  const minMet = new Array<number>(latest + 1).fill(Infinity);
  const minKris = new Array<number>(latest + 1).fill(Infinity);
  let met = Infinity;
  let kris = Infinity;
  let i = snaps.length - 1;
  for (let t = Math.max(latest, snaps.at(-1)?.tick ?? 0); t >= 0; t--) {
    while (i >= 0 && snaps[i].tick >= t) {
      met = Math.min(met, snaps[i].met);
      kris = Math.min(kris, snaps[i].kris);
      i--;
    }
    if (t <= latest) {
      minMet[t] = met;
      minKris[t] = kris;
    }
  }
  return (tick) => minMet[tick] >= tech.cost.met && minKris[tick] >= tech.cost.kris;
}

/** Plant die fehlenden Voraussetzungen rückwärts ab dem Ziel-Tick. */
function scheduleBackward(
  cfg: StartConfig,
  target: PrerequisiteTarget,
  startTick: number,
  graph: Graph,
): Ok | Failed {
  const goal: PlanEntry = {
    id: TARGET_ENTRY_ID,
    kind: "unit",
    name: target.name,
    startTick,
    count: Math.max(1, target.count),
  };
  const baseline = simulate(cfg, [...cfg.plan, goal]);
  const baseStart = baseline?.entryActualStart ?? {};
  const existingFinish = (name: string): number | null => {
    const id = graph.owned.get(name);
    return (id !== undefined ? baseline?.entryFinishTicks[id] : undefined) ?? null;
  };

  // Bestehende Voraussetzungen des Ziels sind fest und müssen rechtzeitig fertig sein.
  for (const [name, dependents] of graph.existing) {
    if (!dependents.has(TARGET)) continue;
    const finish = existingFinish(name);
    if (finish === null || finish > startTick) {
      return failed(
        "existing-late",
        finish === null
          ? `${name} steht im Plan, wird aber nie fertig.`
          : `${name} steht im Plan und ist erst bei Tick ${finish} fertig.`,
      );
    }
  }

  const placed = new Map<string, PlanEntry & { kind: "tech" }>();

  /** Rein zeitlich: frühester Start je Glied (ab Tick 0 bzw. nach bestehenden Voraussetzungen). */
  const earliestStartOf = new Map<string, number>();
  const earliestStart = (name: string): number => {
    const cached = earliestStartOf.get(name);
    if (cached !== undefined) return cached;
    const tech = graph.missing.get(name)!.tech;
    const start = Math.max(
      0,
      ...tech.dependencies.map((dep) =>
        graph.missing.has(dep)
          ? earliestStart(dep) + graph.missing.get(dep)!.tech.ticks
          : (existingFinish(dep) ?? Infinity),
      ),
    );
    earliestStartOf.set(name, start);
    return start;
  };

  /** Rein zeitlich: spätester Start je Glied, gemessen an platzierten Gliedern und dem Ziel. */
  const latestStart = (name: string, memo = new Map<string, number>()): number => {
    const done = placed.get(name);
    if (done) return done.startTick;
    const cached = memo.get(name);
    if (cached !== undefined) return cached;
    const node = graph.missing.get(name)!;
    const deadline = Math.min(
      ...[...node.dependents].map((d) => (d === TARGET ? startTick : latestStart(d, memo))),
    );
    const start = deadline - node.tech.ticks;
    memo.set(name, start);
    return start;
  };

  // Vorab nur Bauzeiten prüfen: Passt die Kette schon zeitlich nicht, gleich mit dem richtigen Grund abbrechen.
  const memo = new Map<string, number>();
  for (const [name, node] of graph.missing) {
    const latest = latestStart(name, memo);
    if (latest >= earliestStart(name)) continue;
    const lateDep = node.tech.dependencies.find(
      (dep) => !graph.missing.has(dep) && (existingFinish(dep) ?? Infinity) > latest,
    );
    if (lateDep) {
      const finish = existingFinish(lateDep);
      return failed(
        "existing-late",
        finish === null
          ? `${name} braucht ${lateDep}, das steht im Plan, wird aber nie fertig.`
          : `${name} bräuchte ${lateDep} bis Tick ${latest}, das steht im Plan aber erst bei Tick ${finish} fertig.`,
      );
    }
    if (latest < 0) return failed("time", `${name} müsste schon bei Tick ${latest} starten.`);
  }

  /** Vorläufige Einträge für noch nicht platzierte Glieder (siehe Kommentar oben). */
  const provisionalEntries = (exclude: string): PlanEntry[] => {
    const memo = new Map<string, number>();
    const entries: PlanEntry[] = [];
    for (const name of graph.missing.keys()) {
      if (placed.has(name) || name === exclude) continue;
      const start = Math.max(earliestStart(name), latestStart(name, memo));
      entries.push({ id: `__provisional_${name}`, kind: "tech", name, startTick: start });
    }
    return entries;
  };

  while (placed.size < graph.missing.size) {
    // Bereit ist ein Glied, dessen Dependents alle platziert sind; das späteste zuerst.
    let next: { node: MissingNode; latest: number } | null = null;
    for (const node of graph.missing.values()) {
      if (placed.has(node.tech.name)) continue;
      if (![...node.dependents].every((d) => d === TARGET || placed.has(d))) continue;
      const latest = latestStart(node.tech.name);
      if (!next || latest > next.latest) next = { node, latest };
    }
    if (!next) return failed("time", "Zyklus im Techtree.");

    const { node, latest } = next;
    const name = node.tech.name;
    const lowerBound = earliestStart(name);

    const entry: PlanEntry & { kind: "tech" } = {
      id: newPlanEntryId("tech"),
      kind: "tech",
      name,
      startTick: latest,
    };
    const provisional = provisionalEntries(name);
    const affordable = affordabilityFilter(
      cfg,
      [...cfg.plan, ...provisional, ...placed.values()],
      node.tech,
      latest,
    );
    let found = false;
    for (let t = latest; t >= lowerBound; t--) {
      if (!affordable(t)) continue;
      entry.startTick = t;
      const chain = [...provisional, ...placed.values(), entry].sort((a, b) => a.startTick - b.startTick);
      const result = simulate(cfg, [...cfg.plan, ...chain, goal]);
      if (!result) continue;
      const starts = result.entryActualStart;
      if (starts[entry.id] !== t) continue;
      if (![...placed.values()].every((p) => starts[p.id] === p.startTick)) continue;
      // Bestehende Einträge dürfen nicht später starten als ohne die Kette.
      const undisturbed = cfg.plan.every(
        (e) => baseStart[e.id] === undefined || (starts[e.id] ?? Infinity) <= baseStart[e.id],
      );
      if (!undisturbed) continue;
      found = true;
      break;
    }
    if (!found) {
      return failed(
        "resources",
        `Für ${name} reichen die Rohstoffe zwischen Tick ${lowerBound} und ${latest} nicht, ohne andere Einträge zu verschieben.`,
      );
    }
    placed.set(name, entry);
  }

  const entries = [...placed.values()].sort((a, b) => a.startTick - b.startTick);
  return {
    status: "ok",
    entries,
    added: entries.map((e) => {
      const tech = graph.map.get(e.name)!;
      return { name: e.name, type: tech.type, startTick: e.startTick, endTick: e.startTick + tech.ticks };
    }),
    existing: [...graph.existing.keys()].map((name) => ({ name, finishTick: existingFinish(name) })),
  };
}

/**
 * Untergrenze für den Ziel-Tick nur aus Bauzeiten: jedes Glied frühestens nach
 * seinen Voraussetzungen, ab Tick 0 bzw. dem Fertig-Tick bestehender Techs.
 */
function timeLowerBound(cfg: StartConfig, target: PrerequisiteTarget, graph: Graph): number {
  const finishOf = new Map<string, number>();
  const baseline = simulate(cfg, cfg.plan);
  const earliestFinish = (name: string): number => {
    const cached = finishOf.get(name);
    if (cached !== undefined) return cached;
    const id = graph.owned.get(name);
    let finish: number;
    if (id !== undefined) finish = baseline?.entryFinishTicks[id] ?? 0;
    else {
      const tech = graph.map.get(name)!;
      finish = Math.max(0, ...tech.dependencies.map(earliestFinish)) + tech.ticks;
    }
    finishOf.set(name, finish);
    return finish;
  };
  return Math.max(0, ...(unitByName(target.name)?.dependencies ?? []).map(earliestFinish));
}

/** Kleinster Ziel-Tick nach `startTick`, an dem die Kette aufgeht (Suche verdoppelnd, dann binär). */
function findEarliestTick(
  cfg: StartConfig,
  target: PrerequisiteTarget,
  startTick: number,
  graph: Graph,
): number | null {
  const limit = maxTicksOf(cfg);
  const feasible = (tick: number) => scheduleBackward(cfg, target, tick, graph).status === "ok";

  let lo = startTick;
  let hi = Math.max(startTick + 1, timeLowerBound(cfg, target, graph));
  let step = 1;
  while (!feasible(hi)) {
    if (hi >= limit) return null;
    lo = hi;
    hi = Math.min(limit, hi + step);
    step *= 2;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (feasible(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Namen der fehlenden Voraussetzungen, ohne etwas einzuplanen (günstig, ohne Simulation). */
export function missingPrerequisiteNames(plan: PlanEntry[], target: PrerequisiteTarget): string[] {
  return [...collectGraph(plan, target).missing.keys()];
}

/**
 * Plant die fehlenden Voraussetzungen für ein Schiff oder Geschütz rückwärts
 * ein. `cfg.plan` darf das Ziel selbst nicht enthalten (beim Bearbeiten vorher
 * herausnehmen).
 */
export function planPrerequisites(
  cfg: StartConfig,
  target: PrerequisiteTarget,
  startTick: number,
): PrerequisitePlan {
  const graph = collectGraph(cfg.plan, target);
  const tick = Math.max(0, startTick);
  const result = scheduleBackward(cfg, target, tick, graph);
  if (result.status === "ok") return result;
  return { ...result, earliestTick: findEarliestTick(cfg, target, tick, graph) };
}
