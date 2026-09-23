import { jobTypeClass } from "@/components/overview/actionplan";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { SidebarRow, SidebarSectionLabel } from "@/components/sidebar/sidebar-row";
import { StatusDot } from "@/components/sidebar/status-dot";

export type EconomyProps = {
  hasObservatorium: boolean;
  hasExtraktorTech: boolean;
  roidBlocked?: boolean;
  hasInterstellarerHandel: boolean;
  onAddEconomy: (preset?: {
    asteroids?: number;
    extractorsMet?: number;
    extractorsKris?: number;
  }) => void;
  onAddRoid: () => void;
  onAddCatastrophe: () => void;
  onAddCustom: () => void;
  onAddTrade: () => void;
};

/** Extraktoren, Angriffe und freie Posten (Handel, Custom) in einem Tab. */
export function Economy({
  hasObservatorium,
  hasExtraktorTech,
  roidBlocked = false,
  hasInterstellarerHandel,
  onAddEconomy,
  onAddRoid,
  onAddCatastrophe,
  onAddCustom,
  onAddTrade,
}: EconomyProps) {
  const economyBlocked = !hasObservatorium && !hasExtraktorTech;

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="pb-2">
        <SidebarSectionLabel>Extraktoren</SidebarSectionLabel>
        <ul className="flex flex-col px-1.5">
          <SidebarRow
            onClick={() => onAddEconomy()}
            titleClassName={jobTypeClass("economy")}
            title={
              <>
                Asteroiden & Extraktoren
                {economyBlocked ? <StatusDot kind="blocked" /> : null}
              </>
            }
            meta="Asteroiden scannen und/oder Exen bauen"
          />
          <SidebarRow
            onClick={onAddRoid}
            titleClassName={jobTypeClass("roid")}
            title={
              <>
                Roid
                {roidBlocked ? <StatusDot kind="blocked" /> : null}
              </>
            }
            meta="Exen bei einem Angriff in 1–10 Ticks erbeuten"
          />
          <SidebarRow
            onClick={onAddCatastrophe}
            tone="destructive"
            titleClassName={jobTypeClass("catastrophe")}
            title="Katastrophe"
            meta="Extraktorenverlust bei Angriff"
          />
        </ul>
        <SidebarSectionLabel>Handel & Sonstiges</SidebarSectionLabel>
        <ul className="flex flex-col px-1.5">
          <SidebarRow
            onClick={onAddTrade}
            titleClassName={jobTypeClass("trade")}
            title={
              <>
                Trade
                {hasInterstellarerHandel ? null : <StatusDot kind="blocked" />}
              </>
            }
            meta="Rohstoffe mit Spielern oder Galaxie tauschen"
          />
          <SidebarRow
            onClick={onAddCustom}
            titleClassName={jobTypeClass("custom")}
            title="Custom-Ausgabe"
            meta="Beliebige Kosten mit eigenem Label"
          />
        </ul>
      </div>
    </ScrollArea>
  );
}
