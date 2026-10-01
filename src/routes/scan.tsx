import { createFileRoute } from "@tanstack/react-router";

import { ScanLayout } from "@/components/scan/scan-layout.tsx";

export const Route = createFileRoute("/scan")({ component: ScanLayout });
