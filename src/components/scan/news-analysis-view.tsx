import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/shadcn/input";
import {
  ARTILLERY,
  ARTILLERY_TICKS,
  NEWS_TICK_MS,
  analyzeNews,
  combatEnd,
  combatStart,
  coordsKey,
  fleetLabel,
  type Fleet,
  type NewsAnalysis,
} from "@/lib/news-analysis";
import type { NewsScan } from "@/lib/scan-parser";
import { cn } from "@/lib/utils/cn";

const pad = (n: number) => String(n).padStart(2, "0");

function formatClock(time: number) {
  const d = new Date(time);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(time: number) {
  const d = new Date(time);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Rollenfarben: Angreifer grün, Verteidiger rot (destructive). */
const ROLE_TEXT = { attacker: "text-green-500", defender: "text-destructive" } as const;
const ROLE_BAR = { attacker: "bg-green-500", defender: "bg-destructive" } as const;

/** „2:7 k4in“ in Rollenfarbe, „Flotte 1“ grau. */
function FleetName({ fleet, className }: { fleet: Fleet; className?: string }) {
  return (
    <span className={className}>
      <span className={cn("font-medium", ROLE_TEXT[fleet.role])}>
        {coordsKey(fleet)} {fleet.player}
      </span>
      {fleet.fleet !== null ? (
        <span className="text-muted-foreground"> Flotte {fleet.fleet}</span>
      ) : null}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function OrbitInput({ fleet, onChange }: { fleet: Fleet; onChange: (ticks: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Input
        type="number"
        min={1}
        max={fleet.maxCombatTicks}
        value={fleet.combatTicks}
        disabled={fleet.recalled}
        aria-label={`Ticks im Orbit für ${fleetLabel(fleet)}`}
        onChange={(event) => {
          const n = Math.floor(Number(event.target.value));
          if (Number.isFinite(n)) onChange(Math.min(fleet.maxCombatTicks, Math.max(1, n)));
        }}
        className="h-7 w-16 tabular-nums"
      />
      <span>/ {fleet.maxCombatTicks}</span>
    </label>
  );
}

/** Flotten mit Ankunft, Kampfzeit und einstellbarer Dauer im Orbit. */
function FleetTable({
  fleets,
  onTicksChange,
}: {
  fleets: Fleet[];
  onTicksChange: (fleetId: string, ticks: number) => void;
}) {
  return (
    <table className="mt-2 w-full text-xs tabular-nums">
      <thead className="text-[11px] text-muted-foreground">
        <tr className="border-b border-border">
          <th className="py-1 text-left font-normal">Flotte</th>
          <th className="py-1 text-left font-normal">Ankunft</th>
          <th className="py-1 text-left font-normal">Kampf</th>
          <th className="py-1 text-left font-normal">Ticks im Orbit</th>
        </tr>
      </thead>
      <tbody>
        {fleets.map((f) => (
          <tr key={f.id} className="border-b border-border/50 last:border-b-0">
            <td className={cn("py-1.5", f.recalled && "opacity-40")}>
              <FleetName fleet={f} className={cn(f.recalled && "line-through")} />
            </td>
            <td className={cn("py-1.5", f.recalled && "opacity-40")}>{formatClock(f.arrival)}</td>
            <td className={cn("py-1.5", f.recalled && "opacity-40")}>
              {f.recalled ? "zurückgezogen" : `${formatClock(f.firstCombat)}–${formatClock(f.lastCombat)}`}
            </td>
            <td className="py-1.5">
              <OrbitInput fleet={f} onChange={(ticks) => onTicksChange(f.id, ticks)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Artillerie-Ticks blau, zum Kampf hin kräftiger (Blau der Roids im Planer). */
const ARTILLERY_CLASS: Record<number, string> = { 2: "bg-blue-400/25", 1: "bg-blue-400/50" };

/**
 * Nur der Kampf: ein Puffer-Tick, die Artillerie-Ticks, dann vom ersten bis zum
 * letzten Kampftick der Angreifer und ein Puffer-Tick danach. Flugzeiten und
 * Verteidiger vor bzw. nach dem Kampf sind egal.
 */
function Timeline({ analysis }: { analysis: NewsAnalysis }) {
  const fleets = analysis.fleets;
  if (fleets.length === 0) return null;
  const firstTick = combatStart(analysis) ?? Math.min(...fleets.map((f) => f.firstCombat));
  const endTick = combatEnd(analysis) ?? Math.max(...fleets.map((f) => f.lastCombat + NEWS_TICK_MS));
  const start = firstTick - (ARTILLERY_TICKS + 1) * NEWS_TICK_MS;
  const end = endTick + NEWS_TICK_MS;
  const span = end - start;
  const pct = (t: number) => ((Math.min(Math.max(t, start), end) - start) / span) * 100;
  const bar = (from: number, to: number) => ({ left: `${pct(from)}%`, width: `${pct(to) - pct(from)}%` });

  // Markierter Bereich: Kampfzeitraum aller Angreifer.
  const window = combatStart(analysis) !== null ? { from: firstTick, to: endTick } : null;

  const tickCount = Math.round(span / NEWS_TICK_MS);
  const labelEvery = tickCount <= 16 ? 1 : tickCount <= 32 ? 2 : 4;
  const ticks: number[] = [];
  for (let t = start; t <= end; t += NEWS_TICK_MS) ticks.push(t);

  /** Tick-Raster und markierter Bereich, je Zeile gezeichnet, damit die Label-Spalte frei bleibt. */
  const background = (
    <>
      {ticks.map((t) => (
        <div key={t} className="absolute inset-y-0 w-px bg-border/40" style={{ left: `${pct(t)}%` }} />
      ))}
      {window ? (
        <div
          className="absolute inset-y-0 border-x border-foreground/30 bg-foreground/5"
          style={bar(window.from, window.to)}
        />
      ) : null}
    </>
  );

  return (
    <div className="mt-2 flex flex-col">
      {fleets.map((f) => {
        // Balken nur innerhalb des Kampfes; die Puffer-Ticks bleiben leer.
        const from = Math.max(f.firstCombat, firstTick);
        const to = Math.min(f.lastCombat + NEWS_TICK_MS, endTick);
        const visible = to > from;
        return (
          <div key={f.id} className="flex items-stretch">
            <div
              className={cn("flex w-56 shrink-0 items-center pr-3 text-[11px]", f.recalled && "opacity-40")}
              title={fleetLabel(f)}
            >
              <FleetName fleet={f} className={cn("block min-w-0 truncate", f.recalled && "line-through")} />
            </div>
            <div className={cn("relative h-8 flex-1", f.recalled && "opacity-40")}>
              {background}
              {f.role === "attacker" && !f.recalled
                ? ARTILLERY.map((a) => {
                    const t = f.firstCombat - a.ticksBefore * NEWS_TICK_MS;
                    return (
                      <div
                        key={a.ticksBefore}
                        className={cn("absolute inset-y-1", ARTILLERY_CLASS[a.ticksBefore])}
                        style={bar(t, t + NEWS_TICK_MS)}
                        title={`Artillerie ${formatClock(t)}: ${a.guns.join(", ")}`}
                      />
                    );
                  })
                : null}
              {visible ? (
                <div
                  className={cn("absolute inset-y-1 rounded-sm opacity-80", ROLE_BAR[f.role])}
                  style={bar(from, to)}
                  title={`Kampf ${formatClock(f.firstCombat)}–${formatClock(f.lastCombat)}`}
                />
              ) : (
                <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-muted-foreground">
                  nicht im Kampfzeitraum
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex">
        <div className="w-56 shrink-0" />
        <div className="relative h-5 flex-1 border-t border-border">
          {ticks.map((t, i) =>
            i % labelEvery === 0 ? (
              <span
                key={t}
                className="absolute top-1 -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums"
                style={{ left: `${pct(t)}%` }}
              >
                {formatClock(t)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {ARTILLERY.map((a) => (
          <span key={a.ticksBefore} className="inline-flex items-center gap-1.5">
            <span className={cn("size-3 rounded-[2px]", ARTILLERY_CLASS[a.ticksBefore])} />
            Artillerie T−{a.ticksBefore}: {a.guns.join(", ")}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[2px] border border-foreground/30 bg-foreground/5" />
          Kampfzeitraum
        </span>
      </div>
    </div>
  );
}

export type NewsViewState = {
  /** Ticks im Orbit je Flotten-ID; fehlt ein Eintrag, gilt das Maximum. */
  fleetTicks: Record<string, number>;
  retreatChoices: Record<string, string[]>;
};

export function NewsAnalysisView({
  news,
  state,
  onChange,
}: {
  news: NewsScan;
  state: NewsViewState;
  onChange: (next: NewsViewState) => void;
}) {
  const analysis = analyzeNews(news, state.fleetTicks, state.retreatChoices);
  const openRetreats = analysis.retreats.filter((r) => !r.automatic && r.candidates.length > 1);
  const start = combatStart(analysis);
  const end = combatEnd(analysis);

  return (
    <div className="flex flex-col gap-5">
      {openRetreats.map((r) => (
        <div
          key={r.id}
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs",
            r.unresolved
              ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-300"
              : "border-border text-muted-foreground",
          )}
        >
          {r.unresolved ? <TriangleAlert className="size-3.5 shrink-0" /> : null}
          <span>
            Rückzug von {coordsKey(r)} {r.player} um {formatClock(r.time)}: Welche Flotte?
          </span>
          {r.candidates.map((f) => {
            const selected = r.recalled === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  // Ein Rückzug gilt für genau eine Flotte; nochmal klicken hebt die Auswahl auf.
                  const next = selected ? [] : [f.id];
                  onChange({ ...state, retreatChoices: { ...state.retreatChoices, [r.id]: next } });
                }}
                className={cn(
                  "rounded-md border px-2 py-0.5 font-medium transition-colors",
                  selected
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f.fleet !== null ? `Flotte ${f.fleet}` : fleetLabel(f)} ({formatClock(f.departure)})
              </button>
            );
          })}
        </div>
      ))}

      {analysis.fleets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Keine Angriffe oder Verteidigungen in den letzten 10 Stunden.
        </p>
      ) : (
        <>
          <section>
            <SectionLabel>Flotten</SectionLabel>
            <FleetTable
              fleets={analysis.fleets}
              onTicksChange={(fleetId, ticks) =>
                onChange({ ...state, fleetTicks: { ...state.fleetTicks, [fleetId]: ticks } })
              }
            />
          </section>

          <section>
            <SectionLabel>
              Zeitleiste
              {start !== null && end !== null ? (
                <span className="ml-1.5 font-normal tracking-normal normal-case">
                  · Kampf {formatDateTime(start)} – {formatClock(end - NEWS_TICK_MS)}
                </span>
              ) : null}
            </SectionLabel>
            <Timeline analysis={analysis} />
          </section>
        </>
      )}
    </div>
  );
}
