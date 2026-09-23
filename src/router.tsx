import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import App from "@/App";
import { AppShell } from "@/components/app-shell";
import { KampfwertePage } from "@/components/kampfwerte/kampfwerte-page";
import { ScanPage } from "@/components/scan/scan-page";

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
  component: ScanPage,
});

const routeTree = rootRoute.addChildren([startplanRoute, kampfwerteRoute, scanRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
