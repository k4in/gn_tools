import { Badge } from "@/components/shadcn/badge";
import {
  PLAN_SLOT_IDS,
  isPlanSlotId,
  planSlotLabel,
  planTemplates,
  type PlanSlotId,
} from "@/gn-data/plan";

export type PlanViewId = PlanSlotId | string;

export type PlanSwitcherProps = {
  viewId: PlanViewId;
  livePlanId?: PlanSlotId | null;
  onViewChange: (viewId: PlanViewId) => void;
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
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Templates:
        </span>
        {planTemplates.map((template) => {
          const active = !isPlanSlotId(viewId) && viewId === template.id;
          return (
            <Badge
              key={template.id}
              variant={active ? "default" : "outline"}
              render={<button type="button" aria-pressed={active} />}
              onClick={() => onViewChange(template.id)}
            >
              {template.label}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
