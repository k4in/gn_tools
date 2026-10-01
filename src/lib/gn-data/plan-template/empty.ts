import { type PlanTemplate } from "@/lib/gn-data/plan.ts";

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
