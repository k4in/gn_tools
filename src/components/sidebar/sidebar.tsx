import { Economy } from "@/components/sidebar/economy.tsx";
import { Legend } from "@/components/sidebar/legend.tsx";
import { Tech } from "@/components/sidebar/tech.tsx";
import { Units } from "@/components/sidebar/units.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs.tsx";
import { type Defense } from "@/lib/gn-data/defense.ts";
import { type TechTreeEntry } from "@/lib/gn-data/techtree.ts";
import { type Ship } from "@/lib/gn-data/ships.ts";
import { type Utility } from "@/lib/gn-data/utility.ts";

export type SidebarProps = {
  techs: TechTreeEntry[];
  neededTechs: Set<string>;
  plannedTechs: Set<string>;
  ships: Ship[];
  defenses: Defense[];
  recon: Utility[];
  hasObservatorium: boolean;
  hasExtraktorTech: boolean;
  attackBlocked?: boolean;
  onAddTech: (name: string) => void;
  onAddUnit: (name: string) => void;
  onAddRecon: (name: string) => void;
  onAddEconomy: (preset?: { asteroids?: number; extractorsMet?: number; extractorsKris?: number }) => void;
  onAddCatastrophe: () => void;
  onAddAttack: () => void;
  onAddCustom: () => void;
  onAddTrade: () => void;
  hasInterstellarerHandel: boolean;
  /** Quereinstieg: Einheiten und Wirtschaft ohne „Voraussetzung fehlt“-Markierung. */
  ignoreMissingDeps?: boolean;
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
  attackBlocked = false,
  onAddTech,
  onAddUnit,
  onAddRecon,
  onAddEconomy,
  onAddCatastrophe,
  onAddAttack,
  onAddCustom,
  onAddTrade,
  hasInterstellarerHandel,
  ignoreMissingDeps = false,
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
            ignoreMissingDeps={ignoreMissingDeps}
            onAdd={onAddUnit}
            onAddRecon={onAddRecon}
          />
        </TabsContent>

        <TabsContent value="economy" className={PANEL_CLASS}>
          <Economy
            hasObservatorium={hasObservatorium}
            hasExtraktorTech={hasExtraktorTech}
            attackBlocked={attackBlocked}
            hasInterstellarerHandel={hasInterstellarerHandel}
            ignoreMissingDeps={ignoreMissingDeps}
            onAddEconomy={onAddEconomy}
            onAddCatastrophe={onAddCatastrophe}
            onAddAttack={onAddAttack}
            onAddCustom={onAddCustom}
            onAddTrade={onAddTrade}
          />
        </TabsContent>
      </Tabs>
      <Legend />
    </aside>
  );
}
