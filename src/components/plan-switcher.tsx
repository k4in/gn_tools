import { Badge } from "@/components/shadcn/badge";
import { planTemplates } from "@/gn-data/plan";

export const MY_PLAN_VIEW = "mine";

export type PlanViewId = typeof MY_PLAN_VIEW | string;

export type PlanSwitcherProps = {
  viewId: PlanViewId;
  onViewChange: (viewId: PlanViewId) => void;
};

export function PlanSwitcher({ viewId, onViewChange }: PlanSwitcherProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-1.5">
      <Badge
        variant={viewId === MY_PLAN_VIEW ? "default" : "outline"}
        render={<button type="button" aria-pressed={viewId === MY_PLAN_VIEW} />}
        onClick={() => onViewChange(MY_PLAN_VIEW)}
      >
        Mein Plan
      </Badge>
      <span className="pl-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        Templates:
      </span>
      {planTemplates.map((template) => {
        const active = viewId === template.id;
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
  );
}
