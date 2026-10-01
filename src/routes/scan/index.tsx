import { createFileRoute, redirect } from "@tanstack/react-router";

/** /scan öffnet die Newsscan-Analyse. */
export const Route = createFileRoute("/scan/")({
  beforeLoad: () => {
    throw redirect({ to: "/scan/news", replace: true });
  },
});
