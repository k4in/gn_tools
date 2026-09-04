import { useEffect, useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { type Job, type JobKind, type TickSnapshot } from "@/lib/calculateFastestWayToGoal";
import { cn } from "@/lib/utils/cn";

/** Sichtbare Breite der Timeline in Ticks (Viewport). Skala bleibt immer so grob. */
const TIMELINE_VIEWPORT_TICKS = 192;

export type TimelineProps = {
  steps: Job[];
  ticks?: TickSnapshot[];
  maxTick: number;
  currentTick: number;
  inspectTick?: number | null;
  hasPlan: boolean;
  isActive?: boolean;
  onEditJob?: (planEntryId: string | undefined) => void;
  onInspectTick?: (tick: number) => void;
};

function snapshotAtOrBefore(ticks: TickSnapshot[] | undefined, tick: number) {
  if (!ticks?.length) return null;
  let best: TickSnapshot | null = null;
  for (const snap of ticks) {
    if (snap.tick > tick) break;
    best = snap;
  }
  return best;
}

function tickFromClick(el: HTMLElement, clientX: number, totalTicks: number) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return Math.round(ratio * totalTicks);
}

type TimelineLane = "tech" | "fleet" | "econ";

function laneOf(type: JobKind): TimelineLane {
  if (type === "building" || type === "research") return "tech";
  if (type === "unit" || type === "recon") return "fleet";
  return "econ";
}

function packRows(jobs: Job[]): Job[][] {
  const sorted = [...jobs].sort(
    (a, b) => a.startTick - b.startTick || a.endTick - b.endTick,
  );
  const rows: Job[][] = [];
  for (const job of sorted) {
    let placed = false;
    for (const row of rows) {
      const last = row[row.length - 1];
      const lastEnd = Math.max(
        last.endTick,
        last.startTick + (last.endTick === last.startTick ? 0.5 : 0),
      );
      if (lastEnd <= job.startTick) {
        row.push(job);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([job]);
  }
  return rows;
}

export function Timeline({
  steps,
  ticks,
  maxTick,
  currentTick,
  inspectTick = null,
  hasPlan,
  isActive = false,
  onEditJob,
  onInspectTick,
}: TimelineProps) {
  const xScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const total = Math.max(maxTick, TIMELINE_VIEWPORT_TICKS);
    const tick = Math.min(Math.max(currentTick, 0), total);
    const id = requestAnimationFrame(() => {
      const scroller = xScrollRef.current;
      if (!scroller) return;
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      if (maxScroll <= 0) return;
      scroller.scrollLeft = Math.max(
        0,
        (tick / total) * scroller.scrollWidth - scroller.clientWidth / 2,
      );
    });
    return () => cancelAnimationFrame(id);
    // Nur beim Öffnen des Tabs; currentTick stammt aus genau diesem Render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
  if (!hasPlan) {
    return <p className="p-4 text-sm text-muted-foreground">Kein Plan berechenbar.</p>;
  }

  const totalTicks = Math.max(maxTick, TIMELINE_VIEWPORT_TICKS);
  // Group multi-unit/economy micro-jobs that share planEntryId into one bar
  const grouped = new Map<string, Job>();
  const economyParts = new Map<
    string,
    { asteroids: number; metExt: number; krisExt: number }
  >();
  for (const s of steps) {
    const key = s.planEntryId ?? `${s.name}@${s.startTick}`;
    if (s.type === "economy" && s.planEntryId) {
      const parts = economyParts.get(key) ?? { asteroids: 0, metExt: 0, krisExt: 0 };
      if (s.name.startsWith("Asteroid")) parts.asteroids += 1;
      else if (s.name.includes("Metall")) parts.metExt += 1;
      else if (s.name.includes("Kristall")) parts.krisExt += 1;
      economyParts.set(key, parts);
    }
    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, { ...s });
      continue;
    }
    grouped.set(key, {
      ...prev,
      startTick: Math.min(prev.startTick, s.startTick),
      endTick: Math.max(prev.endTick, s.endTick),
      name: prev.planEntryId
        ? prev.name.replace(/ \(\d+\/\d+\)$/, "").replace(/ #\d+$/, "")
        : prev.name,
    });
  }
  for (const [key, parts] of economyParts) {
    const job = grouped.get(key);
    if (!job) continue;
    const labels: string[] = [];
    if (parts.asteroids > 0) {
      labels.push(
        parts.asteroids === 1
          ? "1 Asteroid"
          : `${parts.asteroids} Asteroiden`,
      );
    }
    if (parts.metExt > 0) {
      labels.push(
        parts.metExt === 1 ? "1 Met-Ext" : `${parts.metExt} Met-Ext`,
      );
    }
    if (parts.krisExt > 0) {
      labels.push(
        parts.krisExt === 1 ? "1 Kris-Ext" : `${parts.krisExt} Kris-Ext`,
      );
    }
    if (labels.length) job.name = labels.join(" + ");
  }

  const byLane: Record<TimelineLane, Job[]> = { tech: [], fleet: [], econ: [] };
  for (const job of grouped.values()) {
    byLane[laneOf(job.type)].push(job);
  }
  const laneRows = ([
    "tech",
    "fleet",
    "econ",
  ] as const).map((lane) => packRows(byLane[lane])).filter((rows) => rows.length > 0);

  const rowHeight = 32;
  const laneGap = 10;
  const packedRows: { jobs: Job[]; top: number }[] = [];
  const separators: number[] = [];
  let cursor = 4;
  laneRows.forEach((rows, laneIndex) => {
    if (laneIndex > 0) {
      separators.push(cursor - 4 + laneGap / 2);
      cursor += laneGap;
    }
    for (const jobs of rows) {
      packedRows.push({ jobs, top: cursor });
      cursor += rowHeight;
    }
  });
  const trackHeight = Math.max(cursor + 4, rowHeight + 8);
  const step = 10;
  const markers: number[] = [];
  for (let t = 0; t <= totalTicks; t += step) markers.push(t);
  if (markers[markers.length - 1] !== totalTicks) markers.push(totalTicks);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div ref={xScrollRef} className="overflow-x-auto px-3 pt-3 pb-2">
          <div
            className="relative cursor-crosshair"
            style={{
              width: `calc(100% * ${totalTicks} / ${TIMELINE_VIEWPORT_TICKS})`,
            }}
            onClick={(event) => {
              if (!onInspectTick) return;
              onInspectTick(tickFromClick(event.currentTarget, event.clientX, totalTicks));
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: trackHeight }}
            >
              {markers.map((t) => (
                <div
                  key={`grid-${t}`}
                  className="absolute inset-y-0 w-px bg-border/60"
                  style={{ left: `${(t / totalTicks) * 100}%` }}
                />
              ))}
              {currentTick >= 0 && currentTick <= totalTicks && (
                <div
                  title={`Aktueller Tick ${currentTick}`}
                  className="absolute inset-y-0 z-10 w-0.5 bg-green-500"
                  style={{ left: `${(currentTick / totalTicks) * 100}%` }}
                />
              )}
              {inspectTick != null && inspectTick >= 0 && inspectTick <= totalTicks && (
                <div
                  title={`Inspektion Tick ${inspectTick}`}
                  className="absolute inset-y-0 z-10 w-0.5 bg-primary"
                  style={{ left: `${(inspectTick / totalTicks) * 100}%` }}
                />
              )}
              {separators.map((top) => (
                <div
                  key={`lane-${top}`}
                  className="absolute inset-x-0 h-px bg-border"
                  style={{ top }}
                />
              ))}
            </div>

            <div className="relative" style={{ height: trackHeight }}>
              {packedRows.map((row) =>
                row.jobs.map((s) => {
                  const start = Math.max(0, Math.min(s.startTick, totalTicks));
                  const displayEnd = s.endTick === s.startTick ? s.startTick + 0.5 : s.endTick;
                  const endClamped = Math.max(start, Math.min(displayEnd, totalTicks));
                  const left = (start / totalTicks) * 100;
                  const widthPct = Math.max(((endClamped - start) / totalTicks) * 100, 0.25);
                  const isBuilding = s.type === "building";
                  const isResearch = s.type === "research";
                  const top = row.top;
                  const clickable = !!s.planEntryId && !!onEditJob;
                  const startSnap = snapshotAtOrBefore(ticks, s.startTick);
                  const endSnap =
                    s.endTick === s.startTick
                      ? startSnap
                      : snapshotAtOrBefore(ticks, s.endTick);
                  return (
                    <Tooltip key={`${s.name}-${s.startTick}-${s.planEntryId ?? ""}`}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (clickable) onEditJob?.(s.planEntryId);
                            }}
                            className={cn(
                              "absolute overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-[10px] leading-tight ring-1 ring-inset",
                              isBuilding && "bg-amber-500/20 text-amber-300 ring-amber-500/40",
                              isResearch && "bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-500/40",
                              (s.type === "unit" || s.type === "recon") &&
                                "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
                              s.type === "economy" && "bg-cyan-500/20 text-cyan-300 ring-cyan-500/40",
                              s.type === "roid" && "bg-blue-800/35 text-blue-400 ring-blue-700/50",
                              s.type === "custom" && "bg-silver-500/20 text-silver-500 ring-silver-500/40",
                              clickable && "cursor-pointer hover:brightness-125",
                              !clickable && "cursor-default",
                            )}
                            style={{
                              left: `${left}%`,
                              width: `${widthPct}%`,
                              top,
                              height: rowHeight - 8,
                            }}
                          />
                        }
                      >
                        <span className="block truncate font-medium">{s.name}</span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="flex-col items-start gap-0.5 text-left"
                      >
                        <span className="font-medium">{s.name}</span>
                        {s.endTick === s.startTick ? (
                          <span className="tabular-nums text-muted-foreground">
                            Tick {s.startTick}
                            {startSnap ? ` – ${startSnap.clockLabel}` : ""}
                          </span>
                        ) : (
                          <>
                            <span className="tabular-nums text-muted-foreground">
                              Start: Tick {s.startTick}
                              {startSnap ? ` – ${startSnap.clockLabel}` : ""}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              Ende: Tick {s.endTick}
                              {endSnap ? ` – ${endSnap.clockLabel}` : ""}
                            </span>
                          </>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                }),
              )}
            </div>

            <div className="relative mt-1 h-4 border-t border-border pt-1">
              {markers.map((t) => (
                <span
                  key={t}
                  className="absolute text-[10px] text-muted-foreground tabular-nums"
                  style={{
                    left: `${(t / totalTicks) * 100}%`,
                    transform:
                      t === 0
                        ? "none"
                        : t === totalTicks
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {t}
                </span>
              ))}
              {currentTick >= 0 && currentTick <= totalTicks && (
                <span
                  className="absolute z-10 text-[10px] text-green-500 tabular-nums"
                  style={{
                    left: `${(currentTick / totalTicks) * 100}%`,
                    transform:
                      currentTick === 0
                        ? "none"
                        : currentTick === totalTicks
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {currentTick}
                </span>
              )}
              {inspectTick != null && inspectTick >= 0 && inspectTick <= totalTicks && (
                <span
                  className="absolute z-10 text-[10px] text-primary tabular-nums"
                  style={{
                    left: `${(inspectTick / totalTicks) * 100}%`,
                    transform:
                      inspectTick === 0
                        ? "none"
                        : inspectTick === totalTicks
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {inspectTick}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
