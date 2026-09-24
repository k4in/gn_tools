import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/shadcn/input";
import { formatNumber } from "@/components/kampfwerte/format";
import { combatUnits, type CombatUnit, type CombatUnitName } from "@/gn-data/kampfwerte";
import { cn } from "@/lib/utils/cn";

/**
 * Trennlinie zwischen Geschützen und Schiffen, wie in der Matrix. Sitzt mittig
 * im Spaltenabstand, damit die erste Schiffsspalte nicht schmaler wird.
 */
const DIVIDER_LEFT =
  "relative before:absolute before:inset-y-0 before:-left-1 before:border-l before:border-l-foreground/25";

/**
 * Gewicht je Schiffsart für eine ausgeglichene Flotte: Budget = Grundbudget ×
 * Multiplikator. Das Grundbudget ergibt sich aus den Sculptor, z. B. 3 Mio. in
 * Sculptor → 2 Mio. je Schiffsart mit Multiplikator 1.
 */
const MULTIPLIER: Partial<Record<CombatUnitName, number>> = {
  Sculptor: 1.5,
  Fornax: 1.3,
  Draco: 1.3,
  // Nur ohne Jäger und Bomber, sonst richten sich die Träger nach deren Anzahl.
  Zenit: 0.25,
  Cancri: 0.25,
  Cleptor: 1.4,
};

/** Jäger und Bomber fliegen im Zenit, 100 je Träger, mit 2,5-facher Reserve. */
const CARRIED: CombatUnitName[] = ["Leo", "Aquilae"];
const CARRIER_CAPACITY = 100;
const CARRIER_RESERVE = 2.5;

const DEFAULT_SCULPTORS = 3;

const defenseCount = combatUnits.filter((u) => u.kind === "defense").length;

function startsGroup(index: number) {
  return index > 0 && combatUnits[index - 1].kind !== combatUnits[index].kind;
}

const sculptor = combatUnits.find((u) => u.name === "Sculptor")!;

/** Stückzahlen der aktiven Schiffsarten, ausgehend von der Sculptor-Anzahl. */
function fleetCounts(active: CombatUnit[], sculptors: number) {
  const base = (sculptors * sculptor.total) / MULTIPLIER.Sculptor!;
  const counts = new Map<CombatUnitName, number>();
  for (const unit of active) {
    if (unit.name === "Sculptor") counts.set(unit.name, sculptors);
    else counts.set(unit.name, Math.round((base * (MULTIPLIER[unit.name] ?? 1)) / unit.total));
  }
  // Träger nach den aktiven Jägern und Bombern statt nach Ressourcen.
  const carried = CARRIED.reduce((sum, name) => sum + (counts.get(name) ?? 0), 0);
  if (counts.has("Zenit") && carried > 0) {
    counts.set("Zenit", Math.ceil((carried * CARRIER_RESERVE) / CARRIER_CAPACITY));
  }
  return counts;
}

/**
 * Flotte per Klick zusammenstellen: Über jeder Schiffsspalte ein Schalter,
 * darunter alle Einheiten als Ziele. Getroffene Ziele werden grün und zeigen
 * den zerstörten Baukostenwert je Tick, der Rest bleibt rot.
 */
export function FleetBuilder() {
  const [fleet, setFleet] = useState<Set<CombatUnitName>>(new Set());
  const [sculptors, setSculptors] = useState(DEFAULT_SCULPTORS);

  const toggle = (name: CombatUnitName) =>
    setFleet((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  const active = combatUnits.filter((u) => fleet.has(u.name));
  const counts = fleetCounts(active, sculptors);
  const fleetValue = active.reduce((sum, u) => sum + (counts.get(u.name) ?? 0) * u.total, 0);
  const carrierMissing = !fleet.has("Zenit") && CARRIED.some((name) => fleet.has(name));
  /** Zerstörter Wert je Tick, null wenn keine aktive Schiffsart das Ziel beschießt. */
  const valueOn = (target: CombatUnit) => {
    const shots = active.flatMap((shooter) => {
      const shot = shooter.shots.find((s) => s.target === target.name);
      return shot ? [(counts.get(shooter.name) ?? 0) * shot.perTick * shot.share * target.total] : [];
    });
    return shots.length > 0 ? shots.reduce((sum, v) => sum + v, 0) : null;
  };

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div>
        <h2 className="font-heading text-base font-semibold tracking-tight">Flotte zusammenstellen</h2>
        <p className="mt-1 max-w-3xl text-xs/relaxed text-muted-foreground">
          Schiffe oben aktivieren und die Anzahl Sculptor eintragen. Daraus ergibt sich, wie viele
          der übrigen Schiffe eine ausgeglichene Flotte braucht (gleiche Baukosten je Schiffsart,
          Sculptor × 1,5, Fornax und Draco × 1,3, Cleptor × 1,4, Cancri × 0,25). Zenit richten sich nach den aktiven Jägern und
          Bombern (2,5 × Anzahl ÷ 100), ohne sie gilt × 0,25. Ziele, die die Flotte abschießt, werden grün und zeigen den zerstörten
          Baukostenwert je Tick. Angenommen ist, dass alle Ziele eines Schiffs anwesend sind, ohne
          Restfeuer.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Gesamtkosten der Flotte (Metall + Kristall):{" "}
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatNumber(fleetValue)}
        </span>
      </p>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[1100px] gap-x-2 gap-y-1.5 text-xs"
          style={{ gridTemplateColumns: `repeat(${combatUnits.length}, minmax(0, 1fr))` }}
        >
          <div
            style={{ gridColumn: `span ${defenseCount}` }}
            className="flex items-end justify-center pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            Geschütze
          </div>
          {combatUnits.map((unit, i) => {
            if (unit.kind !== "ship") return null;
            const on = fleet.has(unit.name);
            return (
              <div key={unit.name} className={cn("flex flex-col gap-1", startsGroup(i) && DIVIDER_LEFT)}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(unit.name)}
                  className={cn(
                    "w-full rounded-md border px-1 py-1 text-[11px] font-medium transition-colors",
                    on
                      ? "border-foreground/60 bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {unit.name}
                </button>
                {unit.name === "Sculptor" ? (
                  <Input
                    type="number"
                    min={0}
                    value={sculptors}
                    aria-label="Anzahl Sculptor"
                    onChange={(e) => setSculptors(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                    className="h-6 px-1.5 text-center tabular-nums"
                  />
                ) : on ? (
                  <span className="flex h-6 items-center justify-center text-[11px] text-muted-foreground tabular-nums">
                    {formatNumber(counts.get(unit.name) ?? 0)} Stück
                  </span>
                ) : null}
              </div>
            );
          })}

          {combatUnits.map((unit, i) => {
            const value = valueOn(unit);
            const hit = value !== null;
            return (
              <div key={unit.name} className={cn(startsGroup(i) && DIVIDER_LEFT)}>
                <div
                  className={cn(
                    "flex h-full min-h-14 flex-col gap-1 rounded-md border px-1 py-1.5 transition-colors",
                    active.length === 0
                      ? "border-border text-muted-foreground"
                      : hit
                        ? "border-green-500/40 bg-green-500/10"
                        : "border-destructive/40 bg-destructive/10",
                  )}
                >
                  <span
                    className={cn(
                      "text-center text-[11px] font-medium",
                      active.length > 0 && (hit ? "text-green-500" : "text-destructive"),
                    )}
                  >
                    {unit.name}
                  </span>
                  {hit ? (
                    <span className="text-center text-[11px] font-medium tabular-nums">
                      {formatNumber(Math.round(value))}
                      <span className="block text-[9px] font-normal text-muted-foreground">
                        Wert je Tick
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {carrierMissing ? (
        <div className="flex gap-2 rounded-md border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-xs text-yellow-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <p>Leo und Aquilae fliegen nur im Zenit. Ohne Träger greifen sie nicht an.</p>
        </div>
      ) : null}
    </section>
  );
}
