import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { StatusDot } from "@/components/sidebar/status-dot";

export type ResourcesProps = {
  hasObservatorium: boolean;
  hasExtraktorTech: boolean;
  roidBlocked?: boolean;
  onAddEconomy: (preset?: {
    asteroids?: number;
    extractorsMet?: number;
    extractorsKris?: number;
  }) => void;
  onAddRoid: () => void;
};

export function Resources({
  hasObservatorium,
  hasExtraktorTech,
  roidBlocked = false,
  onAddEconomy,
  onAddRoid,
}: ResourcesProps) {
  const economyBlocked = !hasObservatorium && !hasExtraktorTech;

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 p-3">
        <Card
          size="sm"
          role="button"
          tabIndex={0}
          className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onAddEconomy()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onAddEconomy();
            }
          }}
        >
          <CardHeader>
            <CardTitle>
              Asteroiden scannen & Extraktoren bauen
              {economyBlocked ? <StatusDot kind="blocked" /> : null}
            </CardTitle>
            <CardDescription>
              Asteroiden scannen und/oder Extraktoren bauen — einzeln oder kombiniert.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card
          size="sm"
          role="button"
          tabIndex={0}
          className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onAddRoid()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onAddRoid();
            }
          }}
        >
          <CardHeader>
            <CardTitle>
              Roid
              {roidBlocked ? <StatusDot kind="blocked" /> : null}
            </CardTitle>
            <CardDescription>
              Extraktoren erbeuten — 10% der Ziel-Exen pro Tick, kostenlos.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </ScrollArea>
  );
}
