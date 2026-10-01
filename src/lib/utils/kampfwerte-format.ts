export function formatNumber(n: number, maxFractionDigits = 4) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: maxFractionDigits });
}

export function formatRatio(ratio: number) {
  return ratio.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function formatShare(share: number) {
  return `${Math.round(share * 100)} %`;
}

/**
 * Farbe für eine Wertquote: destructive (≤ 0,14) über amber-500 bis green-500 (≥ 0,40),
 * dieselben Töne wie im Rest der App.
 */
export function ratioColor(ratio: number) {
  const t = Math.max(0, Math.min(1, (ratio - 0.14) / (0.4 - 0.14)));
  if (t < 0.5) {
    return `color-mix(in oklch, var(--color-amber-500) ${t * 200}%, var(--color-destructive))`;
  }
  return `color-mix(in oklch, var(--color-green-500) ${(t - 0.5) * 200}%, var(--color-amber-500))`;
}

/** Zellhintergrund und Schrift zu einer Wertquote. */
export function ratioStyle(ratio: number) {
  const color = ratioColor(ratio);
  return {
    backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
    color,
  };
}
