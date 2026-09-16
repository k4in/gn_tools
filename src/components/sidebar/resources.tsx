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
  onAddCatastrophe: () => void;
};

export function Resources({
  hasObservatorium,
  hasExtraktorTech,
  roidBlocked = false,
  onAddEconomy,
  onAddRoid,
  onAddCatastrophe,
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
              Extraktoren bei einem Angriff in 1-10 Ticks erbeuten
            </CardDescription>
          </CardHeader>
        </Card>
        <Card
          size="sm"
          role="button"
          tabIndex={0}
          className="cursor-pointer bg-destructive/10 text-destructive ring-destructive/40 transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 dark:bg-destructive/20 dark:hover:bg-destructive/30"
          onClick={() => onAddCatastrophe()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onAddCatastrophe();
            }
          }}
        >
          <CardHeader>
            <CardTitle>Katastrophe</CardTitle>
            <CardDescription className="text-destructive/70">
              Extraktorenverlust bei Angriff
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </ScrollArea>
  );
}
