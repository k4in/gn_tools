import type { DefenseName } from "@/gn-data/defense";
import type { ShipName } from "@/gn-data/ships";

/**
 * Parser für aus Galaxy-Network kopierte Scans.
 *
 * Aufbau eines Scans (die Unterstriche gehören zum kopierten Text):
 *
 *   _Galaxy-Network SektorScan (100%) Barrett 14:5_
 *   Punkte: 37.208.688
 *   Schiffe: 18 - Verteidigung: 1241
 *   ...
 *   _Scan aus der Datenbank. Geteilt von k4in 2:7_
 *
 * Die Kopfzeile nennt Scan-Art, Genauigkeit, Spieler und Koordinaten. Die
 * Fußzeile ist immer irrelevant. Einheiten- und Geschützscans listen nur
 * Einheiten, die der Spieler tatsächlich hat.
 *
 * Zusätzlich gibt es die kopierte Punktzeile aus der Galaxieansicht:
 *
 *   14:5 ☠️ Barrett 37.242.208 28
 *
 * (Koordinaten, Rang-Symbol, Name, Punkte, Asteroiden). Sie aktualisiert nur
 * den Punktestand und setzt einen früheren Sektorscan voraus.
 *
 * Der Scan-Zeitpunkt steht nicht im Scan. Dafür gibt es Zeitmarken als eigene
 * Zeile („@ 23.09. 14:30“, „@ 23.09.2026 14:30“ oder „@ 14:30“ für den Tag der
 * vorigen Marke). Eine Marke gilt für alle Scans darunter bis zur nächsten.
 */

export type ScanKind = "sector" | "units" | "defense";

export type ScanTarget = {
  player: string;
  galaxy: number;
  planet: number;
};

type ScanBase = {
  target: ScanTarget;
  /** Genauigkeit in Prozent. */
  accuracy: number;
  /** Zeitpunkt aus der letzten Zeitmarke davor (ms seit Epoch), falls vorhanden. */
  time?: number;
};

export type SectorScan = ScanBase & {
  kind: "sector";
  points: number;
  ships: number;
  defense: number;
  extractorsMet: number;
  extractorsKris: number;
  asteroids: number;
};

export type UnitScan = ScanBase & {
  kind: "units";
  units: Partial<Record<ShipName, number>>;
};

export type DefenseScan = ScanBase & {
  kind: "defense";
  units: Partial<Record<DefenseName, number>>;
};

/** Nur der Punktestand aus der Punktzeile. */
export type PointsScan = ScanBase & {
  kind: "points";
  points: number;
  asteroids: number;
};

export type Scan = SectorScan | UnitScan | DefenseScan | PointsScan;

export type ScanParseResult = {
  scans: Scan[];
  /** Erkannte, aber (noch) nicht unterstützte Scans, z. B. News- oder Militärscan. */
  skipped: { type: string; target: ScanTarget }[];
  /** Zeilen oder Felder, die nicht zugeordnet werden konnten. */
  warnings: string[];
};

/** Bezeichnungen im Einheitenscan → Schiffsname in den Spieldaten. */
const SHIP_LABELS: Record<string, ShipName> = {
  Jäger: "Leo",
  Bomber: "Aquilae",
  Fregatte: "Fornax",
  Zerstörer: "Draco",
  Kreuzer: "Goron",
  Schlachtschiff: "Pentalin",
  Trägerschiff: "Zenit",
  Kommandoschiff: "Sculptor",
  Kaperschiff: "Cleptor",
  Schutzschiff: "Cancri",
  Schildschiff: "Cancri",
};

/** Schiffsname → Bezeichnung im Einheitenscan (für die Anzeige). */
export const SHIP_SCAN_LABEL = Object.fromEntries(
  Object.entries(SHIP_LABELS)
    .filter(([label]) => label !== "Schildschiff")
    .map(([label, name]) => [name, label]),
) as Record<ShipName, string>;

const DEFENSE_LABELS: Record<string, DefenseName> = {
  Horus: "Horus",
  Rubium: "Rubium",
  Pulsar: "Pulsar",
  Coon: "Coon",
  Centurion: "Centurion",
  Zitadelle: "Zitadelle",
};

const SCAN_TYPES: Record<string, ScanKind | null> = {
  Sektor: "sector",
  Einheiten: "units",
  Geschütz: "defense",
  News: null,
  Militär: null,
};

const HEADER_RE = /^[_*]*Galaxy-Network\s+(\S+?)Scan\s*\((\d+)\s*%\)\s+(.+?)\s+(\d+):(\d+)[_*]*$/i;
const FOOTER_RE = /^[_*]*Scan aus der Datenbank/i;
const POINTS_RE = /^(\d+):(\d+)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*)\s+(\d+)$/;
const MARKER_RE = /^@\s*(?:(\d{1,2})\.(\d{1,2})\.(\d{4})?\s+)?(\d{1,2}):(\d{2})$/;

/** Prüft, ob ein Text mindestens einen Scan oder eine Punktzeile enthält. */
export function containsScan(text: string) {
  return text.split(/\r?\n/).some((raw) => {
    const line = raw.trim();
    return HEADER_RE.test(line) || POINTS_RE.test(line);
  });
}

/**
 * „14:5 ☠️ Barrett 37.242.208 28“ → Punktestand. Das Rang-Symbol vor dem
 * Namen wird verworfen, sofern es keine Buchstaben enthält.
 */
function parsePointsLine(line: string, time: number | undefined): PointsScan | null {
  const match = POINTS_RE.exec(line);
  if (!match) return null;
  const [, galaxy, planet, nameWithRank, points, asteroids] = match;
  const tokens = nameWithRank.split(/\s+/);
  if (tokens.length > 1 && !/\p{L}/u.test(tokens[0])) tokens.shift();
  return {
    kind: "points",
    target: { player: tokens.join(" "), galaxy: Number(galaxy), planet: Number(planet) },
    accuracy: 100,
    time,
    points: parseNumber(points)!,
    asteroids: Number(asteroids),
  };
}

/** Zeitmarken-Zeile für einen Zeitpunkt, z. B. „@ 23.09. 14:30“. */
export function formatTimeMarker(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `@ ${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Liest eine Zeitmarke. Ohne Jahr gilt das laufende Jahr, außer der Tag läge
 * dann mehr als einen Tag in der Zukunft (Jahreswechsel). Ohne Datum gilt der
 * Tag der vorigen Marke bzw. heute.
 */
function parseTimeMarker(line: string, previous: number | undefined, now: Date): number | null {
  const match = MARKER_RE.exec(line);
  if (!match) return null;
  const [, day, month, year, hours, minutes] = match;
  const h = Number(hours);
  const m = Number(minutes);
  if (h > 23 || m > 59) return null;
  if (day === undefined) {
    const base = previous !== undefined ? new Date(previous) : now;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m).getTime();
  }
  const d = Number(day);
  const mo = Number(month) - 1;
  let y = year !== undefined ? Number(year) : now.getFullYear();
  let date = new Date(y, mo, d, h, m);
  if (year === undefined && date.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
    y -= 1;
    date = new Date(y, mo, d, h, m);
  }
  if (date.getMonth() !== mo || date.getDate() !== d) return null;
  return date.getTime();
}

/** „37.208.688“ → 37208688 */
function parseNumber(raw: string): number | null {
  const digits = raw.replace(/[.\s]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

/** „Schiffe: 18 - Verteidigung: 1241“ → [["Schiffe", 18], ["Verteidigung", 1241]] */
function parseFields(lines: string[], warnings: string[]): [string, number][] {
  const fields: [string, number][] = [];
  for (const line of lines) {
    for (const part of line.split(/\s+-\s+/)) {
      const match = /^(.+?):\s*(.+)$/.exec(part.trim());
      const value = match ? parseNumber(match[2]) : null;
      if (!match || value === null) {
        warnings.push(`Nicht erkannt: „${part.trim()}“`);
        continue;
      }
      fields.push([match[1].trim(), value]);
    }
  }
  return fields;
}

const SECTOR_FIELDS: Record<string, keyof Omit<SectorScan, "kind" | "target" | "accuracy">> = {
  Punkte: "points",
  Schiffe: "ships",
  Verteidigung: "defense",
  "M-Extraktoren": "extractorsMet",
  "K-Extraktoren": "extractorsKris",
  Asteroiden: "asteroids",
};

export function parseSectorScan(base: ScanBase, lines: string[], warnings: string[]): SectorScan {
  const scan: SectorScan = {
    ...base,
    kind: "sector",
    points: 0,
    ships: 0,
    defense: 0,
    extractorsMet: 0,
    extractorsKris: 0,
    asteroids: 0,
  };
  for (const [label, value] of parseFields(lines, warnings)) {
    const key = SECTOR_FIELDS[label];
    if (key) scan[key] = value;
    else warnings.push(`Unbekanntes Feld im Sektorscan: „${label}“`);
  }
  return scan;
}

export function parseUnitScan(base: ScanBase, lines: string[], warnings: string[]): UnitScan {
  const units: UnitScan["units"] = {};
  for (const [label, value] of parseFields(lines, warnings)) {
    const name = SHIP_LABELS[label];
    if (name) units[name] = value;
    else warnings.push(`Unbekanntes Schiff im Einheitenscan: „${label}“`);
  }
  return { ...base, kind: "units", units };
}

export function parseDefenseScan(base: ScanBase, lines: string[], warnings: string[]): DefenseScan {
  const units: DefenseScan["units"] = {};
  for (const [label, value] of parseFields(lines, warnings)) {
    const name = DEFENSE_LABELS[label];
    if (name) units[name] = value;
    else warnings.push(`Unbekanntes Geschütz im Geschützscan: „${label}“`);
  }
  return { ...base, kind: "defense", units };
}

/** Zerlegt einen eingefügten Text in einzelne Scans und parst jeden davon. */
export function parseScans(text: string, now = new Date()): ScanParseResult {
  const result: ScanParseResult = { scans: [], skipped: [], warnings: [] };
  let current: { type: string; base: ScanBase; lines: string[] } | null = null;
  let time: number | undefined;

  const flush = () => {
    if (!current) return;
    const kind = SCAN_TYPES[current.type];
    if (kind === "sector") result.scans.push(parseSectorScan(current.base, current.lines, result.warnings));
    else if (kind === "units") result.scans.push(parseUnitScan(current.base, current.lines, result.warnings));
    else if (kind === "defense") result.scans.push(parseDefenseScan(current.base, current.lines, result.warnings));
    else result.skipped.push({ type: current.type, target: current.base.target });
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("@")) {
      flush();
      const parsed = parseTimeMarker(line, time, now);
      if (parsed === null) result.warnings.push(`Zeitmarke nicht erkannt: „${line}“`);
      else time = parsed;
      continue;
    }

    const pointsScan = parsePointsLine(line, time);
    if (pointsScan) {
      flush();
      result.scans.push(pointsScan);
      continue;
    }

    const header = HEADER_RE.exec(line);
    if (header) {
      flush();
      const [, type, accuracy, player, galaxy, planet] = header;
      if (!(type in SCAN_TYPES)) result.warnings.push(`Unbekannte Scan-Art: „${type}Scan“`);
      current = {
        type,
        base: {
          accuracy: Number(accuracy),
          target: { player, galaxy: Number(galaxy), planet: Number(planet) },
          time,
        },
        lines: [],
      };
      continue;
    }
    if (FOOTER_RE.test(line)) {
      flush();
      continue;
    }
    if (current) current.lines.push(line);
    else result.warnings.push(`Zeile außerhalb eines Scans: „${line}“`);
  }
  flush();
  return result;
}

export function targetKey(target: ScanTarget) {
  return `${target.galaxy}:${target.planet}`;
}

/**
 * Es wird immer nur ein Spieler ausgewertet: der mit dem ersten Sektorscan im
 * Text. Ohne Sektorscan gilt vorerst der Spieler des ersten Scans.
 */
export function primaryTargetKey(scans: Scan[]): string | null {
  const first = scans.find((s) => s.kind === "sector") ?? scans[0];
  return first ? targetKey(first.target) : null;
}

export type TargetScans = {
  target: ScanTarget;
  sector?: SectorScan;
  units?: UnitScan;
  defense?: DefenseScan;
  /** Alle Sektorscans mit Zeitmarke, zeitlich sortiert, doppelte entfernt. */
  sectorHistory: SectorScan[];
  /** Alle Punktzeilen mit Zeitmarke, zeitlich sortiert, doppelte entfernt. */
  pointsHistory: PointsScan[];
};

/**
 * Fasst Scans je Ziel zusammen. Bei mehreren Scans gleicher Art gilt der
 * letzte im Text; zusätzlich werden alle Sektorscans mit Zeitmarke als
 * Verlauf gesammelt.
 */
export function groupScansByTarget(scans: Scan[]): TargetScans[] {
  const byTarget = new Map<string, TargetScans>();
  for (const scan of scans) {
    const key = targetKey(scan.target);
    const entry = byTarget.get(key) ?? { target: scan.target, sectorHistory: [], pointsHistory: [] };
    if (scan.kind === "sector") {
      entry.sector = scan;
      const duplicate = entry.sectorHistory.some(
        (s) => s.time === scan.time && s.points === scan.points,
      );
      if (scan.time !== undefined && !duplicate) entry.sectorHistory.push(scan);
    } else if (scan.kind === "points") {
      const duplicate = entry.pointsHistory.some(
        (s) => s.time === scan.time && s.points === scan.points,
      );
      if (scan.time !== undefined && !duplicate) entry.pointsHistory.push(scan);
    } else if (scan.kind === "units") entry.units = scan;
    else entry.defense = scan;
    byTarget.set(key, entry);
  }
  for (const entry of byTarget.values()) {
    entry.sectorHistory.sort((a, b) => a.time! - b.time!);
    entry.pointsHistory.sort((a, b) => a.time! - b.time!);
  }
  return [...byTarget.values()];
}
