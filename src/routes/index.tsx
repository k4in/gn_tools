import { createFileRoute } from "@tanstack/react-router";

import { StartplanPage } from "@/components/startplan-page.tsx";

/** Startplan (bisher: Bauplaner) bleibt die Startseite. */
export const Route = createFileRoute("/")({ component: StartplanPage });
