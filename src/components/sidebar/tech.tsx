import { AvailableTechs } from "@/components/sidebar/available-techs";
import type { TechTreeEntry } from "@/gn-data/techtree";

export type TechProps = {
  techs: TechTreeEntry[];
  needed: Set<string>;
  planned: Set<string>;
  onAdd: (name: string) => void;
};

export function Tech({ techs, needed, planned, onAdd }: TechProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AvailableTechs techs={techs} needed={needed} planned={planned} onAdd={onAdd} />
    </div>
  );
}
