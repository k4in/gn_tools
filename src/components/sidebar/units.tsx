import { jobTypeClass } from "@/components/overview/actionplan";
import { Button } from "@/components/shadcn/button";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { StatusDot } from "@/components/sidebar/status-dot";
import { formatRes } from "@/lib/calculateFastestWayToGoal";
import type { Defense } from "@/gn-data/defense";
import type { Ship } from "@/gn-data/ships";

export type UnitsProps = {
  ships: Ship[];
  defenses: Defense[];
  planned: Set<string>;
  onAdd: (name: string) => void;
};

function UnitRow({
  name,
  ticks,
  cost,
  blocked,
  onAdd,
}: {
  name: string;
  ticks: number;
  cost: { met: number; kris: number };
  blocked: boolean;
  onAdd: (name: string) => void;
}) {
  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onAdd(name)}
        className="h-auto w-full justify-between gap-2 px-2 py-1.5 text-left font-normal whitespace-normal"
      >
        <span className="min-w-0">
          <span className={jobTypeClass("unit")}>
            {name}
            {blocked ? <StatusDot kind="blocked" /> : null}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
            {ticks} T · {formatRes(cost.met)} M · {formatRes(cost.kris)} K
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">+</span>
      </Button>
    </li>
  );
}

export function Units({ ships, defenses, planned, onAdd }: UnitsProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 py-2">
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Raumschiffe
          </span>
        </div>
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {ships.map((ship) => (
            <UnitRow
              key={ship.name}
              name={ship.name}
              ticks={ship.ticks}
              cost={ship.cost}
              blocked={ship.dependencies.some((dep) => !planned.has(dep))}
              onAdd={onAdd}
            />
          ))}
        </ul>
        <div className="px-3 py-2">
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Geschütze
          </span>
        </div>
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {defenses.map((def) => (
            <UnitRow
              key={def.name}
              name={def.name}
              ticks={def.ticks}
              cost={def.cost}
              blocked={def.dependencies.some((dep) => !planned.has(dep))}
              onAdd={onAdd}
            />
          ))}
        </ul>
      </ScrollArea>
    </section>
  );
}
