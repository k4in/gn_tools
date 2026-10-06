import { getExtractorYield } from "@/lib/gn-data/extractor.ts";
import { taxRatesAt, taxedIncome, type Res, type TaxSegment } from "@/lib/calculate-fastest-way-to-goal.ts";

/** Wirtschaftsstand, von dem aus der Angriff bewertet wird. */
export type EconomyState = {
  /** Tick, ab dem gerechnet wird (Steuern gelten ab hier pro Tick). */
  tick: number;
  extractors: number;
  /** Brutto-Einkommen der Minen (inkl. Koloniezentrum) pro Tick. */
  mineIncome: Res;
  taxes: TaxSegment[];
};

export type AttackInput = {
  capturedExtractors: number;
  /** Flottenverlust je erbeutetem Extraktor (Mittelwert, steigt nicht wie beim Bauen). */
  costPerExtractor: number;
};

export type AttackProfitResult = {
  loss: number;
  incomeWithout: number;
  incomeWith: number;
  /** Ticks ab Bewertungs-Tick, bis der Flottenverlust wieder eingespielt ist; null = nicht im Horizont. */
  breakEvenTicks: number | null;
  /** Vorsprung mit Angriff gegenüber ohne Angriff je Stichtag (gleiche Reihenfolge wie übergeben); null = Stichtag bereits vorbei. */
  gainsAt: (number | null)[];
};

/**
 * Netto-Einkommen pro Tick. Für Extraktoren zählt nur die Gesamtzahl, daher wird ihr Ertrag mit dem
 * Mittel aus Met- und Kris-Steuer belegt; die Minen werden je Rohstoff versteuert.
 */
function netIncome(state: EconomyState, extractors: number, tick: number): number {
  const mines = taxedIncome(state.mineIncome, state.taxes, tick);
  const tax = taxRatesAt(state.taxes, tick);
  const extractorTax = (tax.met + tax.kris) / 2;
  return mines.met + mines.kris + (getExtractorYield(extractors) * (100 - extractorTax)) / 100;
}

/**
 * Vergleicht „nichts tun“ mit „angreifen“: Der Angriff kostet sofort `captured × costPerExtractor`,
 * bringt danach aber jeden Tick mehr Einkommen. Gesucht ist der Tick, ab dem die Summe mit Angriff
 * die Summe ohne Angriff einholt, sowie der Vorsprung an den übergebenen Stichtagen (absolute Ticks).
 * Die Beute gilt vereinfacht ab dem nächsten Tick als produzierend.
 */
export function calculateAttackProfit(
  state: EconomyState,
  input: AttackInput,
  milestoneTicks: number[],
  horizonTicks: number
): AttackProfitResult {
  const captured = Math.max(0, Math.floor(input.capturedExtractors));
  const loss = captured * Math.max(0, input.costPerExtractor);
  const ticksToMilestones = milestoneTicks.map((tick) => tick - state.tick);
  const lastMilestone = Math.max(0, ...ticksToMilestones);

  let without = 0;
  let withAttack = -loss;
  let breakEvenTicks: number | null = loss <= 0 ? 0 : null;
  const gainsAt: (number | null)[] = ticksToMilestones.map(() => null);

  for (let k = 1; k <= Math.max(horizonTicks, lastMilestone); k++) {
    const tick = state.tick + k;
    without += netIncome(state, state.extractors, tick);
    withAttack += netIncome(state, state.extractors + captured, tick);
    if (breakEvenTicks === null && withAttack >= without) breakEvenTicks = k;
    ticksToMilestones.forEach((ticks, i) => {
      if (ticks === k) gainsAt[i] = withAttack - without;
    });
    if (breakEvenTicks !== null && k >= lastMilestone) break;
  }

  return {
    loss,
    incomeWithout: netIncome(state, state.extractors, state.tick + 1),
    incomeWith: netIncome(state, state.extractors + captured, state.tick + 1),
    breakEvenTicks,
    gainsAt,
  };
}
