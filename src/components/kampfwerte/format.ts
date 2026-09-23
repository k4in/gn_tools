export function formatNumber(n: number, maxFractionDigits = 4) {
  return n.toLocaleString("de-DE", { maximumFractionDigits: maxFractionDigits });
}

export function formatRatio(ratio: number) {
  return ratio.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function formatShare(share: number) {
  return `${Math.round(share * 100)} %`;
}

/** Farbe für eine Wertquote: rot (≤ 0,14) über gelb bis grün (≥ 0,40). */
export function ratioHue(ratio: number) {
  const t = Math.max(0, Math.min(1, (ratio - 0.14) / (0.4 - 0.14)));
  return 25 + t * 120;
}
