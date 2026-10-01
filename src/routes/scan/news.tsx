import { createFileRoute } from "@tanstack/react-router";

import { NewsScanPage } from "@/components/scan/news-scan-page.tsx";

export const Route = createFileRoute("/scan/news")({ component: NewsScanPage });
