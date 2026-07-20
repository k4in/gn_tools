import { jobTypeClass } from "@/components/overview/actionplan";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import {
  clockLabel,
  isExtractorPlanEntry,
  type PlanResult,
  type StartConfig,
} from "@/lib/calculateFastestWayToGoal";
import type { TechTreeEntry } from "@/types/gn";

export type PlannedTechsProps = {
  planNames: string[];
  techByName: Map<string, TechTreeEntry>;
  plan: PlanResult | null;
  startCfg: StartConfig;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
};

export function PlannedTechs({
  planNames,
  techByName,
  plan,
  startCfg,
  onMove,
  onRemove,
}: PlannedTechsProps) {
  return (
    <section className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Plan
        </span>
        <Badge variant="secondary">{planNames.length}</Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ol className="flex flex-col gap-1 px-2 pb-2">
          {planNames.map((name, i) => {
            const tech = techByName.get(name);
            const isEcon = isExtractorPlanEntry(name);
            const fin = plan?.stepFinishTicks[i];
            const canUp = i > 0;
            const canDown = i < planNames.length - 1;
            return (
              <li
                key={`${name}-${i}`}
                className="flex items-start justify-between gap-1 rounded-md border border-border/60 px-2 py-1.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span>{" "}
                  <span
                    className={
                      tech
                        ? jobTypeClass(tech.type)
                        : isEcon
                          ? jobTypeClass("economy")
                          : ""
                    }
                  >
                    {name}
                  </span>
                  {fin !== undefined && fin >= 0 && (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                      fertig T{fin}
                      {plan ? ` · ${clockLabel(startCfg, fin)}` : ""}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onMove(i, -1)}
                          disabled={!canUp}
                        />
                      }
                    >
                      ↑
                    </TooltipTrigger>
                    <TooltipContent>Nach oben</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onMove(i, 1)}
                          disabled={!canDown}
                        />
                      }
                    >
                      ↓
                    </TooltipTrigger>
                    <TooltipContent>Nach unten</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onRemove(i)}
                        />
                      }
                    >
                      ×
                    </TooltipTrigger>
                    <TooltipContent>Entfernen</TooltipContent>
                  </Tooltip>
                </span>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </section>
  );
}
