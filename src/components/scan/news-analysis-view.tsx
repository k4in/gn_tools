import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/shadcn/input";
import { Separator } from "@/components/shadcn/separator";
import {
  ARTILLERY,
  ARTILLERY_TICKS,
  DEFENSE_FLIGHT_TICKS_OTHER_GALAXY,
  DEFENSE_FLIGHT_TICKS_SAME_GALAXY,
  NEWS_TICK_MS,
  analyzeNews,
  combatEnd,
  combatStart,
  coordsKey,
  defenseDeadline,
  fleetLabel,
  type DefenseTiming,
  type Fleet,
  type NewsAnalysis,
} from "@/lib/news-analysis";
import type { NewsScan } from "@/lib/scan-parser";
import { useNow } from "@/lib/use-now";
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

/** „1:05 h“ bzw. „22 min“, angefangene Minuten aufgerundet. */
function formatDuration(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}:${pad(m)} h` : `${m} min`;
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

/**
 * Flotten einer Seite mit Ankunft, Kampfzeit und einstellbarer Dauer im Orbit;
 * bei Angreifern zusätzlich, bis wann sie deffbar sind.
 */
function FleetTable({
  fleets,
  attackers,
  now,
  onTicksChange,
}: {
  fleets: Fleet[];
  attackers: boolean;
  now: number;
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
          {attackers && DEFENSE_TYPES.map((d) => (
            <th key={d.label} className="py-1 text-left font-normal" title={`Abflugfenster für ${d.label} (${d.flightTicks} Ticks Flugzeit)`}>
              {d.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {fleets.map((f) => (
          <tr key={f.id} className="border-b border-border/50 last:border-b-0">
            <td className="py-1.5">
              <FleetName fleet={f} />
            </td>
            <td className="py-1.5">{formatClock(f.arrival)}</td>
            <td className="py-1.5">
              {formatClock(f.firstCombat)}–{formatClock(f.lastCombat)}
            </td>
            <td className="py-1.5">
              <OrbitInput fleet={f} onChange={(ticks) => onTicksChange(f.id, ticks)} />
            </td>
            {attackers &&
              DEFENSE_TYPES.map((d) => (
                <td key={d.label} className="py-1.5">
                  <DeadlineCell attacker={f} flightTicks={d.flightTicks} now={now} />
                </td>
              ))}
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
        // Über den ganzen sichtbaren Bereich: Verteidiger, die schon vor den Angreifern im
        // Orbit sind oder danach bleiben, erscheinen auch in den Ticks davor bzw. danach.
        const from = Math.max(f.firstCombat, start);
        const to = Math.min(f.lastCombat + NEWS_TICK_MS, end);
        const visible = to > from;
        return (
          <div key={f.id} className="flex items-stretch">
            <div className="flex w-56 shrink-0 items-center pr-3 text-[11px]" title={fleetLabel(f)}>
              <FleetName fleet={f} className="block min-w-0 truncate" />
            </div>
            <div className="relative h-8 flex-1">
              {background}
              {f.role === "attacker"
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

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionLabel>{label}</SectionLabel>
      <span className="text-sm font-medium tabular-nums">{children}</span>
    </div>
  );
}

/** Rot: noch rechtzeitig verteidigbar, gelb: nur noch verspätet, grün: nicht mehr. */
const TIMING_CLASS: Record<DefenseTiming, string> = {
  onTime: "text-destructive",
  late: "text-yellow-300",
  tooLate: "text-green-500",
};

const TIMING_HINT: Record<DefenseTiming, string> = {
  onTime: "Bei Abflug jetzt noch rechtzeitig zum ersten Kampftick.",
  late: "Bei Abflug jetzt verpasst die Verteidigung den ersten Kampftick, kämpft aber noch mit.",
  tooLate: "Bei Abflug jetzt ist die Angriffsflotte schon weg.",
};

const DEFENSE_TYPES = [
  { label: "Galaxie-Deff", header: "Deffbar bis (Galaxie)", flightTicks: DEFENSE_FLIGHT_TICKS_SAME_GALAXY },
  { label: "Meta-Deff", header: "Deffbar bis (Meta)", flightTicks: DEFENSE_FLIGHT_TICKS_OTHER_GALAXY },
] as const;

/**
 * Abflugfenster gegen eine Angriffsflotte: vom Beginn des letzten Ticks, der noch
 * rechtzeitig ankommt, bis zum Ende des letzten Ticks, der noch mitkämpft. Ein
 * Abflug zählt ab dem Tick, in dem er liegt; Tick-Ende ist dessen letzte Minute.
 */
function DeadlineCell({ attacker, flightTicks, now }: { attacker: Fleet; flightTicks: number; now: number }) {
  const deadline = defenseDeadline(attacker, flightTicks, now);
  const onTimeFrom = formatClock(deadline.onTimeBefore - NEWS_TICK_MS);
  const onTimeTo = formatClock(deadline.onTimeBefore - 60_000);
  const late = formatClock(deadline.lateBefore - 60_000);
  return (
    <span
      className={TIMING_CLASS[deadline.timing]}
      title={`Abflug bis ${onTimeTo} (letzter Tick ${onTimeFrom}–${onTimeTo}): ab dem ersten Kampftick dabei. Bis ${late}: kämpft noch mit. ${TIMING_HINT[deadline.timing]}`}
    >
      {onTimeFrom}–{late}
    </span>
  );
}

/** Aktuelle Uhrzeit, erster Kampftick und wie viele Ticks bzw. wie lange es bis dahin noch dauert. */
function CombatClock({ now, start, end }: { now: number; start: number | null; end: number | null }) {
  // Kampfbeginn liegt auf einem Tick; bis dahin sind es so viele Tickwechsel.
  const ticksLeft = start !== null ? Math.ceil((start - now) / NEWS_TICK_MS) : 0;
  const status =
    start === null ? (
      <span className="text-muted-foreground">kein Angriff</span>
    ) : end !== null && now >= end ? (
      <span className="text-muted-foreground">Kampf vorbei</span>
    ) : (
      <span className="text-destructive">Kampf läuft</span>
    );
  const upcoming = start !== null && now < start;
  return (
    <div className="flex flex-wrap justify-between gap-x-10 gap-y-3 rounded-md border border-border px-4 py-3">
      <Stat label="Aktuelle Uhrzeit">{formatDateTime(now)}</Stat>
      <Stat label="Erster Kampftick">
        {start !== null ? formatDateTime(start) : <span className="text-muted-foreground">–</span>}
      </Stat>
      <Stat label="Ticks bis Kampfbeginn">{upcoming ? ticksLeft : status}</Stat>
      <Stat label="Zeit bis Kampfbeginn">{upcoming ? formatDuration(start - now) : status}</Stat>
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
  const now = useNow().getTime();
  const analysis = analyzeNews(news, state.fleetTicks, state.retreatChoices, now);
  const openRetreats = analysis.retreats.filter((r) => !r.automatic && r.candidates.length > 1);
  const start = combatStart(analysis);
  const end = combatEnd(analysis);

  return (
    <div className="flex flex-col gap-5">
      <CombatClock now={now} start={start} end={end} />

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

          {/* Über die ganze Breite: hebt das p-6 des Auswertungsbereichs auf. */}
          <Separator className="-mx-6 data-horizontal:w-auto" />

          {(["attacker", "defender"] as const).map((role) => {
            const fleets = analysis.fleets.filter((f) => f.role === role);
            if (fleets.length === 0) return null;
            return (
              <section key={role}>
                <SectionLabel>{role === "attacker" ? "Angreifende Flotten" : "Verteidigende Flotten"}</SectionLabel>
                <FleetTable
                  fleets={fleets}
                  attackers={role === "attacker"}
                  now={now}
                  onTicksChange={(fleetId, ticks) =>
                    onChange({ ...state, fleetTicks: { ...state.fleetTicks, [fleetId]: ticks } })
                  }
                />
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
