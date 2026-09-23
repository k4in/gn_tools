import { jobTypeClass } from "@/components/overview/actionplan";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { SidebarRow, SidebarSectionLabel } from "@/components/sidebar/sidebar-row";
import { StatusDot } from "@/components/sidebar/status-dot";
import { formatRes } from "@/lib/calculateFastestWayToGoal";
import type { Defense } from "@/gn-data/defense";
import type { Ship } from "@/gn-data/ships";
import type { Utility } from "@/gn-data/utility";

export type UnitsProps = {
  ships: Ship[];
  defenses: Defense[];
  recon: Utility[];
  planned: Set<string>;
  onAdd: (name: string) => void;
  onAddRecon: (name: string) => void;
};

type Buildable = {
  name: string;
  ticks: number;
  cost: { met: number; kris: number };
  dependencies: string[];
};

function UnitRows({
  items,
  planned,
  onAdd,
}: {
  items: Buildable[];
  planned: Set<string>;
  onAdd: (name: string) => void;
}) {
  return (
    <ul className="flex flex-col px-1.5">
      {items.map((item) => (
        <SidebarRow
          key={item.name}
          onClick={() => onAdd(item.name)}
          titleClassName={jobTypeClass("unit")}
          title={
            <>
              {item.name}
              {item.dependencies.some((dep) => !planned.has(dep)) ? (
                <StatusDot kind="blocked" />
              ) : null}
            </>
          }
          meta={`${item.ticks} T · ${formatRes(item.cost.met)} M · ${formatRes(item.cost.kris)} K`}
        />
      ))}
    </ul>
  );
}

export function Units({ ships, defenses, recon, planned, onAdd, onAddRecon }: UnitsProps) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="pb-2">
        <SidebarSectionLabel>Raumschiffe</SidebarSectionLabel>
        <UnitRows items={ships} planned={planned} onAdd={onAdd} />
        <SidebarSectionLabel>Geschütze</SidebarSectionLabel>
        <UnitRows items={defenses} planned={planned} onAdd={onAdd} />
        <SidebarSectionLabel>Aufklärung</SidebarSectionLabel>
        <UnitRows items={recon} planned={planned} onAdd={onAddRecon} />
      </div>
    </ScrollArea>
  );
}
