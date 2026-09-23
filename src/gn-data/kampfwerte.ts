import { defenses, type DefenseName } from "./defense";
import { ships, type ShipName } from "./ships";

/**
 * Kampfwerte aus dem GN-Hilfesystem (galaxy-network.de/helpsys, Kampfsystem).
 * Kosten und Bauzeiten kommen aus ships.ts / defense.ts, hier stehen nur die
 * Kampfdaten. Textfassung: kampfwerte.md.
 */

export type CombatUnitName = ShipName | DefenseName;

export type Shot = {
  target: CombatUnitName;
  /** Zerstörte Ziele je Schütze und Kampftick, wenn nur dieser Zieltyp da ist. */
  perTick: number;
  /** Anteil der Schützen auf dieses Ziel, wenn alle gelisteten Ziele da sind. */
  share: number;
};

export type PreFire = {
  ticksBefore: number;
  /** Wirksamkeit gegenüber dem normalen Feuer (0–1). */
  strength: number;
};

export type CombatProfile = {
  name: CombatUnitName;
  shots: Shot[];
  preFire?: PreFire[];
  note?: string;
};

export const shipCombat: CombatProfile[] = [
  {
    name: "Leo",
    shots: [
      { target: "Zitadelle", perTick: 0.005, share: 0.35 },
      { target: "Aquilae", perTick: 0.4, share: 0.3 },
      { target: "Goron", perTick: 0.0263, share: 0.35 },
    ],
    note: "Fliegt nur im Zenit (100 je Träger). Ohne Träger kein Angriff.",
  },
  {
    name: "Aquilae",
    shots: [
      { target: "Centurion", perTick: 0.008, share: 0.25 },
      { target: "Pentalin", perTick: 0.01, share: 0.25 },
      { target: "Zenit", perTick: 0.0075, share: 0.25 },
      { target: "Sculptor", perTick: 0.004, share: 0.25 },
    ],
    note: "Fliegt nur im Zenit. Im Träger kein Pulsar-Vorfeuer.",
  },
  {
    name: "Fornax",
    shots: [
      { target: "Horus", perTick: 4.5, share: 0.6 },
      { target: "Leo", perTick: 0.9, share: 0.4 },
    ],
  },
  {
    name: "Draco",
    shots: [
      { target: "Rubium", perTick: 3.5, share: 0.6 },
      { target: "Fornax", perTick: 1.2444, share: 0.4 },
    ],
  },
  {
    name: "Goron",
    shots: [
      { target: "Pulsar", perTick: 2, share: 0.35 },
      { target: "Draco", perTick: 0.8571, share: 0.3 },
      { target: "Cancri", perTick: 10, share: 0.35 },
    ],
  },
  {
    name: "Pentalin",
    shots: [
      { target: "Coon", perTick: 1, share: 0.2 },
      { target: "Goron", perTick: 1.0666, share: 0.2 },
      { target: "Pentalin", perTick: 0.4, share: 0.2 },
      { target: "Zenit", perTick: 0.3019, share: 0.2 },
      { target: "Sculptor", perTick: 0.16, share: 0.2 },
    ],
  },
  {
    name: "Zenit",
    shots: [
      { target: "Cleptor", perTick: 25, share: 0.5 },
      { target: "Cancri", perTick: 14, share: 0.5 },
    ],
    note: "Trägt 100 Leo/Aquilae. Wird der Träger abgeschossen, stirbt die Ladung mit.",
  },
  {
    name: "Sculptor",
    shots: [
      { target: "Zitadelle", perTick: 0.5, share: 0.4 },
      { target: "Zenit", perTick: 1.2, share: 0.3 },
      { target: "Cancri", perTick: 120, share: 0.3 },
    ],
  },
  {
    name: "Cancri",
    shots: [],
    note: "Kein Schaden. Blockt je Tick einen gegnerischen Cleptor beim Extraktor-Diebstahl.",
  },
  {
    name: "Cleptor",
    shots: [],
    note: "Kein Schaden. Klaut genau 1 Extraktor, wenn nach dem Beschuss weniger Cancri als Cleptoren übrig sind, und wird dabei zerstört.",
  },
];

export const defenseCombat: CombatProfile[] = [
  {
    name: "Horus",
    shots: [
      { target: "Draco", perTick: 0.0114, share: 0.4 },
      { target: "Cleptor", perTick: 0.32, share: 0.6 },
    ],
  },
  {
    name: "Rubium",
    shots: [
      { target: "Leo", perTick: 0.3, share: 0.6 },
      { target: "Cleptor", perTick: 1.28, share: 0.4 },
    ],
  },
  {
    name: "Pulsar",
    shots: [
      { target: "Aquilae", perTick: 1.2, share: 0.4 },
      { target: "Fornax", perTick: 0.5334, share: 0.6 },
    ],
    preFire: [{ ticksBefore: 1, strength: 0.5 }],
    note: "Bomber in Trägern sind vom Vorfeuer nicht betroffen.",
  },
  {
    name: "Coon",
    shots: [
      { target: "Draco", perTick: 0.9143, share: 0.4 },
      { target: "Goron", perTick: 0.4267, share: 0.6 },
    ],
    preFire: [{ ticksBefore: 1, strength: 0.5 }],
  },
  {
    name: "Centurion",
    shots: [
      { target: "Pentalin", perTick: 0.5, share: 0.5 },
      { target: "Zenit", perTick: 0.375, share: 0.5 },
    ],
    preFire: [
      { ticksBefore: 2, strength: 0.2 },
      { ticksBefore: 1, strength: 0.6 },
    ],
    note: "Trägerabschuss tötet die Jäger/Bomber im Träger.",
  },
  {
    name: "Zitadelle",
    shots: [
      { target: "Sculptor", perTick: 0.32, share: 0.6 },
      { target: "Cleptor", perTick: 125, share: 0.4 },
    ],
    preFire: [
      { ticksBefore: 2, strength: 0.25 },
      { ticksBefore: 1, strength: 0.5 },
    ],
  },
];

export type CombatUnit = CombatProfile & {
  kind: "ship" | "defense";
  /** Techname, der die Einheit freischaltet (z. B. „Fregatte“). */
  role: string;
  ticks: number;
  cost: { met: number; kris: number };
  total: number;
};

function withStats(profiles: CombatProfile[], kind: CombatUnit["kind"]): CombatUnit[] {
  const source = kind === "ship" ? ships : defenses;
  return profiles.map((profile) => {
    const unit = source.find((u) => u.name === profile.name);
    if (!unit) throw new Error(`Keine Baudaten für ${profile.name}`);
    return {
      ...profile,
      kind,
      role: unit.dependencies[0] ?? "",
      ticks: unit.ticks,
      cost: unit.cost,
      total: unit.cost.met + unit.cost.kris,
    };
  });
}

export const combatShips = withStats(shipCombat, "ship");
export const combatDefenses = withStats(defenseCombat, "defense");
export const combatUnits = [...combatDefenses, ...combatShips];

const unitByName = new Map(combatUnits.map((u) => [u.name, u]));

export function combatUnit(name: CombatUnitName): CombatUnit {
  return unitByName.get(name)!;
}

/**
 * Wertquote: zerstörter Baukostenwert je eingesetzter Kosteneinheit und
 * Kampftick, bei 100 % Feuer auf dieses Ziel.
 */
export function valueRatio(shooter: CombatUnit, shot: Shot): number {
  return (shot.perTick * combatUnit(shot.target).total) / shooter.total;
}

/** Richtwert, auf den fast alle Matchups ausgelegt sind. */
export const STANDARD_VALUE_RATIO = 0.4;
