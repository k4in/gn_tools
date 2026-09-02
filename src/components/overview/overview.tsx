import { useState } from "react";
import { ExportPlanDialog } from "@/components/export-plan-dialog";
import { ImportPlanDialog } from "@/components/import-plan-dialog";
import { ResetPlanDialog, type ResetPlanSource } from "@/components/reset-plan-dialog";
import { TaxesDialog } from "@/components/taxes-dialog";
import type { PlanEntry } from "@/gn-data/plan";
import { ActionPlan } from "@/components/overview/actionplan";
import { Protocol } from "@/components/overview/protocol";
import { Timeline } from "@/components/overview/timeline";
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

type OverviewTab = "timeline" | "log";

export type OverviewProps = {
  actionTicks: TickSnapshot[];
  logTicks: TickSnapshot[];
  steps: Job[];
  maxTick: number;
  currentTick: number;
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
  onApplyTaxes?: (taxes: TaxSegment[]) => void;
};

export function Overview({
  actionTicks,
  logTicks,
  steps,
  maxTick,
  currentTick,
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
  onApplyTaxes,
}: OverviewProps) {
  const [tab, setTab] = useState<OverviewTab>("timeline");

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value === "timeline" || value === "log") setTab(value);
        }}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="log">Tick-Protokoll</TabsTrigger>
            </TabsList>
            {onApplyTaxes && (
              <TaxesDialog taxes={taxes} currentTick={currentTick} onApply={onApplyTaxes} />
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
            <div className="flex shrink-0 gap-2">
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

        <TabsContent
          value="timeline"
          className="flex min-h-0 flex-1 flex-col overflow-hidden data-hidden:hidden"
        >
          <div className="flex min-h-0 flex-[2] flex-col overflow-hidden border-b border-border">
            <Timeline
              steps={steps}
              maxTick={maxTick}
              currentTick={currentTick}
              hasPlan={hasPlan}
              isActive={tab === "timeline"}
              onEditJob={onEditJob}
            />
          </div>
          <div className="min-h-0 flex-[3] overflow-auto">
            <ActionPlan
              ticks={actionTicks}
              currentTick={currentTick}
              hasPlan={hasPlan}
              isActive={tab === "timeline"}
            />
          </div>
        </TabsContent>

        <TabsContent
          value="log"
          className="min-h-0 flex-1 overflow-auto data-hidden:hidden"
        >
          <Protocol
            ticks={logTicks}
            currentTick={currentTick}
            hasPlan={hasPlan}
            isActive={tab === "log"}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
