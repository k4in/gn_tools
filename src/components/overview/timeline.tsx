import type { Job } from "@/lib/calculateFastestWayToGoal";
import { cn } from "@/lib/utils/cn";

const TIMELINE_MAX_TICKS = 150;

export type TimelineProps = {
  steps: Job[];
  maxTick: number;
  hasPlan: boolean;
};

export function Timeline({ steps, maxTick, hasPlan }: TimelineProps) {
  if (!hasPlan) {
    return <p className="p-4 text-sm text-muted-foreground">Kein Plan berechenbar.</p>;
  }

  const scale = Math.min(Math.max(maxTick, 1), TIMELINE_MAX_TICKS);
  const rows: Job[][] = [];
  const sorted = [...steps]
    .filter((s) => s.type !== "economy")
    .sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick);
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

  const rowHeight = 32;
  const trackHeight = Math.max(rows.length, 1) * rowHeight + 8;
  const step = 10;
  const markers: number[] = [];
  for (let t = 0; t <= scale; t += step) markers.push(t);
  if (markers[markers.length - 1] !== scale) markers.push(scale);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Gebäude & Forschung
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          0 – {scale} Ticks
          {maxTick > TIMELINE_MAX_TICKS ? ` · Plan bis T${maxTick}` : ""}
        </span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative px-3 pt-3 pb-2" style={{ minHeight: trackHeight }}>
          <div className="pointer-events-none absolute inset-x-3 top-3 bottom-2">
            {markers.map((t) => (
              <div
                key={`grid-${t}`}
                className="absolute inset-y-0 w-px bg-border/60"
                style={{ left: `${(t / scale) * 100}%` }}
              />
            ))}
          </div>

          <div className="relative" style={{ height: trackHeight }}>
            {rows.map((row, rowIndex) =>
              row.map((s) => {
                const start = Math.min(s.startTick, scale);
                const end = Math.min(Math.max(s.endTick, s.startTick), scale);
                if (s.startTick >= scale) return null;
                const left = (start / scale) * 100;
                const width = Math.max(((end - start) / scale) * 100, 0.4);
                const isBuilding = s.type === "building";
                const top = 4 + rowIndex * rowHeight;
                return (
                  <div
                    key={`${s.name}-${s.startTick}`}
                    title={`${s.name}: t${s.startTick}–${s.endTick}`}
                    className={cn(
                      "absolute overflow-hidden rounded-sm px-1.5 py-0.5 text-[10px] leading-tight ring-1 ring-inset",
                      isBuilding
                        ? "bg-amber-500/20 text-amber-300 ring-amber-500/40"
                        : "bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-500/40",
                    )}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top,
                      height: rowHeight - 8,
                    }}
                  >
                    <span className="block truncate font-medium">{s.name}</span>
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>

      <div className="relative shrink-0 border-t border-border px-3 py-1.5">
        <div className="relative h-4">
          {markers.map((t) => (
            <span
              key={t}
              className="absolute text-[10px] text-muted-foreground tabular-nums"
              style={{
                left: `${(t / scale) * 100}%`,
                transform:
                  t === 0 ? "none" : t === scale ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
