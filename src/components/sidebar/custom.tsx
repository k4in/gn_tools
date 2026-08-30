import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { ScrollArea } from "@/components/shadcn/scroll-area";

export type CustomProps = {
  onAddCustom: () => void;
};

export function Custom({ onAddCustom }: CustomProps) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 p-3">
        <Card
          size="sm"
          role="button"
          tabIndex={0}
          className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onAddCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onAddCustom();
            }
          }}
        >
          <CardHeader>
            <CardTitle>Custom-Ausgabe</CardTitle>
            <CardDescription>
              Beliebige Ressourcen-Kosten mit eigenem Label und Start-Tick einplanen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </ScrollArea>
  );
}
