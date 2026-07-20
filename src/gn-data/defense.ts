import type { TechName } from "./techtree";

type DefenseName = "Horus" | "Rubium" | "Pulsar" | "Coon" | "Centurion" | "Zitadelle";

export type Defense = {
  name: DefenseName;
  ticks: number;
  time: number;
  cost: {
    met: number;
    kris: number;
  };
  dependencies: TechName[];
};

// TODO: ticks/time für raumgeschütze

export const defenses: Defense[] = [
  {
    name: "Rubium",
    ticks: 18,
    time: 270,
    cost: { met: 6000, kris: 2000 },
    dependencies: ["Leichtes Orbitalgeschütz"],
  },
  {
    name: "Pulsar",
    ticks: 0,
    time: 0,
    cost: { met: 20000, kris: 10000 },
    dependencies: ["Leichtes Raumgeschütz"],
  },
  {
    name: "Coon",
    ticks: 0,
    time: 0,
    cost: { met: 60000, kris: 100000 },
    dependencies: ["Mittleres Raumgeschütz"],
  },
  {
    name: "Centurion",
    ticks: 0,
    time: 0,
    cost: { met: 200000, kris: 300000 },
    dependencies: ["Schweres Raumgeschütz"],
  },
  {
    name: "Horus",
    ticks: 8,
    time: 120,
    cost: { met: 1000, kris: 1000 },
    dependencies: ["Abfangjäger"],
  },
  {
    name: "Zitadelle",
    ticks: 0,
    time: 0,
    cost: { met: 500000, kris: 300000 },
    dependencies: ["Raumbasis"],
  },
];
