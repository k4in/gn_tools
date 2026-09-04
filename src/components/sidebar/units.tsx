import { jobTypeClass } from "@/components/overview/actionplan";
import { Button } from "@/components/shadcn/button";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { StatusDot } from "@/components/sidebar/status-dot";
import { formatRes } from "@/lib/calculateFastestWayToGoal";
import type { Ship } from "@/gn-data/ships";

export type UnitsProps = {
  ships: Ship[];
  planned: Set<string>;
  onAdd: (name: string) => void;
};

export function Units({ ships, planned, onAdd }: UnitsProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 py-2">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Einheiten
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {ships.map((ship) => {
            const blocked = ship.dependencies.some((dep) => !planned.has(dep));
            return (
              <li key={ship.name}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onAdd(ship.name)}
                  className="h-auto w-full justify-between gap-2 px-2 py-1.5 text-left font-normal whitespace-normal"
                >
                  <span className="min-w-0">
                    <span className={jobTypeClass("unit")}>
                      {ship.name}
                      {blocked ? <StatusDot kind="blocked" /> : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                      {ship.ticks} T · {formatRes(ship.cost.met)} M ·{" "}
                      {formatRes(ship.cost.kris)} K
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">+</span>
                </Button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </section>
  );
}
