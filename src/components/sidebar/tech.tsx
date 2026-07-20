import { AvailableTechs } from "@/components/sidebar/available-techs";
import type { TechTreeEntry } from "@/gn-data/techtree";

export type TechProps = {
  unlocked: TechTreeEntry[];
  onAdd: (name: string) => void;
};

export function Tech({ unlocked, onAdd }: TechProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AvailableTechs unlocked={unlocked} onAdd={onAdd} />
    </div>
  );
}
