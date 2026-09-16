import { Badge } from "@/components/shadcn/badge";
import {
  PLAN_SLOT_IDS,
  planSlotLabel,
  type PlanSlotId,
} from "@/gn-data/plan";

export type PlanSwitcherProps = {
  viewId: PlanSlotId;
  livePlanId?: PlanSlotId | null;
  onViewChange: (viewId: PlanSlotId) => void;
};

export function PlanSwitcher({ viewId, livePlanId = null, onViewChange }: PlanSwitcherProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-1.5">
      {PLAN_SLOT_IDS.map((id) => {
        const active = viewId === id;
        return (
          <Badge
            key={id}
            variant={active ? "default" : "outline"}
            render={<button type="button" aria-pressed={active} />}
            onClick={() => onViewChange(id)}
          >
            {livePlanId === id ? `${planSlotLabel(id)} - aktiv` : planSlotLabel(id)}
          </Badge>
        );
      })}
    </div>
  );
}
