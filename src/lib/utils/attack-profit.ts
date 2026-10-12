import { getExtractorYield } from "@/lib/gn-data/extractor.ts";
import { taxRatesAt, type TaxSegment } from "@/lib/calculate-fastest-way-to-goal.ts";

export type AttackInput = {
  capturedExtractors: number;
  /** Flottenverlust je erbeutetem Extraktor (Mittelwert, steigt nicht wie beim Bauen). */
  costPerExtractor: number;
};

export type AttackProfitResult = {
  loss: number;
  /** Netto-Ertrag der erbeuteten Extraktoren im nächsten Tick. */
  extraIncome: number;
  /** Ticks ab Bewertungs-Tick, bis der Flottenverlust wieder eingespielt ist; null = nicht im Horizont. */
  breakEvenTicks: number | null;
  /** Vorsprung mit Angriff gegenüber ohne Angriff je Stichtag (gleiche Reihenfolge wie übergeben); null = Stichtag bereits vorbei. */
  gainsAt: (number | null)[];
};

/**
 * Netto-Ertrag von Extraktoren pro Tick. Für Extraktoren zählt nur die Gesamtzahl, daher wird ihr
 * Ertrag mit dem Mittel aus Met- und Kris-Steuer belegt.
 */
function netExtractorIncome(extractors: number, taxes: TaxSegment[], tick: number): number {
  const tax = taxRatesAt(taxes, tick);
  return (getExtractorYield(extractors) * (100 - (tax.met + tax.kris) / 2)) / 100;
}

/**
 * Vergleicht „nichts tun“ mit „angreifen“: Der Angriff kostet sofort `captured × costPerExtractor`,
 * bringt danach aber jeden Tick den Ertrag der erbeuteten Extraktoren. Der Ertrag eines Extraktors
 * hängt nicht von der restlichen Wirtschaft ab, daher zählen nur Beute, Verlust und Steuern.
 * Gesucht ist der Tick, ab dem der Mehrertrag den Verlust einholt, sowie der Vorsprung an den
 * übergebenen Stichtagen (absolute Ticks). Die Beute gilt vereinfacht ab dem nächsten Tick als produzierend.
 */
export function calculateAttackProfit(
  fromTick: number,
  taxes: TaxSegment[],
  input: AttackInput,
  milestoneTicks: number[],
  horizonTicks: number
): AttackProfitResult {
  const captured = Math.max(0, Math.floor(input.capturedExtractors));
  const loss = captured * Math.max(0, input.costPerExtractor);
  const ticksToMilestones = milestoneTicks.map((tick) => tick - fromTick);
  const lastMilestone = Math.max(0, ...ticksToMilestones);

  let gain = -loss;
  let breakEvenTicks: number | null = loss <= 0 ? 0 : null;
  const gainsAt: (number | null)[] = ticksToMilestones.map(() => null);

  for (let k = 1; k <= Math.max(horizonTicks, lastMilestone); k++) {
    gain += netExtractorIncome(captured, taxes, fromTick + k);
    if (breakEvenTicks === null && gain >= 0) breakEvenTicks = k;
    ticksToMilestones.forEach((ticks, i) => {
      if (ticks === k) gainsAt[i] = gain;
    });
    if (breakEvenTicks !== null && k >= lastMilestone) break;
  }

  return {
    loss,
    extraIncome: netExtractorIncome(captured, taxes, fromTick + 1),
    breakEvenTicks,
    gainsAt,
  };
}
