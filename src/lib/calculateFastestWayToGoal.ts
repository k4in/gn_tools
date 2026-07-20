import techtreeData from "@/gn-data/techtree.json";
import type { TechTreeEntry } from "@/types/gn";

const techtree = techtreeData as TechTreeEntry[];

export const TICK_MINUTES = 15;
const MAX_TICKS = 5000;
const ASTEROID_COST_KRIS = 10_000;
const EXTRACTOR_SLOT_PER_ASTEROID = 20;
const EXTRACTOR_INCOME = 50;
const EXTRACTOR_COST_STEP = 65; // n-ter Extraktor kostet n * 65 Metall

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

export type EconomyOrder =
  | { id: string; kind: "asteroids"; count: number; atTick: number }
  | { id: string; kind: "extractors"; count: number; resource: "met" | "kris"; atTick: number };

export type StartConfig = {
  start_time: string;
  start_date: string;
  starting_resources: { metall: number; kristall: number };
  /** Sequenzielle Tech-Meilensteine (Gebäude & Forschung). */
  plan: string[];
  /** Geplante Economy-Aktionen (Asteroiden/Extraktoren) mit Ziel-Tick. */
  economyOrders?: EconomyOrder[];
};

export type Res = { met: number; kris: number };

export type JobKind = TechTreeEntry["type"] | "economy";

export type Job = {
  name: string;
  type: JobKind;
  startTick: number;
  endTick: number;
  cost: Res;
};

export type NamedJob = {
  name: string;
  type: JobKind;
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
};

export type PlanStepKind = "tech" | "extractors";

export type ParsedPlanStep =
  | { kind: "tech"; name: string; raw: string }
  | { kind: "extractors"; count: number; resource: "met" | "kris"; raw: string };

export type PlanResult = {
  /** Letzter Plan-Schritt (Anzeige-Ziel). */
  goal: string;
  finishTick: number;
  steps: Job[];
  ticks: TickSnapshot[];
  /** Alle Tech-Namen, die für den Plan benötigt werden (inkl. Dependencies). */
  targetSet: string[];
  /** Tech-Namen auf dem kritischen Pfad zum letzten Tech-Ziel. */
  critical: Set<string>;
  peakWaitTicks: number;
  finalRes: Res;
  start: StartConfig;
  asteroids: number;
  extractorsMet: number;
  extractorsKris: number;
  /** Geparste Plan-Schritte in Reihenfolge. */
  planSteps: ParsedPlanStep[];
  /** Tick, an dem jeder Plan-Schritt erreicht wurde. */
  stepFinishTicks: number[];
  /** Erfüllte Economy-Orders (id → Tick der vollständigen Erfüllung). */
  economyOrderFinishTicks: Record<string, number>;
};

export function byName(entries: TechTreeEntry[] = techtree) {
  return new Map(entries.map((e) => [e.name, e]));
}

export function getTechtree(): TechTreeEntry[] {
  return techtree;
}

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

function expandWithDeps(names: Iterable<string>, map: Map<string, TechTreeEntry>) {
  const set = new Set<string>();
  const visit = (name: string) => {
    if (set.has(name)) return;
    const entry = map.get(name);
    if (!entry) throw new Error(`Unbekannte Technologie: ${name}`);
    set.add(name);
    for (const dep of entry.dependencies) visit(dep);
  };
  for (const n of names) visit(n);
  return set;
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
    current = entry.dependencies.reduce((best: string, d: string) =>
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

/** Lokale Start-DateTime aus plan.json (ohne TZ-Drift durch ISO-Parse). */
function startDateTime(startCfg: StartConfig): Date {
  const [y, mo, d] = startCfg.start_date.split("-").map(Number);
  const [h, m] = startCfg.start_time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

/**
 * Verstrichene Ticks seit Planstart: floor((now − start) / 15min).
 * Beispiel: Start 18:00, jetzt 20:10 → 130min → Tick 8 ("nach Tick 8").
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
  return index1Based * EXTRACTOR_COST_STEP;
}

/** Gesamtkosten der ersten n Extraktoren (65+130+…+n*65). */
export function totalExtractorCost(count: number): number {
  if (count <= 0) return 0;
  return (EXTRACTOR_COST_STEP * count * (count + 1)) / 2;
}

export function formatExtractorPlanStep(count: number, resource: "met" | "kris"): string {
  const label = resource === "met" ? "Metallextraktoren" : "Kristallextraktoren";
  return `${count} ${label}`;
}

export function formatEconomyOrderLabel(order: EconomyOrder): string {
  if (order.kind === "asteroids") {
    return order.count === 1
      ? `1 Asteroid scannen @t${order.atTick}`
      : `${order.count} Asteroiden scannen @t${order.atTick}`;
  }
  const base =
    order.resource === "met"
      ? order.count === 1
        ? "1 Metallextraktor"
        : `${order.count} Metallextraktoren`
      : order.count === 1
        ? "1 Kristallextraktor"
        : `${order.count} Kristallextraktoren`;
  return `${base} @t${order.atTick}`;
}

/** Erkennung von Extraktor-Plan-Schritten (Legacy / UI). */
export function isExtractorPlanEntry(raw: string): boolean {
  return /^\d+\s*(?:x\s*)?(?:metall|metal|kristall|kris|met)?[\s-]*(?:extraktoren|extractor|extractors)?s?$/i.test(
    raw.trim(),
  ) || /^\d+\s*(?:metall|metal|kristall|kris)?extraktoren?$/i.test(raw.trim());
}

export function newEconomyOrderId(): string {
  return `eco_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Max. Extraktoren, die mit aktuellem Metall + Kristall (Asteroiden) finanzierbar sind,
 * ausgehend von bereits gebauten totalBuilt Extraktoren und vorhandenen Slots/Asteroiden.
 * Kauft optional Asteroiden (10k Kris / 20 Slots), solange Kristall reicht.
 */
export function maxAffordableExtractors(opts: {
  met: number;
  kris: number;
  /** bereits gebaute Extraktoren gesamt (Kostenindex). */
  alreadyBuilt?: number;
  asteroids?: number;
  slots?: number;
  maxAsteroids?: number;
}): number {
  let met = opts.met;
  let kris = opts.kris;
  let built = opts.alreadyBuilt ?? 0;
  let asteroids = opts.asteroids ?? 0;
  let slots = opts.slots ?? asteroids * EXTRACTOR_SLOT_PER_ASTEROID;
  const maxAsteroids = opts.maxAsteroids ?? 50;

  let canBuild = 0;
  while (true) {
    while (built + canBuild >= slots && asteroids < maxAsteroids && kris >= ASTEROID_COST_KRIS) {
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
    met: extractorsMet * EXTRACTOR_INCOME,
    kris: extractorsKris * EXTRACTOR_INCOME,
  };
}

/**
 * Plan-Schritte parsen.
 * - Tech-Namen aus dem Techtree (exakt)
 * - "30 Metallextraktoren" / "10 Kristallextraktoren" / "15 Extraktoren" (Metall default)
 */
export function parsePlanStep(raw: string, map: Map<string, TechTreeEntry>): ParsedPlanStep {
  const trimmed = raw.trim();
  if (map.has(trimmed)) {
    return { kind: "tech", name: trimmed, raw: trimmed };
  }

  // "30 Metallextraktoren", "30 Metall-Extraktoren", "30 metall extraktoren"
  const re =
    /^(\d+)\s*(?:x\s*)?(metall|metal|kristall|kris|met)?[\s-]*(extraktoren|extractor|extractors)?s?$/i;
  const m = trimmed.match(re);
  if (m && (m[2] || m[3])) {
    const count = Number(m[1]);
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error(`Ungültige Extraktor-Anzahl: ${raw}`);
    }
    const kind = (m[2] ?? "metall").toLowerCase();
    const resource: "met" | "kris" =
      kind.startsWith("kris") || kind.startsWith("kristall") ? "kris" : "met";
    return { kind: "extractors", count, resource, raw: trimmed };
  }

  // freiere Variante: "30 Metallextraktoren" ohne Leerzeichen zwischen Zahl und Wort
  const re2 = /^(\d+)\s*(metall|metal|kristall|kris)?extraktoren?$/i;
  const m2 = trimmed.match(re2);
  if (m2) {
    const count = Number(m2[1]);
    const kind = (m2[2] ?? "metall").toLowerCase();
    const resource: "met" | "kris" =
      kind.startsWith("kris") || kind.startsWith("kristall") ? "kris" : "met";
    return { kind: "extractors", count, resource, raw: trimmed };
  }

  // Tippfehler-Korrekturen für bekannte Tech-Namen
  const aliases: Record<string, string> = {
    Extraktoren: "Extraktor",
    "Automatischce Metallmine": "Vollautomatisierte Metallmine",
    "Automatische Metallmine": "Vollautomatisierte Metallmine",
    "Automatische Kristallmine": "Vollautomatisierte Kristallmine",
    "Automatischce Kristallmine": "Vollautomatisierte Kristallmine",
  };
  if (aliases[trimmed] && map.has(aliases[trimmed])) {
    return { kind: "tech", name: aliases[trimmed], raw: trimmed };
  }

  throw new Error(
    `Unbekannter Plan-Schritt "${raw}". Erwarte Tech-Namen oder z.B. "30 Metallextraktoren".`,
  );
}

export function parsePlan(plan: string[], map: Map<string, TechTreeEntry>): ParsedPlanStep[] {
  if (!plan.length) throw new Error("plan[] ist leer");
  return plan.map((s) => parsePlanStep(s, map));
}

/**
 * Plan-getriebene Simulation:
 * - plan[] definiert WAS und in welcher Reihenfolge Meilensteine freigegeben werden
 * - Regel: so früh wie möglich, aber nicht früher als im Plan
 *   → Plan-Schritt i wird freigegeben, sobald Schritt i-1 gestartet (oder erledigt) ist
 *   → im selben Tick kann die Freigabe kaskadieren (Bergbau+Raumfahrt parallel)
 * - Dependencies eines freigegebenen Schritts dürfen mitlaufen
 * - Explizite spätere Plan-Einträge warten auf ihre Plan-Position
 * - Extraktor-Schritte: Asteroiden + Extraktoren bis Soll-Anzahl
 */
function simulatePlan(
  planSteps: ParsedPlanStep[],
  map: Map<string, TechTreeEntry>,
  startCfg: StartConfig,
  critical: Set<string>,
): Omit<PlanResult, "start" | "critical" | "planSteps"> {
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
  const stepFinishTicks: number[] = new Array(planSteps.length).fill(-1);
  /** Plan-Schritt wurde angestoßen (Job gestartet / Economy begonnen) oder ist erledigt. */
  const stepStarted = new Array(planSteps.length).fill(false);
  let stepIndex = 0;

  const economyOrders: EconomyOrder[] = [...(startCfg.economyOrders ?? [])].sort(
    (a, b) => a.atTick - b.atTick || a.id.localeCompare(b.id),
  );
  /** Fortschritt je Economy-Order (bereits erledigte Menge). */
  const economyProgress = new Map<string, number>();
  const economyOrderFinishTicks: Record<string, number> = {};
  for (const o of economyOrders) economyProgress.set(o.id, 0);

  const allTechTargets = expandWithDeps(
    planSteps.filter((s): s is Extract<ParsedPlanStep, { kind: "tech" }> => s.kind === "tech").map(
      (s) => s.name,
    ),
    map,
  );

  // Extraktor-Tech ist nötig, wenn der Plan Extraktoren baut oder Economy-Orders Extraktoren fordern
  if (
    planSteps.some((s) => s.kind === "extractors") ||
    economyOrders.some((o) => o.kind === "extractors")
  ) {
    for (const n of requiredClosure("Extraktor", map)) allTechTargets.add(n);
  }
  if (economyOrders.some((o) => o.kind === "asteroids")) {
    for (const n of requiredClosure("Observatorium", map)) allTechTargets.add(n);
  }

  /** Techs, die ein Plan-Schritt braucht (Ziel + transitive Deps). */
  const neededByStep: Set<string>[] = planSteps.map((step) =>
    step.kind === "tech"
      ? requiredClosure(step.name, map)
      : requiredClosure("Extraktor", map),
  );

  /** Explizite Plan-Indizes je Tech-Name (direkte Meilensteine). */
  const explicitPlanIndices = new Map<string, number[]>();
  planSteps.forEach((step, idx) => {
    if (step.kind !== "tech") return;
    const list = explicitPlanIndices.get(step.name) ?? [];
    list.push(idx);
    explicitPlanIndices.set(step.name, list);
  });

  /**
   * Frühester Plan-Index, ab dem diese Tech starten darf:
   * Minimum über alle Schritte, die sie brauchen (als Ziel oder Dep).
   * → expliziter Meilenstein an Pos. 11 wartet auf Pos. 11
   * → reine Dep eines frühen Schritts darf mit diesem frühen Schritt laufen
   * → erscheint sie später nochmal explizit, blockiert das die frühere Dep-Nutzung nicht
   */
  const earliestAllowedIndex = new Map<string, number>();
  for (const name of allTechTargets) {
    let min = Infinity;
    neededByStep.forEach((needed, idx) => {
      if (needed.has(name)) min = Math.min(min, idx);
    });
    if (min !== Infinity) earliestAllowedIndex.set(name, min);
  }

  const inProgress = () => new Set(active.map((j) => j.name));

  const isReady = (name: string) => {
    const e = map.get(name)!;
    return e.dependencies.every((d) => completed.has(d));
  };

  const totalExtractors = () => extractorsMet + extractorsKris;

  const techDone = (name: string) => completed.has(name);

  const stepSatisfied = (step: ParsedPlanStep): boolean => {
    if (step.kind === "tech") return techDone(step.name);
    if (step.resource === "met") return extractorsMet >= step.count;
    return extractorsKris >= step.count;
  };

  const isStepReleased = (idx: number): boolean => {
    if (idx <= 0) return true;
    // Vorheriger Schritt muss angestoßen oder fertig sein (Kaskade im selben Tick möglich)
    return stepStarted[idx - 1] || stepSatisfied(planSteps[idx - 1]);
  };

  const markStepStarted = (idx: number) => {
    if (idx < 0 || idx >= stepStarted.length) return;
    stepStarted[idx] = true;
  };

  const syncStartedFlags = () => {
    planSteps.forEach((step, idx) => {
      if (stepSatisfied(step)) markStepStarted(idx);
      else if (step.kind === "tech") {
        if (completed.has(step.name) || active.some((j) => j.name === step.name)) {
          markStepStarted(idx);
        }
      } else {
        // Extraktor-Schritt: gestartet sobald Extraktor-Tech läuft/fertig oder schon Extraktoren stehen
        if (
          completed.has("Extraktor") ||
          active.some((j) => j.name === "Extraktor") ||
          extractorsMet > 0 ||
          extractorsKris > 0 ||
          asteroids > 0
        ) {
          // nur wenn der Schritt selbst freigegeben ist — Flags setzen wir beim Economy-Start explizit
        }
      }
    });
  };

  /** Darf diese Tech jetzt laut Plan-Position gestartet werden? */
  const isPlanAllowed = (name: string): boolean => {
    const idx = earliestAllowedIndex.get(name);
    if (idx === undefined) return false;
    return isStepReleased(idx);
  };

  /**
   * Score: frühere Plan-Position zuerst, dann kritischer Pfad, dann kürzere Jobs.
   */
  const score = (name: string) => {
    const e = map.get(name)!;
    const prio = earliestAllowedIndex.get(name) ?? 9999;
    const onCrit = critical.has(name) ? 1 : 0;
    return -prio * 1e9 + onCrit * 1e6 - e.ticks + e.cost.met * 1e-9;
  };

  /** Legacy: Extraktor-Ziele nur aus freigegebenen Plan-Schritten. */
  const legacyExtractorTargets = () => {
    let met = 0;
    let kris = 0;
    planSteps.forEach((step, idx) => {
      if (step.kind !== "extractors") return;
      if (!isStepReleased(idx)) return;
      if (step.resource === "met") met = Math.max(met, step.count);
      else kris = Math.max(kris, step.count);
    });
    return { met, kris };
  };

  const orderRemaining = (order: EconomyOrder) =>
    Math.max(0, order.count - (economyProgress.get(order.id) ?? 0));

  const markEconomyProgress = (order: EconomyOrder, amount: number, tick: number) => {
    if (amount <= 0) return;
    const next = (economyProgress.get(order.id) ?? 0) + amount;
    economyProgress.set(order.id, next);
    if (next >= order.count && economyOrderFinishTicks[order.id] === undefined) {
      economyOrderFinishTicks[order.id] = tick;
    }
  };

  const allEconomyDone = () =>
    economyOrders.every((o) => (economyProgress.get(o.id) ?? 0) >= o.count);

  const tryEconomyActions = (tick: number) => {
    const startedJobs: NamedJob[] = [];
    const finishedJobs: NamedJob[] = [];
    let spent: Res = { met: 0, kris: 0 };

    const busy = inProgress();
    const reservedForTech = (): Res => {
      const readyTechs = [...allTechTargets]
        .filter((n) => !completed.has(n) && !busy.has(n) && isReady(n) && isPlanAllowed(n))
        .sort((a, b) => score(b) - score(a));
      if (!readyTechs.length) return { met: 0, kris: 0 };
      const c = map.get(readyTechs[0])!.cost;
      return { met: c.met, kris: c.kris };
    };
    const reserve = reservedForTech();

    // 1) Explizite Economy-Orders ab ihrem atTick
    for (const order of economyOrders) {
      if (tick < order.atTick) continue;
      let remaining = orderRemaining(order);
      if (remaining <= 0) continue;

      if (order.kind === "asteroids") {
        if (!completed.has("Observatorium")) continue;
        let bought = 0;
        while (
          remaining > 0 &&
          res.kris - ASTEROID_COST_KRIS >= reserve.kris &&
          canAfford(res, { met: 0, kris: ASTEROID_COST_KRIS })
        ) {
          const cost = { met: 0, kris: ASTEROID_COST_KRIS };
          res = pay(res, cost);
          spent = addRes(spent, cost);
          asteroids += 1;
          extractorSlots += EXTRACTOR_SLOT_PER_ASTEROID;
          bought += 1;
          remaining -= 1;
          const name = `Asteroid scannen #${asteroids}`;
          const job: Job = { name, type: "economy", startTick: tick, endTick: tick, cost };
          steps.push(job);
          startedJobs.push({ name, type: "economy" });
          finishedJobs.push({ name, type: "economy" });
        }
        markEconomyProgress(order, bought, tick);
        continue;
      }

      // extractors
      if (!completed.has("Extraktor")) continue;
      let built = 0;
      while (remaining > 0 && totalExtractors() < extractorSlots) {
        const nextIndex = totalExtractors() + 1;
        const cost = { met: extractorUnitCost(nextIndex), kris: 0 };
        if (res.met - cost.met < reserve.met) break;
        if (!canAfford(res, cost)) break;
        res = pay(res, cost);
        spent = addRes(spent, cost);
        if (order.resource === "met") extractorsMet += 1;
        else extractorsKris += 1;
        built += 1;
        remaining -= 1;
        const label =
          order.resource === "met"
            ? `Extraktor (Metall) #${extractorsMet}`
            : `Extraktor (Kristall) #${extractorsKris}`;
        const job: Job = {
          name: label,
          type: "economy",
          startTick: tick,
          endTick: tick,
          cost,
        };
        steps.push(job);
        startedJobs.push({ name: label, type: "economy" });
        finishedJobs.push({ name: label, type: "economy" });
      }
      markEconomyProgress(order, built, tick);
    }

    // 2) Legacy: Plan-Schritte "30 Metallextraktoren" (kumulativ, inkl. Auto-Asteroiden)
    const targets = legacyExtractorTargets();
    const needMet = Math.max(0, targets.met - extractorsMet);
    const needKris = Math.max(0, targets.kris - extractorsKris);
    const stillNeedTotal = needMet + needKris;
    if (stillNeedTotal > 0) {
      planSteps.forEach((step, idx) => {
        if (step.kind === "extractors" && isStepReleased(idx)) markStepStarted(idx);
      });

      while (
        completed.has("Observatorium") &&
        stillNeedTotal > 0 &&
        extractorSlots < totalExtractors() + stillNeedTotal &&
        res.kris - ASTEROID_COST_KRIS >= reserve.kris &&
        canAfford(res, { met: 0, kris: ASTEROID_COST_KRIS })
      ) {
        if (!completed.has("Extraktor")) {
          const needKrisTech = map.get("Extraktor")!.cost.kris;
          if (res.kris - ASTEROID_COST_KRIS < Math.max(needKrisTech, reserve.kris)) break;
        }
        const cost = { met: 0, kris: ASTEROID_COST_KRIS };
        res = pay(res, cost);
        spent = addRes(spent, cost);
        asteroids += 1;
        extractorSlots += EXTRACTOR_SLOT_PER_ASTEROID;
        const name = `Asteroid scannen #${asteroids}`;
        const job: Job = { name, type: "economy", startTick: tick, endTick: tick, cost };
        steps.push(job);
        startedJobs.push({ name, type: "economy" });
        finishedJobs.push({ name, type: "economy" });
      }

      if (completed.has("Extraktor")) {
        const buildOne = (resource: "met" | "kris") => {
          const nextIndex = totalExtractors() + 1;
          const cost = { met: extractorUnitCost(nextIndex), kris: 0 };
          if (totalExtractors() >= extractorSlots) return false;
          if (res.met - cost.met < reserve.met) return false;
          if (!canAfford(res, cost)) return false;
          res = pay(res, cost);
          spent = addRes(spent, cost);
          if (resource === "met") extractorsMet += 1;
          else extractorsKris += 1;
          const label =
            resource === "met"
              ? `Extraktor (Metall) #${extractorsMet}`
              : `Extraktor (Kristall) #${extractorsKris}`;
          const job: Job = {
            name: label,
            type: "economy",
            startTick: tick,
            endTick: tick,
            cost,
          };
          steps.push(job);
          startedJobs.push({ name: label, type: "economy" });
          finishedJobs.push({ name: label, type: "economy" });
          return true;
        };
        while (extractorsMet < targets.met && buildOne("met")) {
          /* batch */
        }
        while (extractorsKris < targets.kris && buildOne("kris")) {
          /* batch */
        }
      }
    }

    return { startedJobs, finishedJobs, spent };
  };

  const tryStartTechs = (tick: number) => {
    const startedJobs: NamedJob[] = [];
    let spent: Res = { met: 0, kris: 0 };

    // Mehrfach im Tick: nach jedem Start können weitere Plan-Schritte freigegeben werden.
    while (true) {
      syncStartedFlags();
      const busy = inProgress();
      const candidates = [...allTechTargets]
        .filter((n) => !completed.has(n))
        .filter((n) => !busy.has(n))
        .filter(isReady)
        .filter(isPlanAllowed)
        .filter((n) =>
          canAfford(res, { met: map.get(n)!.cost.met, kris: map.get(n)!.cost.kris }),
        )
        .sort((a, b) => score(b) - score(a));

      const pick = candidates[0];
      if (!pick) break;

      const entry = map.get(pick)!;
      const cost = { met: entry.cost.met, kris: entry.cost.kris };
      res = pay(res, cost);
      spent = addRes(spent, cost);
      const job: Job = {
        name: pick,
        type: entry.type,
        startTick: tick,
        endTick: tick + entry.ticks,
        cost,
      };
      active.push(job);
      steps.push(job);
      startedJobs.push({ name: pick, type: entry.type });

      // Explizite Meilensteine dieses Namens als gestartet markieren → nächste freigeben
      const indices = explicitPlanIndices.get(pick);
      if (indices) for (const idx of indices) markStepStarted(idx);
    }

    return { startedJobs, spent };
  };

  const tryStartAll = (tick: number) => {
    const tech = tryStartTechs(tick);
    const econ = tryEconomyActions(tick);
    return {
      startedJobs: [...tech.startedJobs, ...econ.startedJobs],
      finishedJobs: econ.finishedJobs,
      spent: addRes(tech.spent, econ.spent),
    };
  };

  const markSteps = (tick: number) => {
    while (stepIndex < planSteps.length && stepSatisfied(planSteps[stepIndex])) {
      if (stepFinishTicks[stepIndex] < 0) stepFinishTicks[stepIndex] = tick;
      stepIndex += 1;
    }
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
      }))
      .sort((a, b) => a.remainingTicks - b.remainingTicks || a.name.localeCompare(b.name)),
    started,
    finished,
  });

  const allPlanDone = () => planSteps.every(stepSatisfied) && allEconomyDone();

  const resultAt = (finishTick: number) => ({
    goal: planSteps[planSteps.length - 1]?.raw ?? "Koloniezentrum",
    finishTick,
    steps,
    ticks,
    targetSet: [...allTechTargets].sort(),
    peakWaitTicks,
    finalRes: res,
    asteroids,
    extractorsMet,
    extractorsKris,
    stepFinishTicks,
    economyOrderFinishTicks: { ...economyOrderFinishTicks },
  });

  // t = 0
  {
    const { startedJobs, finishedJobs, spent } = tryStartAll(0);
    markSteps(0);
    ticks.push(
      snapshot(0, startedJobs, finishedJobs, { met: -spent.met, kris: -spent.kris }),
    );
    if (allPlanDone()) {
      return resultAt(0);
    }
  }

  for (let t = 1; t <= MAX_TICKS; t++) {
    const finishing = active.filter((j) => j.endTick === t);
    active = active.filter((j) => j.endTick !== t);
    const finishedJobs: NamedJob[] = [];
    for (const job of finishing) {
      completed.add(job.name);
      completedAt.set(job.name, t);
      finishedJobs.push({ name: job.name, type: job.type });
    }

    const producing = new Set(
      [...completed].filter((n) => (completedAt.get(n) ?? 0) < t),
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

    const { startedJobs, finishedJobs: econFinished, spent } = tryStartAll(t);
    markSteps(t);
    const allFinished = [...finishedJobs, ...econFinished];

    const waiting =
      !allPlanDone() &&
      startedJobs.length === 0 &&
      active.length === 0;

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

    if (allPlanDone()) {
      const finishTick = Math.max(
        0,
        ...stepFinishTicks.filter((x) => x >= 0),
        ...Object.values(economyOrderFinishTicks),
        t,
      );
      return resultAt(finishTick);
    }

    // Deadlock: kein Income, nichts aktiv, nichts startbar
    if (
      active.length === 0 &&
      income.met === 0 &&
      income.kris === 0 &&
      startedJobs.length === 0
    ) {
      const canStartSomething = [...allTechTargets].some(
        (n) =>
          !completed.has(n) &&
          isReady(n) &&
          canAfford(res, { met: map.get(n)!.cost.met, kris: map.get(n)!.cost.kris }),
      );
      const legacy = legacyExtractorTargets();
      const pendingOrders = economyOrders.some((o) => orderRemaining(o) > 0 && t >= o.atTick);
      const canEcon =
        (completed.has("Observatorium") && res.kris >= ASTEROID_COST_KRIS) ||
        (completed.has("Extraktor") &&
          extractorSlots > totalExtractors() &&
          (extractorsMet < legacy.met ||
            extractorsKris < legacy.kris ||
            pendingOrders));
      const remainingTech = [...allTechTargets].some((n) => !completed.has(n));
      const remainingEcon = !allEconomyDone() || legacy.met > extractorsMet || legacy.kris > extractorsKris;
      if (!canStartSomething && !canEcon && (remainingTech || remainingEcon)) {
        throw new Error(
          `Plan nicht erreichbar: keine Produktion und unzureichende Ressourcen bei Tick ${t}`,
        );
      }
    }
  }

  throw new Error(`Plan nicht in ${MAX_TICKS} Ticks abgeschlossen`);
}

/**
 * Berechnet den Zeitplan anhand der vorgegebenen plan[]-Meilensteine.
 * Der User steuert die Strategie über die Reihenfolge in plan.json;
 * hier wird nur noch simuliert, wann Ressourcen reichen und Jobs laufen.
 */
export function calculateFastestWayToGoal(startCfg: StartConfig): PlanResult {
  const map = byName(techtree);
  // Leerer / nur-Start-Plan: Koloniezentrum als Mindestziel
  const rawPlan =
    startCfg.plan.length > 0 ? startCfg.plan : ["Koloniezentrum"];
  const planSteps = parsePlan(rawPlan, map);

  const lastTech = [...planSteps].reverse().find((s) => s.kind === "tech");
  const critical = lastTech ? criticalPathSet(lastTech.name, map) : new Set<string>();

  const sim = simulatePlan(planSteps, map, { ...startCfg, plan: rawPlan }, critical);

  return {
    ...sim,
    critical,
    start: { ...startCfg, plan: rawPlan },
    planSteps,
  };
}

/**
 * Freigeschaltete Technologien: Dependencies sind im bisherigen Plan
 * (inkl. transitiver Deps) enthalten / erreichbar, Tech selbst noch nicht im Plan.
 * Koloniezentrum gilt immer als erledigt, sobald es im Plan steht (Default).
 */
export function getUnlockedTechs(planNames: string[]): TechTreeEntry[] {
  const map = byName();
  const owned = expandWithDeps(
    planNames.filter((n) => map.has(n)),
    map,
  );
  // Root ohne Deps ist freigeschaltet, wenn noch nicht besessen
  return techtree
    .filter((e) => !owned.has(e.name))
    .filter((e) => e.dependencies.every((d) => owned.has(d)))
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

/** @deprecated use calculateFastestWayToGoal */
export const planFastestToGoal = calculateFastestWayToGoal;
