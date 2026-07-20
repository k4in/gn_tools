import type { TechName } from "./techtree";

type UtilityName = "Asteroid" | "Scanverstärker" | "EloKa-Satelliten";

export type Utility = {
  name: UtilityName;
  ticks: number;
  time: number;
  cost: {
    met: number;
    kris: number;
  };
  dependencies: TechName[];
};

export const utilities: Utility[] = [
  {
    name: "Asteroid",
    ticks: 0, //Asteroiden haben keine Bauzeit, sie werden instant gebaut.
    time: 0,
    cost: {
      met: 0,
      kris: 10000,
    },
    dependencies: ["Observatorium"],
  },
  {
    name: "Scanverstärker",
    ticks: 10,
    time: 150,
    cost: {
      met: 2000,
      kris: 5000,
    },
    dependencies: ["Observatorium"],
  },
  {
    name: "EloKa-Satelliten",
    ticks: 10,
    time: 150,
    cost: {
      met: 5000,
      kris: 2000,
    },
    dependencies: ["Opto-elektrische Störfelder"],
  },
];
