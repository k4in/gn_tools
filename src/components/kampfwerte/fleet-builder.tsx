import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { combatUnits, type CombatUnit, type CombatUnitName } from "@/lib/gn-data/kampfwerte.ts";
import { cn } from "@/lib/utils/cn.ts";

/**
 * Trennlinie zwischen Geschützen und Schiffen, wie in der Matrix. Sitzt mittig
 * im Spaltenabstand, damit die erste Schiffsspalte nicht schmaler wird.
 */
const DIVIDER_LEFT = "relative before:absolute before:inset-y-0 before:-left-1 before:border-l before:border-l-foreground/25";

/** Jäger und Bomber fliegen im Zenit. */
const CARRIED: CombatUnitName[] = ["Leo", "Aquilae"];

const defenseCount = combatUnits.filter((u) => u.kind === "defense").length;

function startsGroup(index: number) {
  return index > 0 && combatUnits[index - 1].kind !== combatUnits[index].kind;
}

/**
 * Flotte per Klick zusammenstellen: Über jeder Schiffsspalte ein Schalter,
 * darunter alle Einheiten als Ziele. Ziele, die eines der gewählten Schiffe
 * angreift, werden grün, der Rest bleibt rot.
 */
export function FleetBuilder() {
  const [fleet, setFleet] = useState<Set<CombatUnitName>>(new Set());

  function toggle(name: CombatUnitName) {
    return setFleet((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }

  const active = combatUnits.filter((u) => fleet.has(u.name));
  const carrierMissing = !fleet.has("Zenit") && CARRIED.some((name) => fleet.has(name));
  /** Gewählte Schiffe, die das Ziel angreifen. */
  function shootersOf(target: CombatUnit) {
    return active.filter((shooter) => shooter.shots.some((s) => s.target === target.name));
  }

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div>
        <h2 className="font-heading text-base font-semibold tracking-tight">Flotte zusammenstellen</h2>
        <p className="mt-1 max-w-3xl text-xs/relaxed text-muted-foreground">
          Schiffe oben anklicken. Ziele, die die gewählten Schiffe angreifen, werden grün, alle anderen rot.
        </p>
      </div>

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
              <div key={unit.name} className={cn(startsGroup(i) && DIVIDER_LEFT)}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(unit.name)}
                  className={cn(
                    "w-full rounded-md border px-1 py-1 text-[11px] font-medium transition-colors",
                    on
                      ? "border-foreground/60 bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {unit.name}
                </button>
              </div>
            );
          })}

          {combatUnits.map((unit, i) => {
            const shooters = shootersOf(unit);
            const hit = shooters.length > 0;
            return (
              <div key={unit.name} className={cn(startsGroup(i) && DIVIDER_LEFT)}>
                <div
                  className={cn(
                    "flex h-full min-h-14 flex-col gap-1 rounded-md border px-1 py-1.5 transition-colors",
                    active.length === 0
                      ? "border-border text-muted-foreground"
                      : hit
                        ? "border-green-500/40 bg-green-500/10"
                        : "border-destructive/40 bg-destructive/10"
                  )}
                >
                  <span
                    className={cn(
                      "text-center text-[11px] font-medium",
                      active.length > 0 && (hit ? "text-green-500" : "text-destructive")
                    )}
                  >
                    {unit.name}
                  </span>
                  {hit ? (
                    <span className="text-center text-[9px] text-muted-foreground">von {shooters.map((s) => s.name).join(", ")}</span>
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
