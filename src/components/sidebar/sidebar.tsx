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
import type { TechTreeEntry } from "@/gn-data/techtree";
import type { Ship } from "@/gn-data/ships";
import type { Utility } from "@/gn-data/utility";

export type SidebarProps = {
  unlocked: TechTreeEntry[];
  availableShips: Ship[];
  availableRecon: Utility[];
  hasObservatorium: boolean;
  hasExtraktorTech: boolean;
  onAddTech: (name: string) => void;
  onAddUnit: (name: string) => void;
  onAddRecon: (name: string) => void;
  onAddAsteroids: () => void;
  onAddExtractors: (resource?: "met" | "kris") => void;
};

export function Sidebar({
  unlocked,
  availableShips,
  availableRecon,
  hasObservatorium,
  hasExtraktorTech,
  onAddTech,
  onAddUnit,
  onAddRecon,
  onAddAsteroids,
  onAddExtractors,
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
            hasObservatorium={hasObservatorium}
            hasExtraktorTech={hasExtraktorTech}
            onAddAsteroids={onAddAsteroids}
            onAddExtractors={onAddExtractors}
          />
        </TabsContent>

        <TabsContent
          value="units"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Units ships={availableShips} onAdd={onAddUnit} />
        </TabsContent>

        <TabsContent
          value="recon"
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden data-hidden:hidden"
        >
          <Recon items={availableRecon} onAdd={onAddRecon} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
