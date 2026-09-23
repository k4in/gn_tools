import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { KillMatrix } from "@/components/kampfwerte/kill-matrix";
import { ratioHue } from "@/components/kampfwerte/format";

const HELPSYS_URL = "https://galaxy-network.de/helpsys";

function Formula({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-foreground tabular-nums">
      {children}
    </code>
  );
}

export function KampfwertePage() {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Kampfwerte-Matrix</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Oben in jeder Zelle: zerstörte Ziele je Schütze und Kampftick. Darunter die Wertquote.
          </p>
          <div className="mt-4 flex max-w-3xl flex-col gap-2 text-xs/relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Wertquote</span>{" "}
              <Formula>Abschüsse je Tick × Kosten Ziel ÷ Kosten Schütze</Formula>
            </p>
            <p>
              Gibt an, wie viel Baukostenwert ein Schütze pro Kampftick zerstört, gemessen an seinen
              eigenen Baukosten, bei 100 % Feuer auf dieses Ziel. Beispiel Fornax → Horus:{" "}
              <Formula>4,5 × 2.000 ÷ 22.500 = 0,400</Formula>. Fast alle Paarungen liegen bei 0,40.
              Werte darunter heißen: Das Ziel hält mehr aus, als seine Kosten vermuten lassen.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <KillMatrix />

          <div className="flex items-center justify-between gap-6">
            <a
              href={HELPSYS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              Alle Kampfwerte, Kosten und Regeln im Galaxy-Network-Hilfesystem
            </a>
            <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
              <span>Wertquote</span>
              <span
                className="h-2 w-40 rounded-full"
                style={{
                  background: `linear-gradient(to right, oklch(0.7 0.14 ${ratioHue(0.14)}), oklch(0.7 0.14 ${ratioHue(0.27)}), oklch(0.7 0.14 ${ratioHue(0.4)}))`,
                }}
              />
              <span className="tabular-nums">0,14 ineffizient</span>
              <span>·</span>
              <span className="tabular-nums">0,40 Richtwert</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
