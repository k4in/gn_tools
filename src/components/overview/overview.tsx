import { ActionPlan } from "@/components/overview/actionplan";
import { Protocol } from "@/components/overview/protocol";
import { Timeline } from "@/components/overview/timeline";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shadcn/tabs";
import type { Job, TickSnapshot } from "@/lib/calculateFastestWayToGoal";

export type OverviewProps = {
  actionTicks: TickSnapshot[];
  logTicks: TickSnapshot[];
  steps: Job[];
  maxTick: number;
  currentTick: number;
  hasPlan: boolean;
};

export function Overview({
  actionTicks,
  logTicks,
  steps,
  maxTick,
  currentTick,
  hasPlan,
}: OverviewProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs defaultValue="timeline" className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        <div className="shrink-0 border-b border-border px-3 py-2">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="log">Tick-Protokoll</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="timeline"
          className="flex min-h-0 flex-1 flex-col overflow-hidden data-hidden:hidden"
        >
          <div className="min-h-0 flex-[2] overflow-hidden border-b border-border">
            <Timeline steps={steps} maxTick={maxTick} hasPlan={hasPlan} />
          </div>
          <div className="min-h-0 flex-[3] overflow-auto">
            <ActionPlan ticks={actionTicks} currentTick={currentTick} hasPlan={hasPlan} />
          </div>
        </TabsContent>

        <TabsContent
          value="log"
          className="min-h-0 flex-1 overflow-auto data-hidden:hidden"
        >
          <Protocol ticks={logTicks} currentTick={currentTick} hasPlan={hasPlan} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
