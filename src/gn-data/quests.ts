// wir berücksichtigen hier erstmal nur alle quests die bis zu extraktoren relevant sind. Andere quests folgen später. Quests sind besondere Aufgaben die Rohstoffe als Questbelohnung bei Erfüllung ausschütten. Selten auch Einheiten, aber das ist für uns erstmal nicht relevant.

export type QuestReward = { kind: "res"; met: number; kris: number } | { kind: "extractors"; resource: "met" | "kris"; count: number };

export type QuestContext = {
  completed: ReadonlySet<string>;
  asteroids: number;
  extractorsMet: number;
  extractorsKris: number;
};

export type QuestDef = {
  id: string;
  /** Kurzlabel für die Quest-Spalte im Tick-Protokoll. */
  label: string;
  reward: QuestReward;
  isComplete: (ctx: QuestContext) => boolean;
};

function hasAll(completed: ReadonlySet<string>, names: string[]) {
  return names.every((n) => completed.has(n));
}

function resLabel(met: number, kris: number): string {
  const parts: string[] = [];
  if (met) parts.push(`+${met}M`);
  if (kris) parts.push(`+${kris}K`);
  return parts.join(", ");
}

function resQuest(id: string, met: number, kris: number, isComplete: (ctx: QuestContext) => boolean): QuestDef {
  return {
    id,
    label: resLabel(met, kris),
    reward: { kind: "res", met, kris },
    isComplete,
  };
}

export const QUESTS: QuestDef[] = [
  resQuest("koloniezentrum", 1000, 0, (ctx) => ctx.completed.has("Koloniezentrum")),
  resQuest("basic-mines", 0, 2000, (ctx) => hasAll(ctx.completed, ["Metallmine", "Kristallmine"])),
  resQuest("deep-mines", 6000, 4000, (ctx) => hasAll(ctx.completed, ["Tiefe Metallminen", "Tiefe Kristallminen"])),
  resQuest("auto-mines", 10000, 20000, (ctx) =>
    hasAll(ctx.completed, ["Vollautomatisierte Metallmine", "Vollautomatisierte Kristallmine"])
  ),
  resQuest("extraktor-research", 10000, 10000, (ctx) => ctx.completed.has("Extraktor")),
  resQuest("raumstation", 12000, 5000, (ctx) => ctx.completed.has("Raumstation")),
  {
    id: "asteroid-met-extractors",
    label: "+10 K-Exen",
    reward: { kind: "extractors", resource: "kris", count: 10 },
    isComplete: (ctx) => ctx.asteroids >= 1 && ctx.extractorsMet >= 10,
  },
];

/** Noch nicht beanspruchte Quests, die jetzt erfüllt sind. */
export function evaluateQuests(ctx: QuestContext, claimed: ReadonlySet<string>): QuestDef[] {
  return QUESTS.filter((q) => !claimed.has(q.id) && q.isComplete(ctx));
}

export function formatQuestReward(reward: QuestReward): string {
  if (reward.kind === "extractors") {
    return reward.resource === "met" ? `+${reward.count} Met-Ext` : `+${reward.count} Kris-Ext`;
  }
  return resLabel(reward.met, reward.kris) || "—";
}

export { hasAll };
