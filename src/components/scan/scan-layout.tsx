import { useEffect } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn/tabs";

const TABS = [
  { label: "Newsscan-Analyse", to: "/scan/news" },
  { label: "Punkteanalyse", to: "/scan/sektor" },
] as const;

/** Scan-Auswertung: Tabs oben, die aktive Auswertung darunter. */
export function ScanLayout() {
  const pathname = useLocation({ select: (location) => location.pathname });
  // Der aktive Tab folgt der Route; die Tabs selbst sind Links.
  const active = TABS.find((tab) => pathname.startsWith(tab.to))?.to ?? null;

  // Scans aus der Zeit vor den getrennten Auswertungen werden verworfen.
  useEffect(() => {
    try {
      localStorage.removeItem("gn_tool.scans");
    } catch {
      // ignorieren
    }
  }, []);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <Tabs value={active} className="gap-0">
        <div className="flex h-12 shrink-0 items-center border-b border-border px-6">
          <TabsList aria-label="Auswertungen">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.to} value={tab.to} nativeButton={false} render={<Link to={tab.to} />}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <Outlet />
    </main>
  );
}
