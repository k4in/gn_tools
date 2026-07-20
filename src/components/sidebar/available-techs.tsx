import { jobTypeClass } from "@/components/overview/actionplan";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { formatRes } from "@/lib/calculateFastestWayToGoal";
import type { TechTreeEntry } from "@/types/gn";

export type AvailableTechsProps = {
  unlocked: TechTreeEntry[];
  onAdd: (name: string) => void;
};

export function AvailableTechs({ unlocked, onAdd }: AvailableTechsProps) {
  return (
    <section className="flex min-h-0 flex-col border-b border-border">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Verfügbar
        </span>
        <Badge variant="secondary">{unlocked.length}</Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {unlocked.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">
              Keine weiteren freigeschalteten Technologien
            </li>
          ) : (
            unlocked.map((tech) => (
              <li key={tech.name}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onAdd(tech.name)}
                  className="h-auto w-full justify-between gap-2 px-2 py-1.5 text-left font-normal whitespace-normal"
                >
                  <span className="min-w-0">
                    <span className={jobTypeClass(tech.type)}>{tech.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                      {tech.ticks} T · {formatRes(tech.cost.met)} M · {formatRes(tech.cost.kris)} K
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">+</span>
                </Button>
              </li>
            ))
          )}
        </ul>
      </ScrollArea>
    </section>
  );
}
