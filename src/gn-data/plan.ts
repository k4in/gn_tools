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
      /** Anzahl Extraktoren (0 = nur Asteroiden). */
      extractors: number;
      /** Ressource der Extraktoren (irrelevant wenn extractors === 0). */
      resource: "met" | "kris";
    }
  /** Beliebige Ressourcen-Ausgabe mit Label (instant). */
  | {
      id: string;
      kind: "custom";
      startTick: number;
      label: string;
      cost: { met: number; kris: number };
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
