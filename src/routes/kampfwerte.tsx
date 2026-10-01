import { createFileRoute } from "@tanstack/react-router";

import { KampfwertePage } from "@/components/kampfwerte/kampfwerte-page.tsx";

export const Route = createFileRoute("/kampfwerte")({ component: KampfwertePage });
