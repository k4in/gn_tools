import type { ReactNode } from "react";
import { KillMatrix } from "@/components/kampfwerte/kill-matrix";
import { UnitTable } from "@/components/kampfwerte/unit-table";
import { formatNumber, ratioHue } from "@/components/kampfwerte/format";
import {
  STANDARD_VALUE_RATIO,
  combatDefenses,
  combatShips,
  combatUnits,
  valueRatio,
} from "@/gn-data/kampfwerte";

const SECTIONS = [
  { id: "erklaerung", label: "Erklärung" },
  { id: "schiffe", label: "Schiffe" },
  { id: "geschuetze", label: "Geschütze" },
  { id: "matrix", label: "Matrix" },
  { id: "beispiel", label: "Beispiel" },
] as const;

const EXPLANATIONS: { title: string; text: ReactNode }[] = [
  {
    title: "Je Tick",
    text: (
      <>
        So viele Ziele zerstört <em>eine</em> Einheit pro Kampftick, wenn von ihren Zielen nur
        dieser eine Typ im Kampf ist. 100 Fornax gegen reine Horus: 100 × 4,5 = 450 Horus pro
        Tick.
      </>
    ),
  },
  {
    title: "Verteilung",
    text: (
      <>
        Sind alle gelisteten Ziele im Kampf, teilt sich das Feuer nach diesen Anteilen auf. Fehlen
        einzelne Ziele, werden die Anteile auf die anwesenden hochgerechnet (Annahme).
      </>
    ),
  },
  {
    title: "Restfeuer",
    text: (
      <>
        Schützen, deren Ziele schon zerstört sind oder die keine ganze Einheit mehr schaffen,
        feuern mit voller Kraft auf die übrigen gültigen Ziele. Siehe Beispiel unten.
      </>
    ),
  },
  {
    title: "Vorfeuer",
    text: (
      <>
        Manche Geschütze schießen schon 1–2 Ticks vor dem Kampf auf anfliegende Flotten, mit
        verringerter Wirksamkeit. „T−1 · 50 %“ heißt: einen Tick vorher mit halber Kraft.
      </>
    ),
  },
  {
    title: "Träger",
    text: (
      <>
        Leo und Aquilae greifen nur im Zenit an, 100 je Träger. Wird der Zenit abgeschossen,
        stirbt die Ladung mit.
      </>
    ),
  },
  {
    title: "Wertquote",
    text: (
      <>
        Zerstörter Baukostenwert je eingesetzter Kosteneinheit pro Tick, bei 100 % Feuer auf das
        Ziel. Fast alle Paarungen liegen bei <strong>0,40</strong>. Darunter ist das Ziel zäher,
        als seine Kosten vermuten lassen.
      </>
    ),
  },
];

const exceptions = combatUnits
  .flatMap((shooter) =>
    shooter.shots.map((shot) => ({
      shooter: shooter.name,
      target: shot.target,
      ratio: valueRatio(shooter, shot),
    })),
  )
  // Kleine Abweichungen (z. B. 0,391) sind Rundung der Quellwerte, keine echten Ausnahmen.
  .filter((e) => e.ratio < STANDARD_VALUE_RATIO - 0.015)
  .sort((a, b) => a.ratio - b.ratio);

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-3xl text-xs/relaxed text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-foreground tabular-nums">
      {children}
    </code>
  );
}

export function KampfwertePage() {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-6 border-b border-border px-6 py-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Kampfwerte</h1>
          <p className="text-xs text-muted-foreground">
            Ziele, Feuerverteilung und Vorfeuer aller Schiffe und Geschütze · Quelle:
            GN-Hilfesystem (Kampfsystem)
          </p>
        </div>
        <nav aria-label="Abschnitte" className="flex items-center gap-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {section.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-6 py-8">
          <Section id="erklaerung" title="So liest du die Werte">
            <div className="grid grid-cols-3 gap-3">
              {EXPLANATIONS.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-card/40 p-4">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    {item.title}
                  </div>
                  <p className="mt-1.5 text-xs/relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="schiffe"
            title="Schiffe"
            description="Bauzeit in Ticks (15 Minuten), Kosten in Metall und Kristall. Pro Ziel: zerstörte Einheiten je Schiff und Tick sowie der Anteil bei voller Feuerverteilung."
          >
            <UnitTable units={combatShips} />
          </Section>

          <Section
            id="geschuetze"
            title="Geschütze"
            description="Geschütze verteidigen nur. Vorfeuer trifft anfliegende Flotten schon vor dem eigentlichen Kampf."
          >
            <UnitTable units={combatDefenses} showPreFire />
          </Section>

          <Section
            id="matrix"
            title="Abschuss-Matrix"
            description="Oben in jeder Zelle: zerstörte Ziele je Schütze und Tick. Darunter die Wertquote. Die Farbe zeigt, wie effizient die Paarung ist."
          >
            <div className="mb-3 flex items-center gap-3 text-[11px] text-muted-foreground">
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
            <KillMatrix />

            <div className="mt-6 grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-6">
              <div>
                <h3 className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Ausnahmen unter 0,40
                </h3>
                <ul className="mt-2 flex flex-col divide-y divide-border/60 text-xs tabular-nums">
                  {exceptions.map((e) => (
                    <li key={`${e.shooter}-${e.target}`} className="flex justify-between py-1.5">
                      <span>
                        {e.shooter} <span className="text-muted-foreground">→</span> {e.target}
                      </span>
                      <span style={{ color: `oklch(0.8 0.13 ${ratioHue(e.ratio)})` }}>
                        {formatNumber(e.ratio, 3)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="self-start text-xs/relaxed text-muted-foreground">
                Die Kampfwerte sind so gewählt, dass fast jede Paarung pro Tick rund 40 % der
                eigenen Baukosten an gegnerischem Wert zerstört. Die Ausnahmen betreffen vor allem
                Zenit und Cancri: Diese Ziele halten mehr aus, als ihre Kosten vermuten lassen.
                Wer sie beschießt, verbraucht also mehr Rohstoffe pro zerstörtem Wert.
              </p>
            </div>
          </Section>

          <Section
            id="beispiel"
            title="Beispiel: Feuerverteilung und Restfeuer"
            description="Aus dem GN-Hilfesystem: 2500 Horus gegen 200 Draco und 1500 Cleptor."
          >
            <ol className="flex max-w-3xl flex-col gap-3 text-xs/relaxed">
              <li className="flex gap-3">
                <span className="text-muted-foreground tabular-nums">1</span>
                <span>
                  Feuer teilt sich 40 / 60: <Formula>2500 × 0,0114 × 0,4 = 11,4</Formula> → 11
                  Draco, <Formula>2500 × 0,32 × 0,6 = 480</Formula> → 480 Cleptor.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground tabular-nums">2</span>
                <span>
                  Dafür verbraucht: <Formula>11 / 0,0114 ≈ 965</Formula> plus{" "}
                  <Formula>480 / 0,32 = 1500</Formula> Horus. Rest ≈ 35 Horus.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground tabular-nums">3</span>
                <span>
                  35 Horus schaffen keinen ganzen Draco mehr, also 100 % auf Cleptor:{" "}
                  <Formula>35 × 0,32 ≈ 11</Formula>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-muted-foreground tabular-nums">4</span>
                <span>
                  Ergebnis: <strong>11 Draco</strong> und <strong>491 Cleptor</strong> zerstört.
                </span>
              </li>
            </ol>
          </Section>
        </div>
      </div>
    </main>
  );
}
