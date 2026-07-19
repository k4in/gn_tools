type TechTreeType = "building" | "research";

export type TechTreeEntry = {
  name: string;
  type: TechTreeType;
  ticks: number;
  time: number;
  cost: {
    met: number;
    kris: number;
  };
  dependencies: string[];
  eliminates: string[];
};
