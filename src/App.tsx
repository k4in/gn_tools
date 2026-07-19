import { useEffect, useMemo, useState } from "react";
import techtreeData from "@/gn-data/techtree.json";
import startData from "@/gn-data/start.json";
import type { TechTreeEntry } from "@/types/gn";

const techtree = techtreeData as TechTreeEntry[];
const GOAL = "Extraktor";
const TICK_MINUTES = 15;
const MAX_TICKS = 2500;

type StartConfig = {
  start_time: string;
  start_date: string;
  starting_resources: { metall: number; kristall: number };
};

const start = startData as StartConfig;

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

const MINE_TIERS = [
  ["Kristallmine", "Metallmine"],
  ["Zweite Kristallmine", "Zweite Metallmine"],
  ["Tiefe Kristallminen", "Tiefe Metallminen"],
  ["Vollautomatisierte Kristallmine", "Vollautomatisierte Metallmine"],
] as const;

type Res = { met: number; kris: number };

type Job = {
  name: string;
  type: TechTreeEntry["type"];
  startTick: number;
  endTick: number;
  cost: Res;
};

type NamedJob = {
  name: string;
  type: TechTreeEntry["type"];
};

type ActiveJob = NamedJob & {
  remainingTicks: number;
};

type TickSnapshot = {
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

type PlanResult = {
  goal: string;
  finishTick: number;
  mineTier: number;
  steps: Job[];
  ticks: TickSnapshot[];
  targetSet: string[];
  critical: Set<string>;
  peakWaitTicks: number;
  finalRes: Res;
  start: StartConfig;
};

function byName(entries: TechTreeEntry[]) {
  return new Map(entries.map((e) => [e.name, e]));
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
    const entry = map.get(current)!;
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

/** Buildings that raise income and are not yet completed. */
function incomeGainIfBuilt(name: string, completed: Set<string>): number {
  const inc = INCOME_BY_BUILDING[name];
  if (!inc) return 0;
  const now = incomeFrom(completed);
  const next = incomeFrom(new Set([...completed, name]));
  return next.met - now.met + (next.kris - now.kris);
}

function parseStartMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Lokale Start-DateTime aus start.json (ohne TZ-Drift durch ISO-Parse). */
function startDateTime(startCfg: StartConfig): Date {
  const [y, mo, d] = startCfg.start_date.split("-").map(Number);
  const [h, m] = startCfg.start_time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

/**
 * Verstrichene Ticks seit Planstart: floor((now − start) / 15min).
 * Beispiel: Start 18:00, jetzt 20:10 → 130min → Tick 8 ("nach Tick 8").
 */
function computeCurrentTick(startCfg: StartConfig, now: Date = new Date()): number {
  const start = startDateTime(startCfg);
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (TICK_MINUTES * 60 * 1000));
}

function formatWallClock(date: Date) {
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
function formatTimeUntilTick(
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

function clockLabel(startCfg: StartConfig, tick: number) {
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

function formatRes(n: number) {
  return Math.round(n).toLocaleString("de-DE");
}

function economyExtras(tier: number): string[] {
  const extras: string[] = [];
  for (let i = 0; i < tier; i++) {
    extras.push(...MINE_TIERS[i]);
  }
  return extras;
}

/**
 * Diskrete Tick-Simulation mit unbegrenzter Parallelität.
 *
 * t=0: Spielstart. Jobs können sofort gestartet werden; noch kein Einkommen.
 * Jeder spätere Tick t=1..n:
 *   1) Jobs mit endTick === t abschließen
 *   2) Einkommen aus früher fertigen Gebäuden gutschreiben
 *   3) Alle startbaren Jobs starten (Dependencies + Ressourcen),
 *      solange Kosten gedeckt sind — beliebig viele parallel
 */
function simulate(
  targets: Set<string>,
  map: Map<string, TechTreeEntry>,
  critical: Set<string>,
  goal: string,
  startCfg: StartConfig,
): Omit<PlanResult, "mineTier" | "targetSet" | "critical" | "start"> | null {
  const requiredForGoal = requiredClosure(goal, map);
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

  const inProgress = () => new Set(active.map((j) => j.name));

  const isReady = (name: string) => {
    const e = map.get(name)!;
    return e.dependencies.every((d) => completed.has(d));
  };

  const score = (name: string) => {
    const e = map.get(name)!;
    const onCrit = critical.has(name) ? 1 : 0;
    const forGoal = requiredForGoal.has(name) ? 1 : 0;
    const gain = incomeGainIfBuilt(name, completed);
    return onCrit * 1e9 + forGoal * 1e8 + gain * 1e3 - e.ticks + e.cost.met * 1e-9;
  };

  /** Startet alle Jobs, die jetzt Dependencies + Ressourcen erfüllen. */
  const tryStartAll = (tick: number) => {
    const startedJobs: NamedJob[] = [];
    let spent: Res = { met: 0, kris: 0 };
    // Greedy: wiederholt den besten Kandidaten starten, bis nichts mehr geht
    while (true) {
      const busy = inProgress();
      const candidates = [...targets]
        .filter((n) => !completed.has(n))
        .filter((n) => !busy.has(n))
        .filter(isReady)
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
    }
    return { startedJobs, spent };
  };

  const snapshot = (
    tick: number,
    started: NamedJob[],
    finished: NamedJob[],
    /** Netto-Änderung: Einkommen − in diesem Tick gezahlte Baukosten */
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
        remainingTicks: j.endTick - tick,
      }))
      .sort((a, b) => a.remainingTicks - b.remainingTicks || a.name.localeCompare(b.name)),
    started,
    finished,
  });

  // t = 0
  {
    const { startedJobs, spent } = tryStartAll(0);
    ticks.push(
      snapshot(0, startedJobs, [], { met: -spent.met, kris: -spent.kris }),
    );
  }

  for (let t = 1; t <= MAX_TICKS; t++) {
    // 1) Abschlüsse
    const finishing = active.filter((j) => j.endTick === t);
    active = active.filter((j) => j.endTick !== t);
    const finishedJobs: NamedJob[] = [];
    for (const job of finishing) {
      completed.add(job.name);
      completedAt.set(job.name, t);
      finishedJobs.push({ name: job.name, type: job.type });
    }

    // 2) Einkommen (Gebäude, die vor diesem Tick fertig wurden)
    const producing = new Set(
      [...completed].filter((n) => (completedAt.get(n) ?? 0) < t),
    );
    const income = incomeFrom(producing);
    if (income.met || income.kris) {
      res = addRes(res, income);
    }

    // 3) Neue Jobs starten (beliebig parallel)
    const { startedJobs, spent } = tryStartAll(t);

    const waiting =
      !completed.has(goal) &&
      startedJobs.length === 0 &&
      active.length === 0 &&
      [...targets].some((n) => !completed.has(n));

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
    ticks.push(snapshot(t, startedJobs, finishedJobs, delta));

    if (completed.has(goal)) {
      return {
        goal,
        finishTick: t,
        steps,
        ticks,
        peakWaitTicks,
        finalRes: res,
      };
    }

    // Soft-Lock: nichts aktiv, kein Einkommen, nichts startbar
    if (
      active.length === 0 &&
      income.met === 0 &&
      income.kris === 0 &&
      ![...targets].some(
        (n) =>
          !completed.has(n) &&
          isReady(n) &&
          canAfford(res, { met: map.get(n)!.cost.met, kris: map.get(n)!.cost.kris }),
      )
    ) {
      const remaining = [...targets].filter((n) => !completed.has(n));
      if (remaining.length) return null;
    }
  }

  return null;
}

function planFastestToGoal(goal: string, startCfg: StartConfig): PlanResult {
  const map = byName(techtree);
  if (!map.has(goal)) throw new Error(`Ziel fehlt: ${goal}`);

  const critical = criticalPathSet(goal, map);
  const base = requiredClosure(goal, map);

  let best: PlanResult | null = null;

  for (let tier = 0; tier <= MINE_TIERS.length; tier++) {
    const targets = expandWithDeps([...base, ...economyExtras(tier)], map);
    const sim = simulate(targets, map, critical, goal, startCfg);
    if (!sim) continue;
    const candidate: PlanResult = {
      ...sim,
      mineTier: tier,
      targetSet: [...targets].sort(),
      critical,
      start: startCfg,
    };
    if (!best || candidate.finishTick < best.finishTick) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error("Kein erreichbarer Plan mit den aktuellen Regeln / Startressourcen");
  }
  return best;
}

export default function App() {
  const plan = useMemo(() => planFastestToGoal(GOAL, start), []);

  const maxTick = Math.max(plan.finishTick, 1);
  const actionTicks = useMemo(
    () => plan.ticks.filter((t) => t.started.length > 0),
    [plan.ticks],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentTick = computeCurrentTick(plan.start, now);
  const upcomingActions = useMemo(
    () => actionTicks.filter((t) => t.tick >= currentTick).slice(0, 3),
    [actionTicks, currentTick],
  );
  const nextAction = upcomingActions[0] ?? null;
  const followingActions = upcomingActions.slice(1);

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
        {/* Übersicht */}
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            {/* Links: Status & Ziel */}
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Aktuell
                </p>
                <p className="mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums">
                  {formatWallClock(now)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  {currentTick < 0
                    ? `Start in ${Math.abs(currentTick)} Ticks`
                    : `Tick ${currentTick}`}
                </p>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Ziel
                </p>
                <p className="mt-1 text-lg font-semibold">{GOAL}</p>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  Tick {plan.finishTick} · {clockLabel(plan.start, plan.finishTick)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {formatTimeUntilTick(plan.start, plan.finishTick, now)}
                </p>
              </div>
            </div>

            {/* Rechts: Nächste Aktionen */}
            <div className="space-y-3 md:border-l md:border-border md:pl-8">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Nächste Aktion
              </p>
              {nextAction ? (
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-sm font-medium tabular-nums">
                    Tick {nextAction.tick} · {nextAction.clockLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {formatTimeUntilTick(plan.start, nextAction.tick, now)}
                  </p>
                  <div className="mt-1.5 text-sm leading-snug">
                    <JobList items={nextAction.started} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine weiteren Aktionen</p>
              )}

              {followingActions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Danach
                  </p>
                  <ul className="space-y-2">
                    {followingActions.map((t) => (
                      <li
                        key={t.tick}
                        className="rounded-md border border-border/60 px-3 py-2 text-sm"
                      >
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Tick {t.tick} · {t.clockLabel}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatTimeUntilTick(plan.start, t.tick, now)}
                        </p>
                        <div className="mt-1 leading-snug">
                          <JobList items={t.started} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Nur Ticks mit User-Aktion (Start) */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Aktionsplan</h2>
          <TickTable ticks={actionTicks} variant="actions" currentTick={currentTick} />
        </section>

        {/* Vollständiges Tick-Log */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Tick-Protokoll</h2>
          <TickTable
            ticks={plan.ticks}
            maxHeightClass="max-h-[36rem]"
            variant="log"
            currentTick={currentTick}
          />
        </section>

        {/* Timeline */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <Timeline steps={plan.steps} maxTick={maxTick} />
        </section>
      </div>
    </main>
  );
}

function deltaClass(n: number) {
  if (n > 0) return "text-green-500";
  if (n < 0) return "text-red-500";
  return "";
}

function formatDelta(n: number) {
  if (!n) return "—";
  return `${n > 0 ? "+" : ""}${formatRes(n)}`;
}

function TickTable({
  ticks,
  maxHeightClass,
  variant = "log",
  currentTick,
}: {
  ticks: TickSnapshot[];
  maxHeightClass?: string;
  variant?: "actions" | "log";
  currentTick: number;
}) {
  const showResources = variant === "log";
  // Letzter Tick ≤ jetzt (= aktuelle Position / letzte fällige Aktion)
  const highlightTick = ticks.reduce<number | null>((best, t) => {
    if (t.tick > currentTick) return best;
    if (best === null || t.tick > best) return t.tick;
    return best;
  }, null);

  return (
    <div
      className={["overflow-auto rounded-xl border border-border", maxHeightClass]
        .filter(Boolean)
        .join(" ")}
    >
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <tr className="border-b border-border text-[10px] tracking-wide text-muted-foreground uppercase">
            <th className="px-2 py-2 font-medium">Tick</th>
            <th className="px-2 py-2 font-medium">Uhrzeit</th>
            {showResources && (
              <>
                <th className="px-2 py-2 font-medium text-right">Met</th>
                <th className="px-2 py-2 font-medium text-right">Kris</th>
                <th className="px-2 py-2 font-medium text-right">+M</th>
                <th className="px-2 py-2 font-medium text-right">+K</th>
              </>
            )}
            <th className="px-2 py-2 font-medium">Aktiv</th>
            <th className="px-2 py-2 font-medium">Start</th>
            <th className="px-2 py-2 font-medium">Ende</th>
          </tr>
        </thead>
        <tbody>
          {ticks.map((t) => {
            const hasStart = t.started.length > 0;
            const isCurrent = highlightTick !== null && t.tick === highlightTick;
            return (
              <tr
                key={t.tick}
                className={[
                  "border-b border-border/60",
                  variant === "actions"
                    ? "bg-background/50"
                    : hasStart
                      ? "bg-card"
                      : "bg-background/50 text-muted-foreground",
                ].join(" ")}
              >
                <td className="px-2 py-1.5 font-mono tabular-nums">{t.tick}</td>
                <td
                  className={[
                    "px-2 py-1.5 whitespace-nowrap tabular-nums",
                    isCurrent ? "font-medium text-green-500" : "",
                  ].join(" ")}
                >
                  {t.clockLabel}
                </td>
                {showResources && (
                  <>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                      {formatRes(t.met)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                      {formatRes(t.kris)}
                    </td>
                    <td
                      className={["px-2 py-1.5 text-right font-mono tabular-nums", deltaClass(t.incomeMet)].join(
                        " ",
                      )}
                    >
                      {formatDelta(t.incomeMet)}
                    </td>
                    <td
                      className={["px-2 py-1.5 text-right font-mono tabular-nums", deltaClass(t.incomeKris)].join(
                        " ",
                      )}
                    >
                      {formatDelta(t.incomeKris)}
                    </td>
                  </>
                )}
                <td className="max-w-[18rem] px-2 py-1.5 text-[11px] leading-snug">
                  {t.active.length ? (
                    <JobList
                      items={t.active.map((j) => ({
                        name: j.name,
                        type: j.type,
                        suffix: `(${j.remainingTicks})`,
                      }))}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[14rem] px-2 py-1.5 text-[11px] leading-snug">
                  {t.started.length ? <JobList items={t.started} /> : "—"}
                </td>
                <td className="max-w-[14rem] px-2 py-1.5 text-[11px] leading-snug">
                  {t.finished.length ? <JobList items={t.finished} /> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function jobTypeClass(type: TechTreeEntry["type"]) {
  return type === "building" ? "text-amber-500" : "text-fuchsia-500";
}

function JobList({
  items,
}: {
  items: Array<{ name: string; type: TechTreeEntry["type"]; suffix?: string }>;
}) {
  return (
    <span className="inline">
      {items.map((item, i) => (
        <span key={`${item.name}-${i}`}>
          {i > 0 && <span className="text-muted-foreground">, </span>}
          <span className={jobTypeClass(item.type)}>
            {item.name}
            {item.suffix ? (
              <span className="text-muted-foreground"> {item.suffix}</span>
            ) : null}
          </span>
        </span>
      ))}
    </span>
  );
}

function Timeline({ steps, maxTick }: { steps: Job[]; maxTick: number }) {
  // Überlappende Jobs in Zeilen stapeln
  const rows: Job[][] = [];
  const sorted = [...steps].sort(
    (a, b) => a.startTick - b.startTick || a.endTick - b.endTick,
  );
  for (const job of sorted) {
    let placed = false;
    for (const row of rows) {
      const last = row[row.length - 1];
      if (last.endTick <= job.startTick) {
        row.push(job);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([job]);
  }

  const rowHeight = 36;
  const height = Math.max(rows.length, 1) * rowHeight + 8;
  const markers: number[] = [];
  for (let t = 0; t <= maxTick; t += 12) markers.push(t);
  if (markers[markers.length - 1] !== maxTick) markers.push(maxTick);

  return (
    <div className="space-y-1">
      <div className="relative rounded-md bg-muted/50" style={{ height }}>
        {rows.map((row, rowIndex) =>
          row.map((s) => {
            const left = (s.startTick / maxTick) * 100;
            const width = Math.max(((s.endTick - s.startTick) / maxTick) * 100, 0.5);
            const isBuilding = s.type === "building";
            const top = 4 + rowIndex * rowHeight;
            return (
              <div
                key={`${s.name}-${s.startTick}`}
                title={`${s.name}: t${s.startTick}–${s.endTick}`}
                className={[
                  "absolute overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] leading-tight shadow-sm",
                  isBuilding
                    ? "bg-amber-500 text-amber-950"
                    : "bg-fuchsia-500 text-fuchsia-950",
                ].join(" ")}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top,
                  height: rowHeight - 8,
                }}
              >
                <span className="block truncate font-semibold">{s.name}</span>
              </div>
            );
          }),
        )}
      </div>
      <div className="relative h-6 border-t border-border pt-1">
        {markers.map((t) => (
          <span
            key={t}
            className="absolute text-[10px] text-muted-foreground tabular-nums"
            style={{
              left: `${(t / maxTick) * 100}%`,
              transform: t === 0 ? "none" : t === maxTick ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

