import { AvailableTechs } from "@/components/sidebar/available-techs";
import { PlannedTechs } from "@/components/sidebar/planned-techs";
import type { PlanResult, StartConfig } from "@/lib/calculateFastestWayToGoal";
import type { TechTreeEntry } from "@/types/gn";

export type TechProps = {
  unlocked: TechTreeEntry[];
  planNames: string[];
  techByName: Map<string, TechTreeEntry>;
  plan: PlanResult | null;
  startCfg: StartConfig;
  onAdd: (name: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
};

export function Tech({
  unlocked,
  planNames,
  techByName,
  plan,
  startCfg,
  onAdd,
  onMove,
  onRemove,
}: TechProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-2">
      <AvailableTechs unlocked={unlocked} onAdd={onAdd} />
      <PlannedTechs
        planNames={planNames}
        techByName={techByName}
        plan={plan}
        startCfg={startCfg}
        onMove={onMove}
        onRemove={onRemove}
      />
    </div>
  );
}
