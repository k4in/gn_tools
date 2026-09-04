import { ExtractorsDialog } from "@/components/extractors-dialog";
import { InfoDialog } from "@/components/info-dialog";
import { JobList } from "@/components/overview/actionplan";
import { SettingsDialog } from "@/components/settings-dialog";
import { Badge } from "@/components/shadcn/badge";
import { Separator } from "@/components/shadcn/separator";
import {
  clockLabel,
  formatRes,
  formatTimeUntilTick,
  formatWallClock,
  type PlanResult,
  type StartConfig,
  type TickSnapshot,
} from "@/lib/calculateFastestWayToGoal";

export type HeaderProps = {
  now: Date;
  currentTick: number;
  startCfg: StartConfig;
  plan: PlanResult | null;
  nextAction: TickSnapshot | null;
  onApplyStart: (next: { start_date: string; start_time: string; tick_minutes: number }) => void;
};

function resourcesAtCurrentTick(
  plan: PlanResult | null,
  startCfg: StartConfig,
  currentTick: number,
) {
  if (!plan || currentTick < 0) {
    return {
      met: startCfg.starting_resources.metall,
      kris: startCfg.starting_resources.kristall,
    };
  }
  let best: TickSnapshot | null = null;
  for (const tick of plan.ticks) {
    if (tick.tick > currentTick) break;
    best = tick;
  }
  if (!best) {
    return {
      met: startCfg.starting_resources.metall,
      kris: startCfg.starting_resources.kristall,
    };
  }
  return { met: best.met, kris: best.kris };
}

export function Header({ now, currentTick, startCfg, plan, nextAction, onApplyStart }: HeaderProps) {
  const extractorJob = plan?.steps.find((s) => s.name === "Extraktor");
  const extractorTick = extractorJob?.endTick;
  const nextJobs = nextAction?.started.filter((job) => job.type !== "custom" && job.type !== "trade") ?? [];
  const followingAction =
    plan && nextAction
      ? plan.ticks.find(
          (tick) =>
            tick.tick > nextAction.tick &&
            tick.started.some((job) => job.type !== "custom" && job.type !== "trade"),
        ) ?? null
      : null;
  const resources = resourcesAtCurrentTick(plan, startCfg, currentTick);

  return (
    <header className="shrink-0 border-b border-border">
      <div className="flex items-stretch gap-0 px-4">
        <div className="flex items-center gap-6 py-3 pr-6">
          <div className="flex items-center gap-2">
            <InfoDialog />
            <SettingsDialog
              startDate={startCfg.start_date}
              startTime={startCfg.start_time}
              tickMinutes={startCfg.tick_minutes}
              onApplyStart={onApplyStart}
            />
          </div>
          <Separator orientation="vertical" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Uhrzeit</span>
            <span className="font-heading text-xl font-semibold tracking-tight tabular-nums">{formatWallClock(now)}</span>
          </div>
          <Separator orientation="vertical" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Tick</span>
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
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Aktuelle Aktion</span>
            {nextAction && nextJobs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium tabular-nums">T{nextAction.tick}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {nextAction.clockLabel} · {formatTimeUntilTick(startCfg, nextAction.tick, now)}
                  </span>
                </div>
                <JobList items={nextJobs} />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Keine weiteren Aktionen</span>
            )}
          </div>

          <div className="flex shrink-0 flex-col justify-center gap-0.5">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Nächste Aktion
            </span>
            {followingAction ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                T{followingAction.tick} · {followingAction.clockLabel}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          <div className="flex shrink-0 items-stretch gap-4">
            <Separator orientation="vertical" />
            <div className="flex min-w-28 flex-col justify-center gap-0.5">
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Aktuelle Ressourcen
              </span>
              <span className="text-sm font-medium tabular-nums">
                {formatRes(resources.met)} M
                <span className="ml-1.5">{formatRes(resources.kris)} K</span>
              </span>
            </div>
            <Separator orientation="vertical" />
            <ExtractorsDialog startCfg={startCfg} plan={plan} currentTick={currentTick}>
              {extractorTick !== undefined && currentTick >= extractorTick ? (
                <span className="text-sm font-medium text-sky-500">Extraktoren</span>
              ) : (
                <>
                  <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    Extraktoren
                  </span>
                  {extractorTick !== undefined ? (
                    <span className="text-sm font-medium tabular-nums">
                      ab Tick {extractorTick}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {clockLabel(startCfg, extractorTick)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">nicht im Plan</span>
                  )}
                </>
              )}
            </ExtractorsDialog>
          </div>
        </div>
      </div>
    </header>
  );
}
