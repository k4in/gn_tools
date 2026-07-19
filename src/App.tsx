import { useMemo } from "react";
import techtreeData from "@/gn-data/techtree.json";
import type { TechTreeEntry } from "@/types/gn";

const techtree = techtreeData as TechTreeEntry[];
const GOAL = "Extraktor";
const TICK_MINUTES = 15;

type ScheduledStep = {
  entry: TechTreeEntry;
  startTick: number;
  endTick: number;
  lane: "building" | "research";
  onCriticalPath: boolean;
};

function byName(entries: TechTreeEntry[]) {
  return new Map(entries.map((e) => [e.name, e]));
}

/** All techs required to unlock `goal` (including goal itself). */
function requiredClosure(goal: string, map: Map<string, TechTreeEntry>) {
  const needed = new Set<string>();
  const visit = (name: string) => {
    if (needed.has(name)) return;
    const entry = map.get(name);
    if (!entry) throw new Error(`Unknown tech: ${name}`);
    needed.add(name);
    for (const dep of entry.dependencies) visit(dep);
  };
  visit(goal);
  return needed;
}

/** Longest remaining duration (ticks) through dependency chain. */
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
    // Prefer dependency with highest critical-path contribution
    current = entry.dependencies.reduce((best, d) =>
      criticalPathTicks(d, map) > criticalPathTicks(best, map) ? d : best,
    );
  }
  return path;
}

/**
 * Draft scheduler: one building lane + one research lane in parallel.
 * Greedy: whenever a lane is free, start the ready item with the highest
 * critical-path remaining time (then higher cost as tie-break).
 */
function schedule(
  needed: Set<string>,
  map: Map<string, TechTreeEntry>,
  critical: Set<string>,
): ScheduledStep[] {
  const done = new Set<string>();
  const steps: ScheduledStep[] = [];
  let buildingFreeAt = 0;
  let researchFreeAt = 0;
  let guard = 0;

  const ready = (lane: "building" | "research") =>
    [...needed]
      .filter((n) => !done.has(n))
      .map((n) => map.get(n)!)
      .filter((e) => e.type === lane)
      .filter((e) => e.dependencies.every((d) => !needed.has(d) || done.has(d)));

  const pick = (candidates: TechTreeEntry[]) => {
    if (!candidates.length) return null;
    return candidates
      .slice()
      .sort((a, b) => {
        const cp = criticalPathTicks(b.name, map) - criticalPathTicks(a.name, map);
        if (cp !== 0) return cp;
        return b.cost.met + b.cost.kris - (a.cost.met + a.cost.kris);
      })[0];
  };

  while (done.size < needed.size && guard++ < 500) {
    const bReady = ready("building");
    const rReady = ready("research");
    const bPick = pick(bReady);
    const rPick = pick(rReady);

    if (!bPick && !rPick) {
      // Deadlock (shouldn't happen on a valid tree)
      break;
    }

    // Advance the lane that can start sooner (or both if same time)
    const bStart = bPick ? buildingFreeAt : Infinity;
    const rStart = rPick ? researchFreeAt : Infinity;
    const t = Math.min(bStart, rStart);

    if (bPick && buildingFreeAt <= t) {
      const startTick = buildingFreeAt;
      const endTick = startTick + bPick.ticks;
      steps.push({
        entry: bPick,
        startTick,
        endTick,
        lane: "building",
        onCriticalPath: critical.has(bPick.name),
      });
      buildingFreeAt = endTick;
      done.add(bPick.name);
    }

    if (rPick && researchFreeAt <= t) {
      // re-check still ready (deps might need the building we just finished — only if same t after building)
      const stillReady =
        rPick.dependencies.every((d) => !needed.has(d) || done.has(d)) ||
        // if we finished a dep this same iteration at same t, allow it next loop
        false;
      if (rPick.dependencies.every((d) => !needed.has(d) || done.has(d))) {
        const startTick = researchFreeAt;
        const endTick = startTick + rPick.ticks;
        steps.push({
          entry: rPick,
          startTick,
          endTick,
          lane: "research",
          onCriticalPath: critical.has(rPick.name),
        });
        researchFreeAt = endTick;
        done.add(rPick.name);
      } else if (!stillReady && !bPick) {
        // wait for building lane progress
        researchFreeAt = Math.max(researchFreeAt, buildingFreeAt);
      }
    }

    // If only one lane progressed due to dep order, nudge the waiting lane clock
    if (done.size < needed.size) {
      const nextB = pick(ready("building"));
      const nextR = pick(ready("research"));
      if (!nextB && nextR && researchFreeAt < buildingFreeAt) {
        researchFreeAt = buildingFreeAt;
      }
      if (!nextR && nextB && buildingFreeAt < researchFreeAt) {
        buildingFreeAt = researchFreeAt;
      }
      // both blocked until the other finishes something already scheduled — clocks already advanced
      if (!nextB && !nextR) {
        const nextFree = Math.min(buildingFreeAt, researchFreeAt);
        if (buildingFreeAt === researchFreeAt) break;
        if (buildingFreeAt < researchFreeAt) researchFreeAt = nextFree;
        else buildingFreeAt = nextFree;
      }
    }
  }

  return steps.sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick);
}

function formatDuration(ticks: number) {
  const minutes = ticks * TICK_MINUTES;
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || !parts.length) parts.push(`${mins}m`);
  return `${parts.join(" ")} · ${ticks} ticks`;
}

function formatRes(n: number) {
  return n.toLocaleString("de-DE");
}

export default function App() {
  const plan = useMemo(() => {
    const map = byName(techtree);
    if (!map.has(GOAL)) throw new Error(`Goal ${GOAL} missing from techtree`);

    const needed = requiredClosure(GOAL, map);
    const critical = criticalPathSet(GOAL, map);
    const cpTicks = criticalPathTicks(GOAL, map);
    const steps = schedule(needed, map, critical);
    const makespan = steps.reduce((m, s) => Math.max(m, s.endTick), 0);

    let met = 0;
    let kris = 0;
    for (const name of needed) {
      const e = map.get(name)!;
      met += e.cost.met;
      kris += e.cost.kris;
    }
    // First extractor unit cost from info.md (not in techtree)
    const firstExtractorMet = 65;

    const requiredEntries = [...needed]
      .map((n) => map.get(n)!)
      .sort((a, b) => criticalPathTicks(a.name, map) - criticalPathTicks(b.name, map));

    return {
      map,
      needed,
      critical,
      cpTicks,
      steps,
      makespan,
      totalCost: { met: met + firstExtractorMet, kris },
      techCost: { met, kris },
      firstExtractorMet,
      requiredEntries,
    };
  }, []);

  const maxTick = Math.max(plan.makespan, 1);
  const buildingSteps = plan.steps.filter((s) => s.lane === "building");
  const researchSteps = plan.steps.filter((s) => s.lane === "research");

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
        {/* Header */}
        <header className="space-y-2 border-b border-border pb-6">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            GN Planner · draft
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Fastest path to first{" "}
            <span className="text-primary">{GOAL}</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Rough plan from the tech tree only: one building queue and one research
            queue in parallel. Resource income, partial ticks, and shipyard queues
            are not simulated yet — this is a visual first draft.
          </p>
        </header>

        {/* KPI strip */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Wall-clock (parallel queues)"
            value={formatDuration(plan.makespan)}
            hint="Build + research at the same time"
          />
          <Kpi
            label="Critical path (serial deps)"
            value={formatDuration(plan.cpTicks)}
            hint="Longest dependency chain"
          />
          <Kpi
            label="Tech cost (path)"
            value={`${formatRes(plan.techCost.met)} M · ${formatRes(plan.techCost.kris)} K`}
            hint="Sum of required techs/buildings"
          />
          <Kpi
            label="Incl. 1st extractor"
            value={`${formatRes(plan.totalCost.met)} M · ${formatRes(plan.totalCost.kris)} K`}
            hint={`+${plan.firstExtractorMet} M unit cost (info.md)`}
          />
        </section>

        {/* Gantt */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Timeline</h2>
              <p className="text-sm text-muted-foreground">
                Yellow = building · Grey = research ·{" "}
                <span className="font-medium text-primary">Outline</span> = critical
                path
              </p>
            </div>
            <Legend />
          </div>

          <div className="space-y-6">
            <GanttLane
              title="Building"
              steps={buildingSteps}
              maxTick={maxTick}
            />
            <GanttLane
              title="Research"
              steps={researchSteps}
              maxTick={maxTick}
            />
          </div>

          {/* tick scale */}
          <div className="relative mt-2 h-6 border-t border-border pt-1">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const t = Math.round(maxTick * f);
              return (
                <span
                  key={f}
                  className="absolute text-[10px] text-muted-foreground tabular-nums"
                  style={{ left: `${f * 100}%`, transform: "translateX(-50%)" }}
                >
                  t{t}
                </span>
              );
            })}
          </div>
        </section>

        {/* Ordered steps + dependency chips */}
        <section className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
            <h2 className="text-lg font-semibold">Suggested order</h2>
            <ol className="space-y-2">
              {plan.steps.map((step, i) => (
                <li
                  key={`${step.entry.name}-${step.startTick}`}
                  className={[
                    "flex items-stretch gap-3 rounded-lg border p-3",
                    step.onCriticalPath
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card",
                  ].join(" ")}
                >
                  <div className="flex w-8 shrink-0 items-center justify-center text-sm font-bold text-muted-foreground tabular-nums">
                    {i + 1}
                  </div>
                  <div
                    className={[
                      "w-1 shrink-0 rounded-full",
                      step.lane === "building" ? "bg-amber-400" : "bg-zinc-400",
                    ].join(" ")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{step.entry.name}</span>
                      <TypeBadge type={step.entry.type} />
                      {step.onCriticalPath && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                          critical
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ticks {step.startTick}→{step.endTick} · {step.entry.ticks}{" "}
                      ticks duration · {formatRes(step.entry.cost.met)} M /{" "}
                      {formatRes(step.entry.cost.kris)} K
                    </p>
                    {step.entry.dependencies.length > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        needs: {step.entry.dependencies.join(", ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              <li className="flex items-stretch gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="flex w-8 shrink-0 items-center justify-center text-sm font-bold text-primary tabular-nums">
                  ✓
                </div>
                <div className="w-1 shrink-0 rounded-full bg-primary" />
                <div>
                  <span className="font-medium">Build first Extraktor unit</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    +{plan.firstExtractorMet} M (n×65 M scaling) · +50 resources /
                    tick once finished · not timed in this draft
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Required set / graph summary */}
          <div className="space-y-3 lg:col-span-2">
            <h2 className="text-lg font-semibold">Required tech set</h2>
            <p className="text-sm text-muted-foreground">
              {plan.needed.size} items in the dependency closure of {GOAL}.
            </p>
            <ul className="flex flex-col gap-1.5">
              {plan.requiredEntries.map((e) => {
                const isGoal = e.name === GOAL;
                const isCrit = plan.critical.has(e.name);
                return (
                  <li
                    key={e.name}
                    className={[
                      "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm",
                      isGoal
                        ? "border-primary bg-primary/10 font-medium"
                        : isCrit
                          ? "border-primary/30 bg-card"
                          : "border-border/80 bg-muted/40 text-muted-foreground",
                    ].join(" ")}
                  >
                    <span className="truncate">{e.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums">
                      {e.ticks}t
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Draft notes</p>
              <ul className="list-inside list-disc space-y-1">
                <li>No resource-wait simulation (mines / asteroids ignored).</li>
                <li>Assumes free parallel building + research slots.</li>
                <li>Critical path = longest tick chain in the tree.</li>
                <li>Next: income model from info.md + “can I afford this now?”.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Mini flow: critical path only */}
        <section className="space-y-3 rounded-xl border border-border bg-card p-4 md:p-6">
          <h2 className="text-lg font-semibold">Critical path chain</h2>
          <p className="text-sm text-muted-foreground">
            Dependency spine that determines the lower bound on time.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[...plan.critical]
              .map((n) => plan.map.get(n)!)
              .sort(
                (a, b) =>
                  criticalPathTicks(a.name, plan.map) -
                  criticalPathTicks(b.name, plan.map),
              )
              .map((e, i, arr) => (
                <div key={e.name} className="flex items-center gap-2">
                  <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {e.ticks} ticks · {e.type}
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-primary" aria-hidden>
                      →
                    </span>
                  )}
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-heading text-lg font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: TechTreeEntry["type"] }) {
  return (
    <span
      className={[
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        type === "building"
          ? "bg-amber-400/20 text-amber-800 dark:text-amber-200"
          : "bg-zinc-500/20 text-zinc-700 dark:text-zinc-200",
      ].join(" ")}
    >
      {type}
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-amber-400" /> Building
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-zinc-400" /> Research
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm ring-2 ring-primary ring-offset-1 ring-offset-background" />{" "}
        Critical
      </span>
    </div>
  );
}

function GanttLane({
  title,
  steps,
  maxTick,
}: {
  title: string;
  steps: ScheduledStep[];
  maxTick: number;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </div>
      <div className="relative h-14 rounded-md bg-muted/50">
        {steps.map((s) => {
          const left = (s.startTick / maxTick) * 100;
          const width = Math.max(((s.endTick - s.startTick) / maxTick) * 100, 0.8);
          const isBuilding = s.lane === "building";
          return (
            <div
              key={`${s.entry.name}-${s.startTick}`}
              title={`${s.entry.name}: t${s.startTick}–${s.endTick}`}
              className={[
                "absolute top-1.5 bottom-1.5 overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] leading-tight shadow-sm",
                isBuilding
                  ? "bg-amber-400 text-amber-950"
                  : "bg-zinc-400 text-zinc-950",
                s.onCriticalPath ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
              ].join(" ")}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="block truncate font-semibold">{s.entry.name}</span>
              <span className="block opacity-80">
                {s.startTick}–{s.endTick}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
