import { createFileRoute } from "@tanstack/react-router";

import { AttackProfitPage } from "@/components/attack-profit-page.tsx";

export const Route = createFileRoute("/angriff")({ component: AttackProfitPage });
