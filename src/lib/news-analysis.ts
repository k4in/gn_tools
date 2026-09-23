import { defaults } from "@/gn-data/plan";
import type { NewsEntry, NewsScan } from "@/lib/scan-parser";

/**
 * Auswertung eines Newsscans: wann welche Flotte ankommt und in welchen Ticks
 * sie am Kampf teilnimmt.
 *
 * Abflug wird auf den letzten vollen Tick abgerundet. Ankunft = Abflug-Tick +
 * Flugzeit. Der erste Kampftick ist der Tick nach der Ankunft.
 */

/** Einträge, die älter sind als das (gemessen an der Zeitmarke des Scans), zählen nicht. */
export const NEWS_WINDOW_MS = 10 * 60 * 60 * 1000;
/** Flugzeit eines Angriffs in Ticks, ohne Ausnahme. */
export const ATTACK_FLIGHT_TICKS = 30;
/** Flugzeit einer Verteidigung in Ticks: aus derselben Galaxie wie das Ziel bzw. aus einer anderen. */
export const DEFENSE_FLIGHT_TICKS_SAME_GALAXY = 18;
export const DEFENSE_FLIGHT_TICKS_OTHER_GALAXY = 20;

/** Höchstdauer im Orbit (Kampfticks): Angreifer je Flotte, Verteidiger aus gleicher bzw. anderer Galaxie. */
export const MAX_ATTACK_COMBAT_TICKS = 5;
export const MAX_DEFENSE_TICKS_SAME_GALAXY = 29;
export const MAX_DEFENSE_TICKS_OTHER_GALAXY = 25;

/**
 * Artilleriebeschuss: Geschütze, die eine Angriffsflotte schon in den Ticks vor
 * ihrem ersten Kampftick beschießen. Nur zur Anzeige, es wird nichts berechnet.
 */
export const ARTILLERY: { ticksBefore: number; guns: string[] }[] = [
  { ticksBefore: 2, guns: ["Zitadelle", "Centurion"] },
  { ticksBefore: 1, guns: ["Zitadelle", "Centurion", "Pulsar", "Coon"] },
];
export const ARTILLERY_TICKS = Math.max(...ARTILLERY.map((a) => a.ticksBefore));

const TICK_MS = defaults.tick_minutes * 60_000;

function floorTick(time: number) {
  return Math.floor(time / TICK_MS) * TICK_MS;
}

export type Fleet = {
  /** Eindeutig je Abflug: Koordinaten, Flottennummer, Abflugzeit. */
  id: string;
  role: "attacker" | "defender";
  player: string;
  galaxy: number;
  planet: number;
  fleet: number | null;
  departure: number;
  /** Abflug abgerundet auf den vollen Tick. */
  departureTick: number;
  arrival: number;
  firstCombat: number;
  lastCombat: number;
  /** Ticks im Orbit: vom Nutzer eingestellt, sonst das Maximum. */
  combatTicks: number;
  maxCombatTicks: number;
  recalled: boolean;
};

export type Retreat = {
  id: string;
  player: string;
  galaxy: number;
  planet: number;
  time: number;
  /** Flotten dieses Spielers, die vor dem Rückzug gestartet und noch nicht zurückgezogen sind. */
  candidates: Fleet[];
  /** Die zurückgezogene Flotte; null, solange bei mehreren Kandidaten nichts gewählt ist. */
  recalled: string | null;
  /** Ohne Auswahl eindeutig: nur ein Kandidat, oder so viele Rückzüge wie Flotten. */
  automatic: boolean;
  /** Mehrere Kandidaten und noch keine Auswahl. */
  unresolved: boolean;
};

export type NewsAnalysis = {
  reference: number;
  /** Einträge innerhalb der letzten 10 Stunden vor der Zeitmarke. */
  entries: NewsEntry[];
  ignoredCount: number;
  fleets: Fleet[];
  retreats: Retreat[];
};

export function coordsKey(e: { galaxy: number; planet: number }) {
  return `${e.galaxy}:${e.planet}`;
}

export function fleetLabel(fleet: Pick<Fleet, "player" | "fleet">) {
  return fleet.fleet !== null ? `${fleet.player} Flotte ${fleet.fleet}` : fleet.player;
}

/**
 * Wertet einen Newsscan aus. `fleetTicks` enthält je Flotten-ID die eingestellte
 * Dauer im Orbit, `retreatChoices` für Rückzüge mit mehreren möglichen Flotten
 * die vom Nutzer gewählten Flotten-IDs.
 */
export function analyzeNews(
  news: NewsScan,
  fleetTicks: Record<string, number>,
  retreatChoices: Record<string, string[]>,
  now = Date.now(),
): NewsAnalysis {
  const reference = news.time ?? now;
  const entries = news.entries
    .filter((e) => e.time >= reference - NEWS_WINDOW_MS && e.time <= reference)
    .sort((a, b) => a.time - b.time);
  const targetGalaxy = news.target.galaxy;

  const fleets: Fleet[] = entries
    .filter((e) => e.type !== "retreat")
    .map((e) => {
      const role = e.type === "attack" ? "attacker" : "defender";
      const sameGalaxy = e.galaxy === targetGalaxy;
      const flightTicks =
        role === "attacker"
          ? ATTACK_FLIGHT_TICKS
          : sameGalaxy
            ? DEFENSE_FLIGHT_TICKS_SAME_GALAXY
            : DEFENSE_FLIGHT_TICKS_OTHER_GALAXY;
      const maxCombatTicks =
        role === "attacker"
          ? MAX_ATTACK_COMBAT_TICKS
          : sameGalaxy
            ? MAX_DEFENSE_TICKS_SAME_GALAXY
            : MAX_DEFENSE_TICKS_OTHER_GALAXY;
      const id = `${coordsKey(e)}#${e.fleet ?? "-"}@${e.time}`;
      const chosen = fleetTicks[id];
      const combatTicks =
        typeof chosen === "number" ? Math.min(maxCombatTicks, Math.max(1, chosen)) : maxCombatTicks;
      const departureTick = floorTick(e.time);
      const arrival = departureTick + flightTicks * TICK_MS;
      const firstCombat = arrival + TICK_MS;
      return {
        id,
        role,
        player: e.player,
        galaxy: e.galaxy,
        planet: e.planet,
        fleet: e.fleet,
        departure: e.time,
        departureTick,
        arrival,
        firstCombat,
        lastCombat: firstCombat + (combatTicks - 1) * TICK_MS,
        combatTicks,
        maxCombatTicks,
        recalled: false,
      };
    });

  // Jeder Rückzug-Eintrag steht für genau eine Flotte. Abgearbeitet wird zeitlich:
  // eine schon zurückgezogene Flotte kommt für spätere Rückzüge nicht mehr in Frage.
  const retreatEntries = entries.filter((e) => e.type === "retreat");
  const recalledIds = new Set<string>();
  const retreats: Retreat[] = retreatEntries.map((e, index) => {
    const id = `${coordsKey(e)}@${e.time}`;
    const own = fleets.filter(
      (f) => coordsKey(f) === coordsKey(e) && (e.fleet === null || f.fleet === e.fleet),
    );
    const candidates = own.filter((f) => f.departure <= e.time && !recalledIds.has(f.id));
    // Gibt es ab hier so viele Rückzüge wie noch offene Flotten, sind alle zurückgezogen.
    const remaining = retreatEntries.slice(index).filter((r) => coordsKey(r) === coordsKey(e));
    const lastRetreat = Math.max(...remaining.map((r) => r.time));
    const open = own.filter((f) => f.departure <= lastRetreat && !recalledIds.has(f.id));
    const allRecalled = candidates.length > 0 && remaining.length >= open.length;

    let recalled: string | null = null;
    const automatic = candidates.length === 1 || allRecalled;
    if (automatic) recalled = candidates[0].id;
    else {
      const choice = retreatChoices[id]?.[0];
      if (choice && candidates.some((f) => f.id === choice)) recalled = choice;
    }
    if (recalled) recalledIds.add(recalled);
    return {
      id,
      player: e.player,
      galaxy: e.galaxy,
      planet: e.planet,
      time: e.time,
      candidates,
      recalled,
      automatic,
      unresolved: !automatic && candidates.length > 1 && recalled === null,
    };
  });

  for (const fleet of fleets) fleet.recalled = recalledIds.has(fleet.id);

  return {
    reference,
    entries,
    ignoredCount: news.entries.length - entries.length,
    fleets,
    retreats,
  };
}

/**
 * Ende des Kampfes: wenn die letzte (nicht zurückgerufene) Angriffsflotte den
 * Orbit verlässt. Verteidiger, die danach noch bleiben, spielen keine Rolle.
 */
export function combatEnd(analysis: NewsAnalysis): number | null {
  const attackers = analysis.fleets.filter((f) => f.role === "attacker" && !f.recalled);
  if (attackers.length === 0) return null;
  return Math.max(...attackers.map((f) => f.lastCombat + TICK_MS));
}

/** Erster Kampftick: wenn die erste (nicht zurückgerufene) Angriffsflotte kämpft. */
export function combatStart(analysis: NewsAnalysis): number | null {
  const attackers = analysis.fleets.filter((f) => f.role === "attacker" && !f.recalled);
  if (attackers.length === 0) return null;
  return Math.min(...attackers.map((f) => f.firstCombat));
}

export const NEWS_TICK_MS = TICK_MS;
