import { createFileRoute } from "@tanstack/react-router";

import { PointsAnalysisPage } from "@/components/scan/points-analysis-page.tsx";

export const Route = createFileRoute("/scan/sektor")({ component: PointsAnalysisPage });
