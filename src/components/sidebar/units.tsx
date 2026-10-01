import { jobTypeClass } from "@/components/overview/actionplan.tsx";
import { ScrollArea } from "@/components/shadcn/scroll-area.tsx";
import { SidebarRow, SidebarSectionLabel } from "@/components/sidebar/sidebar-row.tsx";
import { StatusDot } from "@/components/sidebar/status-dot.tsx";
import { formatRes } from "@/lib/calculate-fastest-way-to-goal.ts";
import { type Defense } from "@/lib/gn-data/defense.ts";
import { type Ship } from "@/lib/gn-data/ships.ts";
import { type Utility } from "@/lib/gn-data/utility.ts";

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

function UnitRows({ items, planned, onAdd }: { items: Buildable[]; planned: Set<string>; onAdd: (name: string) => void }) {
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
              {item.dependencies.some((dep) => !planned.has(dep)) ? <StatusDot kind="blocked" /> : null}
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
