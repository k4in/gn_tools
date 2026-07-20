import { Badge } from "@/components/shadcn/badge";
import { Separator } from "@/components/shadcn/separator";
import { JobList } from "@/components/overview/actionplan";
import {
  clockLabel,
  formatTimeUntilTick,
  formatWallClock,
  type PlanResult,
  type StartConfig,
  type TickSnapshot,
} from "@/lib/calculateFastestWayToGoal";

const MILESTONES = ["Extraktor", "Kaperschiff", "Schildschiff"] as const;

export type HeaderProps = {
  now: Date;
  currentTick: number;
  startCfg: StartConfig;
  plan: PlanResult | null;
  nextAction: TickSnapshot | null;
};

export function Header({ now, currentTick, startCfg, plan, nextAction }: HeaderProps) {
  return (
    <header className="shrink-0 border-b border-border">
      <div className="flex items-stretch gap-0 px-4">
        <div className="flex items-center gap-6 py-3 pr-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              GN Tool
            </span>
            <span className="font-heading text-xl font-semibold tracking-tight tabular-nums">
              {formatWallClock(now)}
            </span>
          </div>
          <Separator orientation="vertical" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Tick
            </span>
            <span className="font-heading text-xl font-semibold tabular-nums">
              {currentTick < 0 ? `−${Math.abs(currentTick)}` : currentTick}
            </span>
          </div>
          {!plan && (
            <>
              <Separator orientation="vertical" />
              <Badge variant="destructive">Plan nicht berechenbar</Badge>
            </>
          )}
        </div>

        <Separator orientation="vertical" className="my-2" />

        <div className="flex min-w-0 flex-1 items-stretch gap-8 overflow-x-auto px-6 py-2">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Nächste Aktion
            </span>
            {nextAction ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium tabular-nums">T{nextAction.tick}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {nextAction.clockLabel} ·{" "}
                    {formatTimeUntilTick(startCfg, nextAction.tick, now)}
                  </span>
                </div>
                <JobList items={nextAction.started} />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Keine weiteren Aktionen</span>
            )}
          </div>

          <div className="flex shrink-0 items-stretch gap-4">
            <Separator orientation="vertical" />
            {MILESTONES.map((name, i) => {
              const job = plan?.steps.find((s) => s.name === name);
              const finishTick = job?.endTick;
              return (
                <div key={name} className="flex items-stretch gap-4">
                  {i > 0 && <Separator orientation="vertical" />}
                  <div className="flex min-w-28 flex-col justify-center gap-0.5">
                    <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                      {name}
                    </span>
                    {finishTick !== undefined ? (
                      <>
                        <span className="text-sm font-medium tabular-nums">
                          Tick {finishTick}
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {clockLabel(startCfg, finishTick)}
                          </span>
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {formatTimeUntilTick(startCfg, finishTick, now)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">nicht im Plan</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
