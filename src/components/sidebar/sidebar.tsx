import { Recon } from "@/components/sidebar/recon";
import { Resources } from "@/components/sidebar/resources";
import { Tech } from "@/components/sidebar/tech";
import { Units } from "@/components/sidebar/units";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shadcn/tabs";
import type {
  EconomyOrder,
  PlanResult,
  StartConfig,
} from "@/lib/calculateFastestWayToGoal";
import type { TechTreeEntry } from "@/gn-data/techtree";

export type SidebarProps = {
  unlocked: TechTreeEntry[];
  plan: PlanResult | null;
  startCfg: StartConfig;
  canUseUnits: boolean;
  hasObservatorium: boolean;
  economyOrders: EconomyOrder[];
  defaultEconomyTick: number;
  maxExtractorsAtTech: number;
  onAddTech: (name: string) => void;
  onAddOrder: (order: EconomyOrder) => void;
  onRemoveOrder: (id: string) => void;
};

export function Sidebar({
  unlocked,
  plan,
  startCfg,
  canUseUnits,
  hasObservatorium,
  economyOrders,
  defaultEconomyTick,
  maxExtractorsAtTech,
  onAddTech,
  onAddOrder,
  onRemoveOrder,
}: SidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-border">
      <Tabs defaultValue="tech" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="border-b border-border px-3 py-2">
          <TabsList>
            <TabsTrigger value="tech">Tech</TabsTrigger>
            <TabsTrigger value="resources">Extraktoren</TabsTrigger>
            <TabsTrigger value="units">Einheiten</TabsTrigger>
            <TabsTrigger value="recon">Aufklärung</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="tech"
          className="flex min-h-0 flex-1 flex-col gap-0 data-hidden:hidden"
        >
          <Tech unlocked={unlocked} onAdd={onAddTech} />
        </TabsContent>

        <TabsContent
          value="resources"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Resources
            canUse={canUseUnits}
            hasObservatorium={hasObservatorium}
            economyOrders={economyOrders}
            plan={plan}
            startCfg={startCfg}
            defaultTick={defaultEconomyTick}
            maxExtractorsAtTech={maxExtractorsAtTech}
            onAddOrder={onAddOrder}
            onRemoveOrder={onRemoveOrder}
          />
        </TabsContent>

        <TabsContent
          value="units"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Units />
        </TabsContent>

        <TabsContent
          value="recon"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Recon />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
