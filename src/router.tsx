import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import App from "@/App";
import { AppShell } from "@/components/app-shell";
import { KampfwertePage } from "@/components/kampfwerte/kampfwerte-page";
import { NewsScanPage } from "@/components/scan/news-scan-page";
import { PointsAnalysisPage } from "@/components/scan/points-analysis-page";
import { ScanLayout } from "@/components/scan/scan-layout";

const rootRoute = createRootRoute({ component: AppShell });

/** Startplan (bisher: Bauplaner) bleibt die Startseite. */
const startplanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: App,
});

const kampfwerteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kampfwerte",
  component: KampfwertePage,
});

const scanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scan",
  component: ScanLayout,
});

/** /scan öffnet die Newsscan-Analyse. */
const scanIndexRoute = createRoute({
  getParentRoute: () => scanRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/scan/news", replace: true });
  },
});

const scanNewsRoute = createRoute({
  getParentRoute: () => scanRoute,
  path: "news",
  component: NewsScanPage,
});

const scanSektorRoute = createRoute({
  getParentRoute: () => scanRoute,
  path: "sektor",
  component: PointsAnalysisPage,
});

const routeTree = rootRoute.addChildren([
  startplanRoute,
  kampfwerteRoute,
  scanRoute.addChildren([scanIndexRoute, scanNewsRoute, scanSektorRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
