import { TickTable } from "@/components/overview/actionplan";
import type { TickSnapshot } from "@/lib/calculateFastestWayToGoal";

export type ProtocolProps = {
  ticks: TickSnapshot[];
  currentTick: number;
  hasPlan: boolean;
  isActive?: boolean;
};

export function Protocol({ ticks, currentTick, hasPlan, isActive = false }: ProtocolProps) {
  if (!hasPlan) {
    return <p className="p-4 text-sm text-muted-foreground">Kein Plan berechenbar.</p>;
  }
  return <TickTable ticks={ticks} currentTick={currentTick} isActive={isActive} />;
}
