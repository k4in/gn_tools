import { Outlet } from "@tanstack/react-router";
import { AppRail } from "@/components/app-rail.tsx";
import { TooltipProvider } from "@/components/shadcn/tooltip.tsx";

/** App-Rahmen: Tool-Navigation links (mobil oben), die aktive Route füllt den Rest. */
export function AppShell() {
  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-background text-foreground max-md:flex-col max-md:*:min-h-0">
        <AppRail />
        <Outlet />
      </div>
    </TooltipProvider>
  );
}
