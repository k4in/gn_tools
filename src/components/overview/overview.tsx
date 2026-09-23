import { useMemo, useState } from "react";
import { ExportPlanDialog } from "@/components/export-plan-dialog";
import { ImportPlanDialog } from "@/components/import-plan-dialog";
import { ResetPlanDialog, type ResetPlanSource } from "@/components/reset-plan-dialog";
import { TaxesDialog } from "@/components/taxes-dialog";
import type { PlanEntry } from "@/gn-data/plan";
import { ActionPlan } from "@/components/overview/actionplan";
import { Protocol } from "@/components/overview/protocol";
import { Timeline } from "@/components/overview/timeline";
import { CircleDot, Crosshair } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Separator } from "@/components/shadcn/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shadcn/tabs";
import type {
  ExtractorSlotShortage,
  Job,
  TaxSegment,
  TickSnapshot,
} from "@/lib/calculateFastestWayToGoal";
import { historyRangeStart, type HistoryWindow } from "@/lib/history-window";

type OverviewTab = "compact" | "detailed";

export type OverviewProps = {
  actionTicks: TickSnapshot[];
  logTicks: TickSnapshot[];
  steps: Job[];
  maxTick: number;
  currentTick: number;
  historyWindow?: HistoryWindow;
  hasPlan: boolean;
  exportJson?: string;
  exportPlanSlot?: number;
  onImportPlan?: (imported: { plan: PlanEntry[]; taxes: TaxSegment[] }) => void;
  parseImportPlan?: (json: string) =>
    | { ok: true; plan: PlanEntry[]; taxes: TaxSegment[] }
    | { ok: false; error: string };
  onEditJob?: (planEntryId: string | undefined) => void;
  slotShortage?: ExtractorSlotShortage | null;
  resetSources?: ResetPlanSource[];
  onResetPlan?: (sourceId: string) => void;
  taxes?: TaxSegment[];
  onAddSnapshot?: () => void;
  onApplyTaxes?: (taxes: TaxSegment[]) => void;
  isLivePlan?: boolean;
  onSetLivePlan?: () => void;
  inspectTick?: number | null;
  onInspectTick?: (tick: number) => void;
};

export function Overview({
  actionTicks,
  logTicks,
  steps,
  maxTick,
  currentTick,
  historyWindow = "recent",
  hasPlan,
  exportJson,
  exportPlanSlot,
  onImportPlan,
  parseImportPlan,
  onEditJob,
  slotShortage = null,
  resetSources,
  onResetPlan,
  taxes = [],
  onAddSnapshot,
  onApplyTaxes,
  isLivePlan = false,
  onSetLivePlan,
  inspectTick = null,
  onInspectTick,
}: OverviewProps) {
  const [tab, setTab] = useState<OverviewTab>("compact");
  const historyStart = historyRangeStart(currentTick, historyWindow);
  const visibleLogTicks = useMemo(
    () => (historyStart <= 0 ? logTicks : logTicks.filter((t) => t.tick >= historyStart)),
    [logTicks, historyStart],
  );

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value === "compact" || value === "detailed") setTab(value);
        }}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <TabsList>
              <TabsTrigger value="compact">Kompakt</TabsTrigger>
              <TabsTrigger value="detailed">Detailliert</TabsTrigger>
            </TabsList>
            {onApplyTaxes && (
              <TaxesDialog taxes={taxes} currentTick={currentTick} onApply={onApplyTaxes} />
            )}
            {onAddSnapshot && (
              <Button type="button" variant="outline" onClick={onAddSnapshot}>
                <Crosshair data-icon="inline-start" />
                Stand setzen
              </Button>
            )}
            {slotShortage && (
              <p role="alert" className="min-w-0 truncate text-xs text-destructive">
                Zu wenig Asteroidenplätze: {slotShortage.extractors} Extraktoren, aber nur{" "}
                {slotShortage.slots} Plätze ({slotShortage.asteroids}{" "}
                {slotShortage.asteroids === 1 ? "Asteroid" : "Asteroiden"}).{" "}
                {slotShortage.unslotted}{" "}
                {slotShortage.unslotted === 1 ? "Extraktor steht" : "Extraktoren stehen"} ohne
                Platz und {slotShortage.unslotted === 1 ? "liefert" : "liefern"} keine Rohstoffe
                {slotShortage.asteroidsNeeded > 0
                  ? ` — es ${
                      slotShortage.asteroidsNeeded === 1
                        ? "fehlt 1 Asteroid"
                        : `fehlen ${slotShortage.asteroidsNeeded} Asteroiden`
                    }.`
                  : "."}
              </p>
            )}
          </div>
          {exportJson !== undefined && (
            <div className="flex shrink-0 items-center gap-1">
              {onSetLivePlan &&
                (isLivePlan ? (
                  <span className="inline-flex h-7 items-center gap-1.5 px-2 text-xs font-medium text-green-500">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    Aktiver Plan
                  </span>
                ) : (
                  <Button type="button" variant="ghost" onClick={onSetLivePlan}>
                    <CircleDot data-icon="inline-start" />
                    Als aktiv setzen
                  </Button>
                ))}
              <Separator orientation="vertical" className="mx-1 my-2" />
              {parseImportPlan && onImportPlan && (
                <ImportPlanDialog parse={parseImportPlan} onReplace={onImportPlan} />
              )}
              <ExportPlanDialog json={exportJson} planSlot={exportPlanSlot ?? 1} />
              {resetSources && onResetPlan && (
                <ResetPlanDialog sources={resetSources} onReset={onResetPlan} />
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-b border-border">
          <Timeline
            steps={steps}
            ticks={logTicks}
            maxTick={maxTick}
            historyStartTick={historyStart}
            currentTick={currentTick}
            inspectTick={inspectTick}
            hasPlan={hasPlan}
            isActive
            onEditJob={onEditJob}
            onInspectTick={onInspectTick}
          />
        </div>

        <TabsContent
          value="compact"
          className="min-h-0 flex-1 overflow-hidden data-hidden:hidden"
        >
          <ActionPlan
            ticks={actionTicks}
            currentTick={currentTick}
            inspectTick={inspectTick}
            hasPlan={hasPlan}
            isActive={tab === "compact"}
          />
        </TabsContent>

        <TabsContent
          value="detailed"
          className="min-h-0 flex-1 overflow-hidden data-hidden:hidden"
        >
          {tab === "detailed" ? (
            <Protocol
              ticks={visibleLogTicks}
              currentTick={currentTick}
              inspectTick={inspectTick}
              hasPlan={hasPlan}
              isActive
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}
