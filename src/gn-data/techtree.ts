type TechTreeType = "building" | "research";

/** Alle Gebäude- und Forschungsnamen aus dem Techtree. */
export type TechName =
  | "Koloniezentrum"
  | "Bergbau"
  | "Kristallmine"
  | "Metallmine"
  | "Zweite Kristallmine"
  | "Zweite Metallmine"
  | "Robotik"
  | "Tiefe Kristallminen"
  | "Tiefe Metallminen"
  | "Fortgeschrittene Robotik"
  | "Bergungstechnologie"
  | "Vollautomatisierte Kristallmine"
  | "Vollautomatisierte Metallmine"
  | "Planetare Werften"
  | "Raumfahrt"
  | "Abfangjäger"
  | "Wiederverwendbare Trägersysteme"
  | "Leichtes Orbitalgeschütz"
  | "Observatorium"
  | "Sektorscan"
  | "Einheitenscan"
  | "Geschützscan"
  | "Militärscan"
  | "Nachrichtenscan"
  | "Aufwertung des Militärscans"
  | "Aufwertung des Nachrichtenscans"
  | "Opto-elektrische Störfelder"
  | "Intergalaktisches Ortungssystem"
  | "Raumstation"
  | "Raumhafen"
  | "Interstellarer Handel"
  | "Handelsplatz"
  | "Bergbaulaser"
  | "Extraktor"
  | "Traktorstrahl"
  | "Kaperschiff"
  | "Longsteen Feld"
  | "Schildschiff"
  | "Raumwerften"
  | "Planetarer Schild"
  | "Fabriken für Raumantriebe"
  | "Militärischer Ionenantrieb"
  | "Protonenantrieb"
  | "Nanofabriken"
  | "Fusionsantrieb"
  | "Mak-tol Werften"
  | "Antimaterieantrieb"
  | "Kristalline KI"
  | "Fregatte"
  | "Zerstörer"
  | "Leichtes Raumgeschütz"
  | "Jäger"
  | "Bomber"
  | "Kreuzer"
  | "Mittleres Raumgeschütz"
  | "Trägerschiff"
  | "Schlachtschiff"
  | "Schweres Raumgeschütz"
  | "Raumbasis"
  | "Kommandoschiff"
  | "Waffenfabriken"
  | "Kinetische Raketen"
  | "Protonentorpedos"
  | "Plasmawerfer"
  | "Plasmabomben"
  | "Fusionstorpedos"
  | "Quantum Rotationskanonen"
  | "Antimaterietorpedos"
  | "Laserphalanx"
  | "Artilleriesysteme"
  | "Protonenlaserartillerie"
  | "Fluxpartikelartillerie"
  | "Positronenlaserartillerie"
  | "Marineakademie"
  | "Akademieanbau: Offensive Kriegsführung"
  | "Akademieanbau: Defensive Kriegsführung"
  | "Hangar"
  | "Reparaturdock"
  | "Casino";

export type TechTreeEntry = {
  name: TechName;
  type: TechTreeType;
  ticks: number;
  time: number;
  cost: {
    met: number;
    kris: number;
  };
  dependencies: TechName[];
  eliminates: TechName[];
};

export const techtree: TechTreeEntry[] = [
  {
    name: "Koloniezentrum",
    type: "building",
    ticks: 2,
    time: 30,
    cost: {
      met: 500,
      kris: 500,
    },
    dependencies: [],
    eliminates: [],
  },
  {
    name: "Bergbau",
    type: "research",
    ticks: 4,
    time: 60,
    cost: {
      met: 1000,
      kris: 1000,
    },
    dependencies: ["Koloniezentrum"],
    eliminates: [],
  },
  {
    name: "Kristallmine",
    type: "building",
    ticks: 2,
    time: 30,
    cost: {
      met: 1000,
      kris: 2500,
    },
    dependencies: ["Bergbau"],
    eliminates: [],
  },
  {
    name: "Metallmine",
    type: "building",
    ticks: 2,
    time: 30,
    cost: {
      met: 2500,
      kris: 1000,
    },
    dependencies: ["Bergbau"],
    eliminates: [],
  },
  {
    name: "Zweite Kristallmine",
    type: "building",
    ticks: 6,
    time: 90,
    cost: {
      met: 2000,
      kris: 4000,
    },
    dependencies: ["Kristallmine"],
    eliminates: [],
  },
  {
    name: "Zweite Metallmine",
    type: "building",
    ticks: 6,
    time: 90,
    cost: {
      met: 4000,
      kris: 2000,
    },
    dependencies: ["Metallmine"],
    eliminates: [],
  },
  {
    name: "Robotik",
    type: "research",
    ticks: 8,
    time: 120,
    cost: {
      met: 3000,
      kris: 3000,
    },
    dependencies: ["Kristallmine", "Metallmine"],
    eliminates: [],
  },
  {
    name: "Tiefe Kristallminen",
    type: "building",
    ticks: 8,
    time: 120,
    cost: {
      met: 3500,
      kris: 6000,
    },
    dependencies: ["Robotik", "Zweite Kristallmine"],
    eliminates: [],
  },
  {
    name: "Tiefe Metallminen",
    type: "building",
    ticks: 8,
    time: 120,
    cost: {
      met: 6000,
      kris: 3500,
    },
    dependencies: ["Robotik", "Zweite Metallmine"],
    eliminates: [],
  },
  {
    name: "Fortgeschrittene Robotik",
    type: "research",
    ticks: 16,
    time: 240,
    cost: {
      met: 16000,
      kris: 16000,
    },
    dependencies: ["Tiefe Kristallminen", "Tiefe Metallminen"],
    eliminates: [],
  },
  {
    name: "Bergungstechnologie",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 15000,
      kris: 12000,
    },
    dependencies: ["Fortgeschrittene Robotik"],
    eliminates: [],
  },
  {
    name: "Vollautomatisierte Kristallmine",
    type: "building",
    ticks: 18,
    time: 270,
    cost: {
      met: 25000,
      kris: 20000,
    },
    dependencies: ["Fortgeschrittene Robotik"],
    eliminates: [],
  },
  {
    name: "Vollautomatisierte Metallmine",
    type: "building",
    ticks: 18,
    time: 270,
    cost: {
      met: 20000,
      kris: 25000,
    },
    dependencies: ["Fortgeschrittene Robotik"],
    eliminates: [],
  },
  {
    name: "Planetare Werften",
    type: "building",
    ticks: 24,
    time: 360,
    cost: {
      met: 7000,
      kris: 5500,
    },
    dependencies: ["Raumfahrt"],
    eliminates: [],
  },
  {
    name: "Raumfahrt",
    type: "research",
    ticks: 14,
    time: 210,
    cost: {
      met: 7500,
      kris: 7500,
    },
    dependencies: ["Koloniezentrum"],
    eliminates: [],
  },
  {
    name: "Abfangjäger",
    type: "research",
    ticks: 12,
    time: 180,
    cost: {
      met: 8500,
      kris: 10000,
    },
    dependencies: ["Planetare Werften"],
    eliminates: [],
  },
  {
    name: "Wiederverwendbare Trägersysteme",
    type: "research",
    ticks: 12,
    time: 180,
    cost: {
      met: 8500,
      kris: 12000,
    },
    dependencies: ["Planetare Werften"],
    eliminates: [],
  },
  {
    name: "Leichtes Orbitalgeschütz",
    type: "research",
    ticks: 54,
    time: 810,
    cost: {
      met: 12000,
      kris: 25000,
    },
    dependencies: ["Wiederverwendbare Trägersysteme"],
    eliminates: [],
  },
  {
    name: "Observatorium",
    type: "building",
    ticks: 24,
    time: 360,
    cost: {
      met: 25000,
      kris: 35000,
    },
    dependencies: ["Wiederverwendbare Trägersysteme"],
    eliminates: [],
  },
  {
    name: "Sektorscan",
    type: "research",
    ticks: 2,
    time: 30,
    cost: {
      met: 10000,
      kris: 10000,
    },
    dependencies: ["Observatorium"],
    eliminates: [],
  },
  {
    name: "Einheitenscan",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 40000,
      kris: 60000,
    },
    dependencies: ["Sektorscan"],
    eliminates: ["Geschützscan", "Nachrichtenscan", "Aufwertung des Nachrichtenscans"],
  },
  {
    name: "Geschützscan",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 40000,
      kris: 60000,
    },
    dependencies: ["Sektorscan"],
    eliminates: ["Einheitenscan", "Militärscan", "Aufwertung des Militärscans"],
  },
  {
    name: "Militärscan",
    type: "research",
    ticks: 120,
    time: 1800,
    cost: {
      met: 130000,
      kris: 130000,
    },
    dependencies: ["Einheitenscan"],
    eliminates: [],
  },
  {
    name: "Nachrichtenscan",
    type: "research",
    ticks: 120,
    time: 1800,
    cost: {
      met: 130000,
      kris: 130000,
    },
    dependencies: ["Geschützscan"],
    eliminates: [],
  },
  {
    name: "Aufwertung des Militärscans",
    type: "research",
    ticks: 216,
    time: 3240,
    cost: {
      met: 170000,
      kris: 200000,
    },
    dependencies: ["Militärscan"],
    eliminates: [],
  },
  {
    name: "Aufwertung des Nachrichtenscans",
    type: "research",
    ticks: 216,
    time: 3240,
    cost: {
      met: 170000,
      kris: 200000,
    },
    dependencies: ["Nachrichtenscan"],
    eliminates: [],
  },
  {
    name: "Opto-elektrische Störfelder",
    type: "research",
    ticks: 54,
    time: 810,
    cost: {
      met: 12000,
      kris: 15000,
    },
    dependencies: ["Observatorium"],
    eliminates: [],
  },
  {
    name: "Intergalaktisches Ortungssystem",
    type: "building",
    ticks: 16,
    time: 240,
    cost: {
      met: 20000,
      kris: 10000,
    },
    dependencies: ["Observatorium"],
    eliminates: [],
  },
  {
    name: "Raumstation",
    type: "building",
    ticks: 24,
    time: 360,
    cost: {
      met: 50000,
      kris: 35000,
    },
    dependencies: ["Wiederverwendbare Trägersysteme"],
    eliminates: [],
  },
  {
    name: "Raumhafen",
    type: "building",
    ticks: 32,
    time: 480,
    cost: {
      met: 150000,
      kris: 150000,
    },
    dependencies: ["Raumstation"],
    eliminates: [],
  },
  {
    name: "Interstellarer Handel",
    type: "research",
    ticks: 68,
    time: 1020,
    cost: {
      met: 380000,
      kris: 255000,
    },
    dependencies: ["Raumhafen"],
    eliminates: [],
  },
  {
    name: "Handelsplatz",
    type: "building",
    ticks: 48,
    time: 720,
    cost: {
      met: 50000,
      kris: 50000,
    },
    dependencies: ["Interstellarer Handel", "Raumhafen"],
    eliminates: [],
  },
  {
    name: "Bergbaulaser",
    type: "research",
    ticks: 20,
    time: 300,
    cost: {
      met: 95000,
      kris: 95000,
    },
    dependencies: ["Bergbau"],
    eliminates: [],
  },
  {
    name: "Extraktor",
    type: "research",
    ticks: 20,
    time: 300,
    cost: {
      met: 130000,
      kris: 130000,
    },
    dependencies: ["Bergbaulaser", "Observatorium"],
    eliminates: [],
  },
  {
    name: "Traktorstrahl",
    type: "research",
    ticks: 26,
    time: 390,
    cost: {
      met: 8500,
      kris: 10000,
    },
    dependencies: ["Waffenfabriken"],
    eliminates: [],
  },
  {
    name: "Kaperschiff",
    type: "research",
    ticks: 42,
    time: 630,
    cost: {
      met: 8500,
      kris: 10000,
    },
    dependencies: ["Raumwerften", "Traktorstrahl"],
    eliminates: [],
  },
  {
    name: "Longsteen Feld",
    type: "research",
    ticks: 36,
    time: 540,
    cost: {
      met: 4000,
      kris: 3500,
    },
    dependencies: ["Kaperschiff"],
    eliminates: [],
  },
  {
    name: "Schildschiff",
    type: "research",
    ticks: 36,
    time: 540,
    cost: {
      met: 4000,
      kris: 8500,
    },
    dependencies: ["Longsteen Feld"],
    eliminates: [],
  },
  {
    name: "Raumwerften",
    type: "building",
    ticks: 28,
    time: 420,
    cost: {
      met: 70000,
      kris: 70000,
    },
    dependencies: ["Raumstation"],
    eliminates: [],
  },
  {
    name: "Planetarer Schild",
    type: "building",
    ticks: 240,
    time: 3600,
    cost: {
      met: 200000,
      kris: 300000,
    },
    dependencies: ["Raumstation"],
    eliminates: [],
  },
  {
    name: "Fabriken für Raumantriebe",
    type: "building",
    ticks: 56,
    time: 840,
    cost: {
      met: 70000,
      kris: 140000,
    },
    dependencies: ["Raumstation"],
    eliminates: [],
  },
  {
    name: "Militärischer Ionenantrieb",
    type: "research",
    ticks: 144,
    time: 2160,
    cost: {
      met: 17000,
      kris: 35000,
    },
    dependencies: ["Fabriken für Raumantriebe", "Raumwerften"],
    eliminates: [],
  },
  {
    name: "Protonenantrieb",
    type: "research",
    ticks: 144,
    time: 2160,
    cost: {
      met: 85000,
      kris: 170000,
    },
    dependencies: ["Militärischer Ionenantrieb"],
    eliminates: [],
  },
  {
    name: "Nanofabriken",
    type: "building",
    ticks: 144,
    time: 2160,
    cost: {
      met: 255000,
      kris: 215000,
    },
    dependencies: ["Fusionsantrieb"],
    eliminates: [],
  },
  {
    name: "Fusionsantrieb",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 30000,
      kris: 35000,
    },
    dependencies: ["Protonenantrieb"],
    eliminates: [],
  },
  {
    name: "Mak-tol Werften",
    type: "building",
    ticks: 180,
    time: 2700,
    cost: {
      met: 1000000,
      kris: 600000,
    },
    dependencies: ["Nanofabriken"],
    eliminates: [],
  },
  {
    name: "Antimaterieantrieb",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 650000,
      kris: 650000,
    },
    dependencies: ["Mak-tol Werften"],
    eliminates: [],
  },
  {
    name: "Kristalline KI",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 35000,
      kris: 90000,
    },
    dependencies: ["Nanofabriken"],
    eliminates: [],
  },
  {
    name: "Fregatte",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 50000,
      kris: 25000,
    },
    dependencies: ["Kinetische Raketen", "Militärischer Ionenantrieb"],
    eliminates: [],
  },
  {
    name: "Zerstörer",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 135000,
      kris: 100000,
    },
    dependencies: ["Protonenantrieb", "Protonentorpedos"],
    eliminates: [],
  },
  {
    name: "Leichtes Raumgeschütz",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 70000,
      kris: 35000,
    },
    dependencies: ["Protonenantrieb", "Protonenlaserartillerie"],
    eliminates: [],
  },
  {
    name: "Jäger",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 130000,
      kris: 170000,
    },
    dependencies: ["Nanofabriken", "Plasmawerfer"],
    eliminates: [],
  },
  {
    name: "Bomber",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 170000,
      kris: 130000,
    },
    dependencies: ["Nanofabriken", "Plasmabomben"],
    eliminates: [],
  },
  {
    name: "Kreuzer",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 215000,
      kris: 170000,
    },
    dependencies: ["Fusionstorpedos", "Nanofabriken"],
    eliminates: [],
  },
  {
    name: "Mittleres Raumgeschütz",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 215000,
      kris: 170000,
    },
    dependencies: ["Fluxpartikelartillerie", "Nanofabriken"],
    eliminates: [],
  },
  {
    name: "Trägerschiff",
    type: "research",
    ticks: 144,
    time: 2160,
    cost: {
      met: 850000,
      kris: 1000000,
    },
    dependencies: ["Mak-tol Werften", "Quantum Rotationskanonen"],
    eliminates: [],
  },
  {
    name: "Schlachtschiff",
    type: "research",
    ticks: 144,
    time: 2160,
    cost: {
      met: 850000,
      kris: 1000000,
    },
    dependencies: ["Antimaterieantrieb", "Antimaterietorpedos"],
    eliminates: [],
  },
  {
    name: "Schweres Raumgeschütz",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 650000,
      kris: 700000,
    },
    dependencies: ["Antimaterieantrieb", "Positronenlaserartillerie"],
    eliminates: [],
  },
  {
    name: "Raumbasis",
    type: "research",
    ticks: 180,
    time: 2700,
    cost: {
      met: 1000000,
      kris: 1200000,
    },
    dependencies: ["Antimaterieantrieb", "Laserphalanx"],
    eliminates: [],
  },
  {
    name: "Kommandoschiff",
    type: "research",
    ticks: 180,
    time: 2700,
    cost: {
      met: 1200000,
      kris: 1000000,
    },
    dependencies: ["Antimaterieantrieb", "Antimaterietorpedos", "Kristalline KI"],
    eliminates: [],
  },
  {
    name: "Waffenfabriken",
    type: "building",
    ticks: 48,
    time: 720,
    cost: {
      met: 70000,
      kris: 140000,
    },
    dependencies: ["Raumstation"],
    eliminates: [],
  },
  {
    name: "Kinetische Raketen",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 25000,
      kris: 20000,
    },
    dependencies: ["Waffenfabriken"],
    eliminates: [],
  },
  {
    name: "Protonentorpedos",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 85000,
      kris: 100000,
    },
    dependencies: ["Kinetische Raketen"],
    eliminates: [],
  },
  {
    name: "Plasmawerfer",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 110000,
      kris: 145000,
    },
    dependencies: ["Protonentorpedos"],
    eliminates: [],
  },
  {
    name: "Plasmabomben",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 8500,
      kris: 90000,
    },
    dependencies: ["Plasmawerfer"],
    eliminates: [],
  },
  {
    name: "Fusionstorpedos",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 30000,
      kris: 35000,
    },
    dependencies: ["Plasmabomben"],
    eliminates: [],
  },
  {
    name: "Quantum Rotationskanonen",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 85000,
      kris: 170000,
    },
    dependencies: ["Fusionstorpedos"],
    eliminates: [],
  },
  {
    name: "Antimaterietorpedos",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 85000,
      kris: 170000,
    },
    dependencies: ["Quantum Rotationskanonen"],
    eliminates: [],
  },
  {
    name: "Laserphalanx",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 85000,
      kris: 170000,
    },
    dependencies: ["Positronenlaserartillerie"],
    eliminates: [],
  },
  {
    name: "Artilleriesysteme",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 85000,
      kris: 130000,
    },
    dependencies: ["Waffenfabriken"],
    eliminates: [],
  },
  {
    name: "Protonenlaserartillerie",
    type: "research",
    ticks: 96,
    time: 1440,
    cost: {
      met: 130000,
      kris: 170000,
    },
    dependencies: ["Artilleriesysteme"],
    eliminates: [],
  },
  {
    name: "Fluxpartikelartillerie",
    type: "research",
    ticks: 108,
    time: 1620,
    cost: {
      met: 30000,
      kris: 35000,
    },
    dependencies: ["Protonenlaserartillerie"],
    eliminates: [],
  },
  {
    name: "Positronenlaserartillerie",
    type: "research",
    ticks: 72,
    time: 1080,
    cost: {
      met: 215000,
      kris: 255000,
    },
    dependencies: ["Fluxpartikelartillerie"],
    eliminates: [],
  },
  {
    name: "Marineakademie",
    type: "building",
    ticks: 36,
    time: 540,
    cost: {
      met: 25000,
      kris: 20000,
    },
    dependencies: ["Raumfahrt"],
    eliminates: [],
  },
  {
    name: "Akademieanbau: Offensive Kriegsführung",
    type: "building",
    ticks: 288,
    time: 4320,
    cost: {
      met: 1900000,
      kris: 1500000,
    },
    dependencies: ["Marineakademie"],
    eliminates: ["Akademieanbau: Defensive Kriegsführung"],
  },
  {
    name: "Akademieanbau: Defensive Kriegsführung",
    type: "building",
    ticks: 288,
    time: 4320,
    cost: {
      met: 1900000,
      kris: 1500000,
    },
    dependencies: ["Marineakademie"],
    eliminates: ["Akademieanbau: Offensive Kriegsführung"],
  },
  {
    name: "Hangar",
    type: "building",
    ticks: 144,
    time: 2160,
    cost: {
      met: 350000,
      kris: 350000,
    },
    dependencies: ["Bergungstechnologie", "Raumstation"],
    eliminates: [],
  },
  {
    name: "Reparaturdock",
    type: "building",
    ticks: 90,
    time: 1350,
    cost: {
      met: 240000,
      kris: 180000,
    },
    dependencies: ["Bergungstechnologie", "Raumstation"],
    eliminates: [],
  },
  {
    name: "Casino",
    type: "building",
    ticks: 48,
    time: 720,
    cost: {
      met: 35000,
      kris: 35000,
    },
    dependencies: ["Raumstation"],
    eliminates: [],
  },
];
