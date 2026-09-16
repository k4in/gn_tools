import { Custom } from "@/components/sidebar/custom";
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
import type { Defense } from "@/gn-data/defense";
import type { TechTreeEntry } from "@/gn-data/techtree";
import type { Ship } from "@/gn-data/ships";
import type { Utility } from "@/gn-data/utility";

export type SidebarProps = {
  techs: TechTreeEntry[];
  neededTechs: Set<string>;
  plannedTechs: Set<string>;
  ships: Ship[];
  defenses: Defense[];
  recon: Utility[];
  hasObservatorium: boolean;
  hasExtraktorTech: boolean;
  roidBlocked?: boolean;
  onAddTech: (name: string) => void;
  onAddUnit: (name: string) => void;
  onAddRecon: (name: string) => void;
  onAddEconomy: (preset?: {
    asteroids?: number;
    extractorsMet?: number;
    extractorsKris?: number;
  }) => void;
  onAddRoid: () => void;
  onAddCatastrophe: () => void;
  onAddCustom: () => void;
  onAddTrade: () => void;
  hasInterstellarerHandel: boolean;
};

export function Sidebar({
  techs,
  neededTechs,
  plannedTechs,
  ships,
  defenses,
  recon,
  hasObservatorium,
  hasExtraktorTech,
  roidBlocked = false,
  onAddTech,
  onAddUnit,
  onAddRecon,
  onAddEconomy,
  onAddRoid,
  onAddCatastrophe,
  onAddCustom,
  onAddTrade,
  hasInterstellarerHandel,
}: SidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-border">
      <Tabs defaultValue="tech" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="border-b border-border px-3 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="tech">Tech</TabsTrigger>
            <TabsTrigger value="resources">Extraktoren</TabsTrigger>
            <TabsTrigger value="units">Einheiten</TabsTrigger>
            <TabsTrigger value="recon">Aufklärung</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="tech"
          className="flex min-h-0 flex-1 flex-col gap-0 data-hidden:hidden"
        >
          <Tech techs={techs} needed={neededTechs} planned={plannedTechs} onAdd={onAddTech} />
        </TabsContent>

        <TabsContent
          value="resources"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Resources
            hasObservatorium={hasObservatorium}
            hasExtraktorTech={hasExtraktorTech}
            roidBlocked={roidBlocked}
            onAddEconomy={onAddEconomy}
            onAddRoid={onAddRoid}
            onAddCatastrophe={onAddCatastrophe}
          />
        </TabsContent>

        <TabsContent
          value="units"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Units ships={ships} defenses={defenses} planned={plannedTechs} onAdd={onAddUnit} />
        </TabsContent>

        <TabsContent
          value="recon"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Recon items={recon} planned={plannedTechs} onAdd={onAddRecon} />
        </TabsContent>

        <TabsContent
          value="custom"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Custom onAddCustom={onAddCustom} onAddTrade={onAddTrade} hasInterstellarerHandel={hasInterstellarerHandel} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
