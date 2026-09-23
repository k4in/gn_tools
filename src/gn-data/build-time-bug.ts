/**
 * Workaround für einen Bug im Spiel (Stand 2026-09): Schiffe, Geschütze,
 * Scanverstärker und EloKa-Satelliten (Scanblocker) brauchen 1 Tick länger
 * als in den Spieldaten angegeben.
 *
 * Die Daten in ships.ts / defense.ts / utility.ts bleiben unverändert. Der Aufschlag wird
 * nur beim Laden im Planer angewendet (calculateFastestWayToGoal.ts).
 *
 * Entfernen, sobald der Bug behoben ist: EXTRA_UNIT_BUILD_TICKS auf 0 setzen,
 * oder diese Datei samt den withUnitBuildBug-Aufrufen löschen.
 */
export const EXTRA_UNIT_BUILD_TICKS = 1;

export function withUnitBuildBug<T extends { ticks: number }>(unit: T): T {
  return { ...unit, ticks: unit.ticks + EXTRA_UNIT_BUILD_TICKS };
}
