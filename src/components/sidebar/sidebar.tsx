import { Economy } from "@/components/sidebar/economy";
import { Legend } from "@/components/sidebar/legend";
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

const PANEL_CLASS = "flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden";

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
    <aside className="flex min-h-0 flex-col border-r border-border bg-sidebar/40">
      <Tabs defaultValue="tech" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
          <TabsList className="w-full">
            <TabsTrigger value="tech">Tech</TabsTrigger>
            <TabsTrigger value="units">Einheiten</TabsTrigger>
            <TabsTrigger value="economy">Wirtschaft</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tech" className={PANEL_CLASS}>
          <Tech techs={techs} needed={neededTechs} planned={plannedTechs} onAdd={onAddTech} />
        </TabsContent>

        <TabsContent value="units" className={PANEL_CLASS}>
          <Units
            ships={ships}
            defenses={defenses}
            recon={recon}
            planned={plannedTechs}
            onAdd={onAddUnit}
            onAddRecon={onAddRecon}
          />
        </TabsContent>

        <TabsContent value="economy" className={PANEL_CLASS}>
          <Economy
            hasObservatorium={hasObservatorium}
            hasExtraktorTech={hasExtraktorTech}
            roidBlocked={roidBlocked}
            hasInterstellarerHandel={hasInterstellarerHandel}
            onAddEconomy={onAddEconomy}
            onAddRoid={onAddRoid}
            onAddCatastrophe={onAddCatastrophe}
            onAddCustom={onAddCustom}
            onAddTrade={onAddTrade}
          />
        </TabsContent>
      </Tabs>
      <Legend />
    </aside>
  );
}
