import type { ComponentType } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { CalendarClock, ScanText, Swords } from "lucide-react";
import { InfoDialog } from "@/components/info-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { cn } from "@/lib/utils/cn";

type RailTool = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: LinkProps["to"];
};

const TOOLS: RailTool[] = [
  { label: "Planer", icon: CalendarClock, to: "/" },
  { label: "Scan-Auswertung", icon: ScanText, to: "/scan" },
  { label: "Kampfwerte-Matrix", icon: Swords, to: "/kampfwerte" },
];

const ITEM_CLASS =
  "relative flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** App-weite Tool-Navigation. */
export function AppRail() {
  return (
    <nav
      aria-label="Tools"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-3"
    >
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <Tooltip key={tool.label}>
            <TooltipTrigger
              render={
                <Link
                  to={tool.to}
                  aria-label={tool.label}
                  activeOptions={{ exact: true }}
                  className={cn(
                    ITEM_CLASS,
                    "hover:bg-muted/60 hover:text-foreground",
                    "data-[status=active]:bg-muted data-[status=active]:text-foreground",
                    "data-[status=active]:before:absolute data-[status=active]:before:top-2 data-[status=active]:before:bottom-2 data-[status=active]:before:-left-2 data-[status=active]:before:w-0.5 data-[status=active]:before:rounded-full data-[status=active]:before:bg-primary",
                  )}
                />
              }
            >
              <Icon className="size-5" />
            </TooltipTrigger>
            <TooltipContent side="right">{tool.label}</TooltipContent>
          </Tooltip>
        );
      })}
      <div className="mt-auto">
        <InfoDialog />
      </div>
    </nav>
  );
}
