import { defenses } from "@/gn-data/defense";
import { getExtractorYield } from "@/gn-data/extractor";
import { defaults } from "@/gn-data/plan";
import { ships } from "@/gn-data/ships";
import type { SectorScan, TargetScans } from "@/lib/scan-parser";

/**
 * Auswertungen auf Basis geparster Scans.
 *
 * Grundformel für Spielerpunkte:
 *   Punkte = Extraktoren × 15.000 + Baukosten aller Einheiten + 10 % der Rohstoffe
 */

export const POINTS_PER_EXTRACTOR = 15_000;
/** Anteil herumliegender Rohstoffe, der als Punkte zählt. */
export const RESOURCE_POINT_SHARE = 0.1;
/** Annahme: Minen voll ausgebaut (Vollautomatisiert, 10.000 Metall + 10.000 Kristall). */
export const ASSUMED_MINE_INCOME = 20_000;
/**
 * Höchster Steuersatz. Steuern senken das Einkommen nur: Der Zuwachs liegt
 * zwischen 90 % und 100 % des maximalen Einkommens (Minen + Extraktoren).
 */
export const MAX_TAX_RATE = 0.1;
/** Bis zu diesem Fehlbetrag (20 %) ist ein Rückstand noch eher Steuern als ein Bau. */
export const SUSPICIOUS_SHORTFALL = 0.2;
/** Spielraum nach oben für Rundung der Rohstoff-Punkte, bevor „Einheiten fertig“ gilt. */
export const POINTS_ROUNDING_SLACK = 2;
/** Im Early-Game gibt es nur Cleptor und Cancri, beide kosten 2.500. */
export const EARLY_GAME_SHIP_COST = 2_500;

const TICK_MS = defaults.tick_minutes * 60_000;

const UNIT_COST = new Map<string, number>(
  [...ships, ...defenses].map((u) => [u.name, u.cost.met + u.cost.kris]),
);
const HORUS_COST = UNIT_COST.get("Horus")!;
const RUBIUM_COST = UNIT_COST.get("Rubium")!;

/** Summe der Baukosten, also der Punktewert einer Einheitenliste. */
export function unitValue(units: Partial<Record<string, number>>): number {
  let total = 0;
  for (const [name, count] of Object.entries(units)) {
    total += (UNIT_COST.get(name) ?? 0) * (count ?? 0);
  }
  return total;
}

function sumCounts(units: Partial<Record<string, number>>) {
  return Object.values(units).reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

function extractorPoints(sector: SectorScan) {
  return (sector.extractorsMet + sector.extractorsKris) * POINTS_PER_EXTRACTOR;
}

export type CountMismatch = {
  kind: "ships" | "defense";
  scanned: number;
  sector: number;
};

/**
 * Vergleicht die Summe aus Einheiten- bzw. Geschützscan mit den Zahlen im
 * Sektorscan. Abweichungen heißen meist: einer der Scans ist veraltet.
 */
export function countMismatches(entry: TargetScans): CountMismatch[] {
  const { sector, units, defense } = entry;
  if (!sector) return [];
  const out: CountMismatch[] = [];
  if (units) {
    const scanned = sumCounts(units.units);
    if (scanned !== sector.ships) out.push({ kind: "ships", scanned, sector: sector.ships });
  }
  if (defense) {
    const scanned = sumCounts(defense.units);
    if (scanned !== sector.defense) out.push({ kind: "defense", scanned, sector: sector.defense });
  }
  return out;
}

export type ResourceEstimate = {
  resources: number;
  /** Sektorscan, mit dem gerechnet wurde. */
  sector: SectorScan;
  /** Punktewert aller Schiffe und Geschütze laut Einheiten- und Geschützscan. */
  fleetValue: number;
  /** true, wenn kein Sektorscan zu den Einheiten- und Geschützzahlen passt. */
  mismatched: boolean;
};

/**
 * Herumliegende Rohstoffe (Metall + Kristall zusammen). Braucht Sektorscan
 * plus Einheiten- und Geschützscan; ein fehlender Scan ist nur dann egal,
 * wenn der Sektorscan für diese Art 0 Einheiten zeigt.
 *
 * Gerechnet wird mit dem neuesten Sektorscan, dessen Schiffs- und
 * Geschützzahlen zu den anderen beiden Scans passen. Sonst würde ein neuer
 * Sektorscan mit alten Einheitenscans verrechnet.
 */
export function estimateResources(entry: TargetScans): ResourceEstimate | null {
  const { sector, units, defense, sectorHistory } = entry;
  if (!sector) return null;
  if (!units && sector.ships > 0) return null;
  if (!defense && sector.defense > 0) return null;
  const shipCount = units ? sumCounts(units.units) : 0;
  const defenseCount = defense ? sumCounts(defense.units) : 0;
  const candidates = [...sectorHistory].reverse();
  if (!candidates.includes(sector)) candidates.unshift(sector);
  const matching = candidates.find((s) => s.ships === shipCount && s.defense === defenseCount);
  const used = matching ?? sector;
  const fleet = unitValue(units?.units ?? {}) + unitValue(defense?.units ?? {});
  return {
    resources: (used.points - extractorPoints(used) - fleet) / RESOURCE_POINT_SHARE,
    sector: used,
    fleetValue: fleet,
    mismatched: !matching,
  };
}

export type EarlyGameEstimate = {
  defense: number;
  /** Höchstens so viele Rubium, nämlich wenn keine Rohstoffe herumliegen. */
  rubiumMax: number;
  /** Spanne der möglichen Rohstoffe, je nach Rubium/Horus-Verhältnis. */
  resourcesMin: number;
  resourcesMax: number;
  /** Punkte reichen nicht einmal für lauter Horus: Annahmen passen nicht. */
  inconsistent: boolean;
};

/**
 * Early-Game: nur Horus, Rubium, Cleptor und Cancri. Ohne Geschützscan bleibt
 * offen, wie viele Geschütze Rubium sind und wie viele Rohstoffe herumliegen.
 * Beides zusammen ergibt den Restwert, daher eine Spanne statt eines Werts.
 */
export function earlyGameEstimate(entry: TargetScans): EarlyGameEstimate | null {
  const { sector, units } = entry;
  if (!sector) return null;
  const shipValue = units ? unitValue(units.units) : sector.ships * EARLY_GAME_SHIP_COST;
  const rest = sector.points - extractorPoints(sector) - shipValue;
  const defense = sector.defense;
  // Wert über „alles Horus“ hinaus: Rubium-Aufpreis plus 10 % der Rohstoffe.
  const beyondHorus = rest - defense * HORUS_COST;
  if (beyondHorus < 0) {
    return { defense, rubiumMax: 0, resourcesMin: 0, resourcesMax: 0, inconsistent: true };
  }
  const rubiumMax = Math.min(defense, Math.floor(beyondHorus / (RUBIUM_COST - HORUS_COST)));
  const allRubiumRest = rest - defense * RUBIUM_COST;
  return {
    defense,
    rubiumMax,
    resourcesMin: Math.max(0, allRubiumRest / RESOURCE_POINT_SHARE),
    resourcesMax: beyondHorus / RESOURCE_POINT_SHARE,
    inconsistent: false,
  };
}

/**
 * normal: bis 10 % unter dem Maximum, im grünen Bereich (Steuern).
 * suspicious: 10–20 % darunter, auffällig, aber eher Steuern.
 * building: mehr als 20 % darunter oder Punkte gefallen, Einheiten im Bau.
 * finished: über dem Maximum, Einheiten sind fertig geworden.
 */
export type HistoryVerdict = "same-tick" | "normal" | "suspicious" | "building" | "finished";

/** Ein Punktestand im Verlauf, aus einem Sektorscan oder einer Punktzeile. */
export type HistoryPoint = {
  time: number;
  points: number;
  /** Bei Punktzeilen vom nächstgelegenen früheren Sektorscan übernommen. */
  extractors: number;
  /** Nur bei Sektorscans bekannt. */
  ships?: number;
  defense?: number;
  source: "sector" | "points";
};

export type HistoryStep = {
  from: HistoryPoint;
  to: HistoryPoint;
  ticks: number;
  /** Punkteänderung ohne Extraktor-Punkte (neue oder verlorene Exen verfälschen sonst). */
  pointsDelta: number;
  expected: number;
  lower: number;
  upper: number;
  verdict: HistoryVerdict;
  /** Bei „building“: höchstens so viele Rohstoffe ausgegeben (ohne Steuern gerechnet). */
  spentResources: number;
  /**
   * Rückstand zum maximalen Einkommen als Anteil (0,043 = 4,3 %), bei „normal“
   * und „suspicious“ also der vermutete Steuersatz. null ohne Ticks dazwischen.
   */
  shortfall: number | null;
  /** null, wenn einer der beiden Stände nur eine Punktzeile ist. */
  extractorsDelta: number | null;
  shipsDelta: number | null;
  defenseDelta: number | null;
};

function tickIndex(time: number) {
  return Math.floor(time / TICK_MS);
}

/**
 * Sektorscans und Punktzeilen eines Ziels als gemeinsamer, zeitlich sortierter
 * Verlauf. Ohne Sektorscan gibt es keinen Verlauf, weil die Extraktoren fehlen.
 */
export function buildHistory(entry: TargetScans): HistoryPoint[] {
  const sectors = entry.sectorHistory;
  if (sectors.length === 0) return [];
  const fromSectors: HistoryPoint[] = sectors.map((s) => ({
    time: s.time!,
    points: s.points,
    extractors: s.extractorsMet + s.extractorsKris,
    ships: s.ships,
    defense: s.defense,
    source: "sector",
  }));
  const fromPoints: HistoryPoint[] = entry.pointsHistory.map((p) => {
    const reference = [...sectors].reverse().find((s) => s.time! <= p.time!) ?? sectors[0];
    return {
      time: p.time!,
      points: p.points,
      extractors: reference.extractorsMet + reference.extractorsKris,
      source: "points",
    };
  });
  return [...fromSectors, ...fromPoints].sort(
    (a, b) => a.time - b.time || (a.source === "sector" ? -1 : 1),
  );
}

function delta(a: number | undefined, b: number | undefined) {
  return a === undefined || b === undefined ? null : b - a;
}

type Comparison = Omit<HistoryStep, "extractorsDelta" | "shipsDelta" | "defenseDelta">;

/**
 * Vergleicht zwei Punktestände. Maximal möglich ist pro Tick 10 % des
 * Einkommens aus vollen Minen und Extraktoren; Steuern senken das um bis zu
 * 10 %. Ein größerer Rückstand heißt: Rohstoffe wurden ausgegeben. Mehr als
 * das Maximum heißt: Einheiten sind fertig und zählen jetzt voll als Punkte.
 */
export function comparePoints(from: HistoryPoint, to: HistoryPoint): Comparison {
  const ticks = tickIndex(to.time) - tickIndex(from.time);
  const pointsDelta =
    to.points - to.extractors * POINTS_PER_EXTRACTOR - (from.points - from.extractors * POINTS_PER_EXTRACTOR);
  const perTick = (ASSUMED_MINE_INCOME + getExtractorYield(from.extractors)) * RESOURCE_POINT_SHARE;
  const expected = ticks * perTick;
  const lower = expected * (1 - MAX_TAX_RATE);
  const upper = expected;
  let verdict: HistoryVerdict;
  if (pointsDelta < 0) verdict = "building";
  else if (pointsDelta > upper + POINTS_ROUNDING_SLACK) verdict = "finished";
  else if (ticks <= 0) verdict = "same-tick";
  else if (pointsDelta >= lower) verdict = "normal";
  else if (pointsDelta >= expected * (1 - SUSPICIOUS_SHORTFALL)) verdict = "suspicious";
  else verdict = "building";
  return {
    from,
    to,
    ticks,
    pointsDelta,
    expected,
    lower,
    upper,
    verdict,
    spentResources: verdict === "building" ? (expected - pointsDelta) / RESOURCE_POINT_SHARE : 0,
    shortfall: expected > 0 ? Math.max(0, 1 - pointsDelta / expected) : null,
  };
}

/** Vergleicht aufeinanderfolgende Punktestände des Verlaufs. */
export function analyzeHistory(entry: TargetScans): HistoryStep[] {
  const history = buildHistory(entry);
  const steps: HistoryStep[] = [];
  for (let i = 1; i < history.length; i++) {
    const from = history[i - 1];
    const to = history[i];
    const bothSectors = from.source === "sector" && to.source === "sector";
    steps.push({
      ...comparePoints(from, to),
      extractorsDelta: bothSectors ? to.extractors - from.extractors : null,
      shipsDelta: delta(from.ships, to.ships),
      defenseDelta: delta(from.defense, to.defense),
    });
  }
  return steps;
}

export type CurrentResources = {
  resources: number;
  /** Neuester Punktestand, auf dem die Zahl beruht. */
  point: HistoryPoint;
  /** Vergleich Referenz-Sektorscan → neuester Punktestand. */
  comparison: Comparison;
};

/**
 * Rohstoffe zum neuesten Punktestand, fortgeschrieben vom Referenz-Sektorscan
 * der Rohstoffberechnung. Annahme: Einheiten unverändert. Ob das plausibel ist,
 * sagt der Vergleich; weicht er ab, sollte neu gescannt werden.
 */
export function currentResources(
  entry: TargetScans,
  estimate: ResourceEstimate,
): CurrentResources | null {
  const reference = estimate.sector;
  if (reference.time === undefined) return null;
  const history = buildHistory(entry);
  const latest = history.at(-1);
  if (!latest || latest.time <= reference.time) return null;
  const from: HistoryPoint = {
    time: reference.time,
    points: reference.points,
    extractors: reference.extractorsMet + reference.extractorsKris,
    ships: reference.ships,
    defense: reference.defense,
    source: "sector",
  };
  return {
    resources:
      (latest.points - latest.extractors * POINTS_PER_EXTRACTOR - estimate.fleetValue) /
      RESOURCE_POINT_SHARE,
    point: latest,
    comparison: comparePoints(from, latest),
  };
}

/** Neuester Punktestand aus einer Punktzeile, falls er neuer als der letzte Sektorscan ist. */
export function latestPointsUpdate(entry: TargetScans) {
  const latest = entry.pointsHistory.at(-1);
  const lastSector = entry.sectorHistory.at(-1);
  if (!latest) return null;
  if (lastSector && lastSector.time! >= latest.time!) return null;
  return latest;
}
