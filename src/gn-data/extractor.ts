export function getExtractorCost(n: number) {
  return n * 65;
}

export function getExtractorYield(n: number) {
  return n * 50;
}

// 20 Extraktorenplätze pro Asteriod
export function getRequiredAsteroidAmount(n: number) {
  return Math.ceil(n / 20);
}
