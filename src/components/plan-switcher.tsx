import {
  PLAN_SLOT_IDS,
  planSlotLabel,
  type PlanSlotId,
} from "@/gn-data/plan";
import { cn } from "@/lib/utils/cn";

export type PlanSwitcherProps = {
  viewId: PlanSlotId;
  livePlanId?: PlanSlotId | null;
  onViewChange: (viewId: PlanSlotId) => void;
};

export function PlanSwitcher({ viewId, livePlanId = null, onViewChange }: PlanSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Plan"
      className="inline-flex h-8 items-center rounded-lg bg-muted p-[3px]"
    >
      {PLAN_SLOT_IDS.map((id) => {
        const active = viewId === id;
        const live = livePlanId === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            title={live ? `${planSlotLabel(id)} – aktiver Plan` : planSlotLabel(id)}
            onClick={() => onViewChange(id)}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md border border-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "border-input bg-input/30 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {planSlotLabel(id)}
            {live ? (
              <span aria-label="aktiv" className="size-1.5 rounded-full bg-green-500" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
