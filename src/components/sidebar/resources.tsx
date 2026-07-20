import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { ScrollArea } from "@/components/shadcn/scroll-area";

export type ResourcesProps = {
  hasObservatorium: boolean;
  hasExtraktorTech: boolean;
  onAddAsteroids: () => void;
  onAddExtractors: (resource?: "met" | "kris") => void;
};

export function Resources({
  hasObservatorium,
  hasExtraktorTech,
  onAddAsteroids,
  onAddExtractors,
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
        <Card size="sm">
          <CardHeader>
            <CardTitle>Asteroiden scannen</CardTitle>
            <CardDescription>
              {hasObservatorium
                ? "Öffnet den Plan-Dialog mit Start-Tick und Anzahl."
                : "Benötigt Observatorium im Plan."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasObservatorium}
              onClick={onAddAsteroids}
            >
              Asteroiden planen…
            </Button>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Extraktoren bauen</CardTitle>
            <CardDescription>
              {hasExtraktorTech
                ? "Kosten steigen pro Extraktor. Benötigt freie Asteroiden-Slots."
                : "Benötigt Extraktor-Tech im Plan."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasExtraktorTech}
              onClick={() => onAddExtractors("met")}
            >
              Metall…
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasExtraktorTech}
              onClick={() => onAddExtractors("kris")}
            >
              Kristall…
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
