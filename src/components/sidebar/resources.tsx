import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { ScrollArea } from "@/components/shadcn/scroll-area";

export type ResourcesProps = {
  hasObservatorium: boolean;
  hasExtraktorTech: boolean;
  onAddEconomy: (preset?: {
    asteroids?: number;
    extractors?: number;
    resource?: "met" | "kris";
  }) => void;
  onAddRoid: () => void;
};

export function Resources({
  hasObservatorium,
  hasExtraktorTech,
  onAddEconomy,
  onAddRoid,
}: ResourcesProps) {
  if (!hasExtraktorTech && !hasObservatorium) {
    return (
      <div className="flex flex-1 items-start p-4">
        <p className="text-sm text-muted-foreground">
          Noch gesperrt — füge zuerst{" "}
          <span className="font-medium text-foreground">Observatorium</span> und{" "}
          <span className="font-medium text-foreground">Extraktor</span> im Tech-Plan
          hinzu.
        </p>
      </div>
    );
  }

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
            <CardTitle>Asteroiden scannen & Extraktoren bauen</CardTitle>
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
            <CardTitle>Roid</CardTitle>
            <CardDescription>
              Extraktoren erbeuten — 10% der Ziel-Exen pro Tick, kostenlos.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </ScrollArea>
  );
}
