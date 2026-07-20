import type { TechName } from "./techtree";

type ShipName = "Leo" | "Aquilae" | "Fornax" | "Draco" | "Goron" | "Pentalin" | "Zenit" | "Sculptor" | "Cleptor" | "Cancri";

export type Ship = {
  name: ShipName;
  ticks: number;
  time: number;
  cost: {
    met: number;
    kris: number;
  };
  dependencies: TechName[];
};

export const ships: Ship[] = [
  {
    name: "Leo",
    ticks: 12,
    time: 180,
    cost: { met: 4000, kris: 6000 },
    dependencies: ["Jäger"],
  },
  {
    name: "Aquilae",
    ticks: 16,
    time: 240,
    cost: { met: 2000, kris: 8000 },
    dependencies: ["Bomber"],
  },
  {
    name: "Fornax",
    ticks: 32,
    time: 480,
    cost: { met: 15000, kris: 7500 },
    dependencies: ["Fregatte"],
  },
  {
    name: "Draco",
    ticks: 56,
    time: 840,
    cost: { met: 40000, kris: 30000 },
    dependencies: ["Zerstörer"],
  },
  {
    name: "Goron",
    ticks: 80,
    time: 1200,
    cost: { met: 65000, kris: 85000 },
    dependencies: ["Kreuzer"],
  },
  {
    name: "Pentalin",
    ticks: 120,
    time: 1800,
    cost: { met: 250000, kris: 150000 },
    dependencies: ["Schlachtschiff"],
  },
  {
    name: "Zenit",
    ticks: 120,
    time: 1800,
    cost: { met: 200000, kris: 50000 },
    dependencies: ["Trägerschiff"],
  },
  {
    name: "Sculptor",
    ticks: 192,
    time: 2880,
    cost: { met: 400000, kris: 600000 },
    dependencies: ["Kommandoschiff"],
  },
  {
    name: "Cleptor",
    ticks: 32,
    time: 480,
    cost: { met: 1500, kris: 1000 },
    dependencies: ["Kaperschiff"],
  },
  {
    name: "Cancri",
    ticks: 40,
    time: 600,
    cost: { met: 1000, kris: 1500 },
    dependencies: ["Schildschiff"],
  },
];
