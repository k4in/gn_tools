import { jobTypeClass } from "@/components/overview/actionplan";
import { Button } from "@/components/shadcn/button";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { formatRes } from "@/lib/calculateFastestWayToGoal";
import type { Utility } from "@/gn-data/utility";

export type ReconProps = {
  items: Utility[];
  onAdd: (name: string) => void;
};

export function Recon({ items, onAdd }: ReconProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 py-2">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Aufklärung
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {items.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">
              Keine Aufklärungs-Items freigeschaltet.
            </li>
          ) : (
            items.map((item) => (
              <li key={item.name}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onAdd(item.name)}
                  className="h-auto w-full justify-between gap-2 px-2 py-1.5 text-left font-normal whitespace-normal"
                >
                  <span className="min-w-0">
                    <span className={jobTypeClass("recon")}>{item.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                      {item.ticks} T · {formatRes(item.cost.met)} M ·{" "}
                      {formatRes(item.cost.kris)} K
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
