import type { Job } from "@/lib/calculateFastestWayToGoal";
import { cn } from "@/lib/utils/cn";

/** Sichtbare Breite der Timeline in Ticks (Viewport). */
const TIMELINE_VIEWPORT_TICKS = 150;

export type TimelineProps = {
  steps: Job[];
  maxTick: number;
  currentTick: number;
  hasPlan: boolean;
  onEditJob?: (planEntryId: string | undefined) => void;
};

export function Timeline({
  steps,
  maxTick,
  currentTick,
  hasPlan,
  onEditJob,
}: TimelineProps) {
  if (!hasPlan) {
    return <p className="p-4 text-sm text-muted-foreground">Kein Plan berechenbar.</p>;
  }

  const totalTicks = Math.max(maxTick, 1);
  const rows: Job[][] = [];
  // Group multi-unit/economy micro-jobs that share planEntryId into one bar
  const grouped = new Map<string, Job>();
  for (const s of steps) {
    const key = s.planEntryId ?? `${s.name}@${s.startTick}`;
    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, { ...s });
      continue;
    }
    grouped.set(key, {
      ...prev,
      startTick: Math.min(prev.startTick, s.startTick),
      endTick: Math.max(prev.endTick, s.endTick),
      name: prev.planEntryId ? prev.name.replace(/ \(\d+\/\d+\)$/, "").replace(/ #\d+$/, "") : prev.name,
    });
  }
  const sorted = [...grouped.values()].sort(
    (a, b) => a.startTick - b.startTick || a.endTick - b.endTick,
  );
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

  const rowHeight = 32;
  const trackHeight = Math.max(rows.length, 1) * rowHeight + 8;
  const step = 10;
  const markers: number[] = [];
  for (let t = 0; t <= totalTicks; t += step) markers.push(t);
  if (markers[markers.length - 1] !== totalTicks) markers.push(totalTicks);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="overflow-x-auto px-3 pt-3 pb-2">
          <div
            className="relative"
            style={{
              width: `max(100%, calc(100% * ${totalTicks} / ${TIMELINE_VIEWPORT_TICKS}))`,
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
            </div>

            <div className="relative" style={{ height: trackHeight }}>
              {rows.map((row, rowIndex) =>
                row.map((s) => {
                  const start = Math.max(0, Math.min(s.startTick, totalTicks));
                  const displayEnd = s.endTick === s.startTick ? s.startTick + 0.5 : s.endTick;
                  const endClamped = Math.max(start, Math.min(displayEnd, totalTicks));
                  const left = (start / totalTicks) * 100;
                  const widthPct = Math.max(((endClamped - start) / totalTicks) * 100, 0.25);
                  const isBuilding = s.type === "building";
                  const isResearch = s.type === "research";
                  const top = 4 + rowIndex * rowHeight;
                  const clickable = !!s.planEntryId && !!onEditJob;
                  return (
                    <button
                      key={`${s.name}-${s.startTick}-${s.planEntryId ?? ""}`}
                      type="button"
                      title={`${s.name}: t${s.startTick}–${s.endTick}${clickable ? " · klicken zum Bearbeiten" : ""}`}
                      disabled={!clickable}
                      onClick={() => onEditJob?.(s.planEntryId)}
                      className={cn(
                        "absolute overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-[10px] leading-tight ring-1 ring-inset",
                        isBuilding && "bg-amber-500/20 text-amber-300 ring-amber-500/40",
                        isResearch && "bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-500/40",
                        s.type === "unit" && "bg-sky-500/20 text-sky-300 ring-sky-500/40",
                        s.type === "recon" && "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
                        s.type === "economy" && "bg-cyan-500/20 text-cyan-300 ring-cyan-500/40",
                        clickable && "cursor-pointer hover:brightness-125",
                        !clickable && "cursor-default",
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${widthPct}%`,
                        top,
                        height: rowHeight - 8,
                      }}
                    >
                      <span className="block truncate font-medium">{s.name}</span>
                    </button>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
