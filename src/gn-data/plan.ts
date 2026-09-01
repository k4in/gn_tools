import { balanced } from "@/gn-data/plan-template/balanced";
import { fastCleptor } from "@/gn-data/plan-template/fast_cleptor";
import { fastRaumhafen } from "@/gn-data/plan-template/fast_raumhafen";

export type PlanEntry =
  | { id: string; kind: "tech"; name: string; startTick: number }
  | { id: string; kind: "unit"; name: string; startTick: number; count: number }
  | { id: string; kind: "recon"; name: string; startTick: number; count: number }
  /** Asteroiden scannen und/oder Extraktoren bauen — ein Timeline-Event. */
  | {
      id: string;
      kind: "economy";
      startTick: number;
      /** Anzahl Asteroiden (0 = nur Extraktoren). */
      asteroids: number;
      /** Metallextraktoren (0 = keine). */
      extractorsMet: number;
      /** Kristallextraktoren (0 = keine). */
      extractorsKris: number;
    }
  /** Beliebige Ressourcen-Ausgabe mit Label (instant). */
  | {
      id: string;
      kind: "custom";
      startTick: number;
      label: string;
      cost: { met: number; kris: number };
    }
  /** Extraktoren erbeuten (Roid): 10% der Ziel-Exen pro Tick, kostenlos. */
  | {
      id: string;
      kind: "roid";
      startTick: number;
      /** Opfer-Bestand Metall-Exen zu Angriffsbeginn. */
      targetMet: number;
      /** Opfer-Bestand Kristall-Exen zu Angriffsbeginn. */
      targetKris: number;
      /** Anzahl Angriffs-Ticks (1–10). */
      duration: number;
    }
  /** @deprecated migrated to economy */
  | {
      id: string;
      kind: "extractors";
      resource: "met" | "kris";
      startTick: number;
      count: number;
    }
  /** @deprecated migrated to economy */
  | { id: string; kind: "asteroids"; startTick: number; count: number };

export type PlanTemplate = {
  id: string;
  label: string;
  plan: PlanEntry[];
};

export const PLAN_SLOT_IDS = [1, 2, 3] as const;
export type PlanSlotId = (typeof PLAN_SLOT_IDS)[number];

export function isPlanSlotId(value: unknown): value is PlanSlotId {
  return value === 1 || value === 2 || value === 3;
}

export function planSlotLabel(id: PlanSlotId): string {
  return `Plan ${id}`;
}

export function clonePlanEntries(plan: PlanEntry[]): PlanEntry[] {
  return structuredClone(plan);
}

export const planTemplates: PlanTemplate[] = [balanced, fastCleptor, fastRaumhafen];

export const defaults: {
  start_time: string;
  start_date: string;
  /** Länge eines Ticks in Minuten (GN: normalerweise 15). */
  tick_minutes: number;
  /** Simulations-Horizont / Safety-Cap in Ticks. */
  max_ticks: number;
  starting_resources: { metall: number; kristall: number };
  plan: PlanEntry[];
} = {
  start_time: "19:30",
  start_date: "2026-08-28",
  tick_minutes: 15,
  max_ticks: 5000,
  starting_resources: {
    metall: 10500,
    kristall: 10500,
  },
  plan: [...balanced.plan],
};
