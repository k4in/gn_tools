import type { PlanTemplate } from "@/gn-data/plan";

export const empty: PlanTemplate = {
  id: "empty",
  label: "Leer",
  plan: [
    {
      id: "empty_koloniezentrum",
      kind: "tech",
      name: "Koloniezentrum",
      startTick: 0,
    },
  ],
};
