import { createRootRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell.tsx";

export const Route = createRootRoute({ component: AppShell });
