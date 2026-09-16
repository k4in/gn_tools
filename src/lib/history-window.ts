export const HISTORY_WINDOW_TICKS = 96;

export type HistoryWindow = "all" | "recent";

export function parseHistoryWindow(raw: unknown): HistoryWindow {
  return raw === "all" ? "all" : "recent";
}

/** Erstes Tick, das in Timeline/Tabellen erscheint. Zukunft wird nicht gekürzt. */
export function historyRangeStart(currentTick: number, window: HistoryWindow): number {
  if (window === "all") return 0;
  return Math.max(0, currentTick - HISTORY_WINDOW_TICKS);
}
