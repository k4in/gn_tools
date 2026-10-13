export type ParsedAttacker = {
  /** Name aus der Spaltenüberschrift „Geklaut von …“, z. B. „18:8 Lady“; leer bei einem Kampfbericht. */
  name: string;
  /** Summe der geklauten Metall- und Kristall-Extraktoren. */
  capturedExtractors: number;
  /** null = in der Kopie stand keine Angabe für diesen Angreifer. */
  costPerExtractor: number | null;
};

const ATTACKER_PREFIX = /^Geklaut von\s+/i;
/** Jede Kopie (Kampfsim wie Kampfbericht) beginnt mit einer Zeile, deren erste Zelle „Extraktoren“ ist. */
const BLOCK_START = /^Extraktoren$/i;

/** Zellen einer Zeile: Tabs aus der Kopie, sonst mindestens zwei Leerzeichen als Trenner. */
function splitCells(line: string): string[] {
  const cells = line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/);
  return cells.map((cell) => cell.trim());
}

/** Zahl im deutschen Format („199.380“, „2.500,5“); null, wenn keine Zahl. */
function parseGermanNumber(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

/**
 * Liest eine kopierte Kampfsim (Tabelle „Extraktoren | Vorher | Nachher | Geklaut | Geklaut von …“)
 * und liefert je Angreifer die erbeuteten Extraktoren und die Kosten pro Extraktor. Die Kostenzeile ist
 * kürzer als die Kopfzeile, ihre Werte gehören in derselben Reihenfolge zu den Angreifer-Spalten.
 */
function parseSimulation(lines: string[]): ParsedAttacker[] {
  const rows = lines.filter((line) => line.trim() !== "").map(splitCells);

  const header = rows.find((cells) => cells.some((cell) => ATTACKER_PREFIX.test(cell)));
  if (!header) return [];

  const columns = header.flatMap((cell, index) => (ATTACKER_PREFIX.test(cell) ? [{ index, name: cell.replace(ATTACKER_PREFIX, "") }] : []));

  function rowStartingWith(label: RegExp): string[] | undefined {
    return rows.find((cells) => label.test(cells[0] ?? ""));
  }

  const metal = rowStartingWith(/^Metall$/i);
  const crystal = rowStartingWith(/^Kristall$/i);
  // „-“ zählt als Wert, damit die Zuordnung der Kosten zu den Spalten stimmt.
  const costs = (rowStartingWith(/^Kosten pro Extraktor$/i) ?? []).slice(1).filter((cell) => cell !== "");
  // Fehlen Werte, gehören die vorhandenen zu den letzten Spalten (die Zeile ist rechtsbündig).
  const costOffset = columns.length - costs.length;

  return columns.flatMap((column, i) => {
    const cost = costs[i - costOffset] ?? "";
    // Spieler ohne Beute (z. B. Verteidiger) haben überall „-“ und werden übersprungen.
    if ([metal?.[column.index], crystal?.[column.index], cost].some((cell) => cell === "-")) return [];
    return [
      {
        name: column.name,
        capturedExtractors: (parseGermanNumber(metal?.[column.index] ?? "") ?? 0) + (parseGermanNumber(crystal?.[column.index] ?? "") ?? 0),
        costPerExtractor: parseGermanNumber(cost),
      },
    ];
  });
}

/** Wert nach dem Label einer Kampfbericht-Zeile („Geklaute Metall Extraktoren:\t95 (161)“); die Klammer wird ignoriert. */
function reportValue(lines: string[], label: RegExp): number | null {
  for (const line of lines) {
    const match = label.exec(line.trim());
    if (match) return parseGermanNumber(match[1].replace(/\(.*\)/, ""));
  }
  return null;
}

/**
 * Liest den Extraktoren-Teil eines Kampfberichts (ZKB): geklaute Metall- und Kristall-Extraktoren und die
 * Kosten pro Extraktor. Angreifer stehen dort nicht drin; die Werte in Klammern werden ignoriert.
 */
function parseReport(lines: string[]): ParsedAttacker[] {
  const metal = reportValue(lines, /^Geklaute Metall Extraktoren:\s*(.+)$/i);
  const crystal = reportValue(lines, /^Geklaute Kristall Extraktoren:\s*(.+)$/i);
  if (metal === null && crystal === null) return [];
  return [
    {
      name: "",
      capturedExtractors: (metal ?? 0) + (crystal ?? 0),
      costPerExtractor: reportValue(lines, /^Kosten pro Extraktor:\s*(.+)$/i),
    },
  ];
}

/**
 * Liest mehrere nacheinander eingefügte Angriffsberechnungen, als Kampfsim oder als Kampfbericht. Jede Kopie
 * beginnt mit „Extraktoren“ und wird für sich ausgewertet; Zeilen vor der ersten Kopie werden ignoriert.
 */
export function parseAttackCalculations(text: string): ParsedAttacker[] {
  const blocks: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (BLOCK_START.test(splitCells(line)[0] ?? "")) blocks.push([line]);
    else blocks.at(-1)?.push(line);
  }
  // Bei der Kampfsim ist „Extraktoren“ die erste Zelle der Kopfzeile, im Kampfbericht steht es allein.
  return blocks.flatMap((block) => (splitCells(block[0]).length > 1 ? parseSimulation(block) : parseReport(block)));
}
