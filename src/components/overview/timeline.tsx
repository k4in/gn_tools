import { useEffect, useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { StatusDot } from "@/components/sidebar/status-dot";
import { type Job, type JobKind, type TickSnapshot } from "@/lib/calculateFastestWayToGoal";
import { cn } from "@/lib/utils/cn";

/** Sichtbare Breite der Timeline in Ticks (Viewport). Skala bleibt immer so grob. */
const TIMELINE_VIEWPORT_TICKS = 192;

export type TimelineProps = {
  steps: Job[];
  ticks?: TickSnapshot[];
  maxTick: number;
  /** Erstes sichtbares Tick (Vergangenheit davor wird nicht gezeichnet). */
  historyStartTick?: number;
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

function tickFromClick(
  el: HTMLElement,
  clientX: number,
  rangeStart: number,
  domainLength: number,
) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return rangeStart;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return Math.round(rangeStart + ratio * domainLength);
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
  historyStartTick = 0,
  currentTick,
  inspectTick = null,
  hasPlan,
  isActive = false,
  onEditJob,
  onInspectTick,
}: TimelineProps) {
  const xScrollRef = useRef<HTMLDivElement>(null);
  const rangeStart = Math.max(0, historyStartTick);
  const domainLength = Math.max(maxTick - rangeStart, TIMELINE_VIEWPORT_TICKS);
  const domainEnd = rangeStart + domainLength;

  useEffect(() => {
    if (!isActive) return;
    const total = domainLength;
    const tick = Math.min(Math.max(currentTick - rangeStart, 0), total);
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
    // Nur beim Öffnen des Tabs / Wechsel des Verlaufsfensters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, historyStartTick]);
  if (!hasPlan) {
    return <p className="p-4 text-sm text-muted-foreground">Kein Plan berechenbar.</p>;
  }

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
      blocked: Boolean(prev.blocked || s.blocked),
      delayed: Boolean(prev.delayed || s.delayed),
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
    const displayEnd = job.endTick === job.startTick ? job.startTick + 0.5 : job.endTick;
    if (displayEnd <= rangeStart || job.startTick >= domainEnd) continue;
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
  const markers: number[] = [rangeStart];
  const firstStep = Math.ceil((rangeStart + 1) / step) * step;
  for (let t = firstStep; t < domainEnd; t += step) markers.push(t);
  if (markers[markers.length - 1] !== domainEnd) markers.push(domainEnd);
  const xPct = (tick: number) => ((tick - rangeStart) / domainLength) * 100;

  return (
    <div ref={xScrollRef} className="overflow-x-auto px-3 pt-3 pb-2">
      <div
            className="relative cursor-crosshair"
            style={{
              width: `calc(100% * ${domainLength} / ${TIMELINE_VIEWPORT_TICKS})`,
            }}
            onClick={(event) => {
              if (!onInspectTick) return;
              onInspectTick(
                tickFromClick(event.currentTarget, event.clientX, rangeStart, domainLength),
              );
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
                  style={{ left: `${xPct(t)}%` }}
                />
              ))}
              {currentTick >= rangeStart && currentTick <= domainEnd && (
                <div
                  title={`Aktueller Tick ${currentTick}`}
                  className="absolute inset-y-0 z-10 w-0.5 bg-green-500"
                  style={{ left: `${xPct(currentTick)}%` }}
                />
              )}
              {inspectTick != null && inspectTick >= rangeStart && inspectTick <= domainEnd && (
                <div
                  title={`Inspektion Tick ${inspectTick}`}
                  className="absolute inset-y-0 z-10 w-0.5 bg-primary"
                  style={{ left: `${xPct(inspectTick)}%` }}
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
                  const start = Math.max(rangeStart, Math.min(s.startTick, domainEnd));
                  const displayEnd = s.endTick === s.startTick ? s.startTick + 0.5 : s.endTick;
                  const endClamped = Math.max(start, Math.min(displayEnd, domainEnd));
                  const left = xPct(start);
                  const widthPct = Math.max(((endClamped - start) / domainLength) * 100, 0.25);
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
                              "absolute overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-[10px] leading-tight",
                              isBuilding && "bg-amber-500/20 text-amber-300",
                              isResearch && "bg-fuchsia-500/20 text-fuchsia-300",
                              (s.type === "unit" || s.type === "recon") &&
                                "bg-emerald-500/20 text-emerald-300",
                              s.type === "economy" && "bg-cyan-500/20 text-cyan-300",
                              s.type === "roid" && "bg-blue-800/35 text-blue-400",
                              s.type === "catastrophe" && "bg-red-800/35 text-red-400",
                              s.type === "snapshot" && "bg-destructive/20 text-destructive",
                              s.type === "custom" && "bg-silver-500/20 text-silver-500",
                              s.type === "trade" && "bg-zinc-500/20 text-zinc-400",
                              s.blocked
                                ? "ring-[3px] ring-destructive"
                                : cn(
                                    "ring-1 ring-inset",
                                    isBuilding && "ring-amber-500/40",
                                    isResearch && "ring-fuchsia-500/40",
                                    (s.type === "unit" || s.type === "recon") &&
                                      "ring-emerald-500/40",
                                    s.type === "economy" && "ring-cyan-500/40",
                                    s.type === "roid" && "ring-blue-700/50",
                                    s.type === "catastrophe" && "ring-red-700/50",
                                    s.type === "snapshot" && "ring-destructive/50",
                                    s.type === "custom" && "ring-silver-500/40",
                                    s.type === "trade" && "ring-zinc-500/40",
                                  ),
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
                        <span className="flex min-w-0 items-center">
                          <span className="truncate font-medium">{s.name}</span>
                          {s.delayed ? <StatusDot kind="delayed" /> : null}
                        </span>
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
                    left: `${xPct(t)}%`,
                    transform:
                      t === rangeStart
                        ? "none"
                        : t === domainEnd
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {t}
                </span>
              ))}
              {currentTick >= rangeStart && currentTick <= domainEnd && (
                <span
                  className="absolute z-10 text-[10px] text-green-500 tabular-nums"
                  style={{
                    left: `${xPct(currentTick)}%`,
                    transform:
                      currentTick === rangeStart
                        ? "none"
                        : currentTick === domainEnd
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {currentTick}
                </span>
              )}
              {inspectTick != null && inspectTick >= rangeStart && inspectTick <= domainEnd && (
                <span
                  className="absolute z-10 text-[10px] text-primary tabular-nums"
                  style={{
                    left: `${xPct(inspectTick)}%`,
                    transform:
                      inspectTick === rangeStart
                        ? "none"
                        : inspectTick === domainEnd
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
  );
}
