export type PlanEntry =
  | { id: string; kind: "tech"; name: string; startTick: number }
  | { id: string; kind: "unit"; name: string; startTick: number; count: number }
  | { id: string; kind: "recon"; name: string; startTick: number; count: number }
  | {
      id: string;
      kind: "extractors";
      resource: "met" | "kris";
      startTick: number;
      count: number;
    }
  | { id: string; kind: "asteroids"; startTick: number; count: number };

export const defaults: {
  start_time: string;
  start_date: string;
  starting_resources: { metall: number; kristall: number };
  plan: PlanEntry[];
} = {
  start_time: "18:00",
  start_date: "2026-07-20",
  starting_resources: {
    metall: 10000,
    kristall: 10000,
  },
  /**
   * Legacy string-plan (pre tick-based planner). Kept as reference only.
   *
   * [
   *   "Koloniezentrum",
   *   "Bergbau",
   *   "Metallmine",
   *   "Kristallmine",
   *   "Robotik",
   *   "Zweite Metallmine",
   *   "Zweite Kristallmine",
   *   "Tiefe Metallminen",
   *   "Tiefe Kristallminen",
   *   "Fortgeschrittene Robotik",
   *   "Raumfahrt",
   *   "Vollautomatisierte Metallmine",
   *   "Vollautomatisierte Kristallmine",
   *   "Planetare Werften",
   *   "Wiederverwendbare Trägersysteme",
   *   "Raumstation",
   *   "Bergbaulaser",
   *   "Observatorium",
   *   "Extraktor",
   *   "Waffenfabriken",
   *   "Fabriken für Raumantriebe",
   *   "Raumwerften",
   *   "Traktorstrahl",
   *   "Militärischer Ionenantrieb",
   *   "Kinetische Raketen",
   *   "Kaperschiff",
   *   "Marineakademie",
   *   "Sektorscan",
   *   "Longsteen Feld",
   *   "Schildschiff",
   *   "Fregatte",
   * ]
   */
  plan: [
    {
      id: "default_koloniezentrum",
      kind: "tech",
      name: "Koloniezentrum",
      startTick: 0,
    },
    {
      id: "tech_mrtlma93_b2f4hb",
      kind: "tech",
      name: "Bergbau",
      startTick: 2,
    },
    {
      id: "tech_mrtlmi4w_kb4efq",
      kind: "tech",
      name: "Metallmine",
      startTick: 6,
    },
    {
      id: "tech_mrtlml7b_d1ugmt",
      kind: "tech",
      name: "Kristallmine",
      startTick: 6,
    },
    {
      id: "tech_mrtln3kn_3dksty",
      kind: "tech",
      name: "Robotik",
      startTick: 8,
    },
    {
      id: "tech_mrtlndnr_o853u4",
      kind: "tech",
      name: "Zweite Metallmine",
      startTick: 8,
    },
    {
      id: "tech_mrtlnmof_kh0kot",
      kind: "tech",
      name: "Zweite Kristallmine",
      startTick: 8,
    },
    {
      id: "tech_mrtlotnr_iprwzu",
      kind: "tech",
      name: "Tiefe Metallminen",
      startTick: 16,
    },
    {
      id: "tech_mrtlp0hz_z98dbu",
      kind: "tech",
      name: "Tiefe Kristallminen",
      startTick: 16,
    },
    {
      id: "tech_mrtlpqsf_eru9ll",
      kind: "tech",
      name: "Fortgeschrittene Robotik",
      startTick: 25,
    },
    {
      id: "tech_mrtlrpzy_zzebww",
      kind: "tech",
      name: "Raumfahrt",
      startTick: 27,
    },
    {
      id: "tech_mrtltmnb_crmg6s",
      kind: "tech",
      name: "Vollautomatisierte Metallmine",
      startTick: 41,
    },
    {
      id: "tech_mrtltr87_31hy3b",
      kind: "tech",
      name: "Vollautomatisierte Kristallmine",
      startTick: 41,
    },
    {
      id: "tech_mrtlujvj_mveepn",
      kind: "tech",
      name: "Planetare Werften",
      startTick: 41,
    },
    {
      id: "tech_mrtlvq6f_3mpf7m",
      kind: "tech",
      name: "Wiederverwendbare Trägersysteme",
      startTick: 65,
    },
    {
      id: "tech_mrtlw5vz_bnfp7e",
      kind: "tech",
      name: "Raumstation",
      startTick: 77,
    },
    {
      id: "tech_mrtlwjm7_2edjc8",
      kind: "tech",
      name: "Bergbaulaser",
      startTick: 61,
    },
    {
      id: "tech_mrtlxe3j_dho9ui",
      kind: "tech",
      name: "Observatorium",
      startTick: 77,
    },
    {
      id: "tech_mrtlxv2e_j57qbw",
      kind: "tech",
      name: "Extraktor",
      startTick: 101,
    },
    {
      id: "tech_mrtm05yv_mxtbao",
      kind: "tech",
      name: "Waffenfabriken",
      startTick: 101,
    },
    {
      id: "tech_mrtm0kb4_r3mv74",
      kind: "tech",
      name: "Fabriken für Raumantriebe",
      startTick: 110,
    },
    {
      id: "tech_mrtm2xu7_2qkpys",
      kind: "tech",
      name: "Raumwerften",
      startTick: 111,
    },
    {
      id: "ast_mrtm3ydj_8fx86y",
      kind: "asteroids",
      startTick: 121,
      count: 4,
    },
    {
      id: "ext_mrtm4go0_s2ffza",
      kind: "extractors",
      resource: "met",
      startTick: 121,
      count: 74,
    },
    {
      id: "tech_mrtm6p5q_d14r16",
      kind: "tech",
      name: "Traktorstrahl",
      startTick: 149,
    },
    {
      id: "tech_mrtm8h7b_440iuy",
      kind: "tech",
      name: "Kaperschiff",
      startTick: 175,
    },
    {
      id: "tech_mrtm93mn_dbps8w",
      kind: "tech",
      name: "Longsteen Feld",
      startTick: 217,
    },
    {
      id: "tech_mrtm95v3_u3jflz",
      kind: "tech",
      name: "Schildschiff",
      startTick: 253,
    },
    {
      id: "tech_mrtm9y1j_d6ig8p",
      kind: "tech",
      name: "Marineakademie",
      startTick: 181,
    },
    {
      id: "tech_mrtmbtvb_mc8ufd",
      kind: "tech",
      name: "Sektorscan",
      startTick: 200,
    },
    {
      id: "recon_mrtmd053_qyz4ag",
      kind: "recon",
      name: "Scanverstärker",
      startTick: 200,
      count: 10,
    },
    {
      id: "tech_mrtme41r_vi1kmb",
      kind: "tech",
      name: "Kinetische Raketen",
      startTick: 149,
    },
    {
      id: "tech_mrtmenjs_mq2puz",
      kind: "tech",
      name: "Militärischer Ionenantrieb",
      startTick: 166,
    },
    {
      id: "tech_mrtmim3r_ek3wl7",
      kind: "tech",
      name: "Fregatte",
      startTick: 310,
    },
    {
      id: "ast_mrtmjys7_amxo21",
      kind: "asteroids",
      startTick: 122,
      count: 1,
    },
    {
      id: "ext_mrtmkewf_c82jz3",
      kind: "extractors",
      resource: "met",
      startTick: 122,
      count: 3,
    },
    {
      id: "ext_mrtml89j_pqqqzc",
      kind: "extractors",
      resource: "met",
      startTick: 123,
      count: 2,
    },
    {
      id: "ext_mrtmm5vb_arbwia",
      kind: "extractors",
      resource: "met",
      startTick: 124,
      count: 3,
    },
    {
      id: "ast_mrtmxewn_rngo00",
      kind: "asteroids",
      startTick: 149,
      count: 5,
    },
    {
      id: "ext_mrtmy62n_popdku",
      kind: "extractors",
      resource: "met",
      startTick: 149,
      count: 46,
    },
    {
      id: "ext_mrtn0lbn_gqdcwv",
      kind: "extractors",
      resource: "met",
      startTick: 166,
      count: 28,
    },
    {
      id: "ext_mrtn4l0f_ax7ats",
      kind: "extractors",
      resource: "met",
      startTick: 175,
      count: 14,
    },
    {
      id: "ext_mrtn5hsn_wcgaex",
      kind: "extractors",
      resource: "met",
      startTick: 181,
      count: 8,
    },
    {
      id: "unit_mrtn7wtr_gbsl90",
      kind: "unit",
      name: "Cleptor",
      startTick: 217,
      count: 400,
    },
    {
      id: "ext_mrtncuxz_1rg83b",
      kind: "extractors",
      resource: "met",
      startTick: 200,
      count: 4,
    },
    {
      id: "tech_mrtnj7wf_zyl96u",
      kind: "tech",
      name: "Abfangjäger",
      startTick: 253,
    },
    {
      id: "tech_mrtnkus0_pz5ssh",
      kind: "tech",
      name: "Planetarer Schild",
      startTick: 253,
    },
    {
      id: "tech_mrtnmcjs_8v7imf",
      kind: "tech",
      name: "Geschützscan",
      startTick: 310,
    },
    {
      id: "tech_mrtnn28g_e8smlj",
      kind: "tech",
      name: "Protonenantrieb",
      startTick: 310,
    },
    {
      id: "tech_mrtnni8h_uexw0r",
      kind: "tech",
      name: "Protonentorpedos",
      startTick: 221,
    },
    {
      id: "ast_mrtnthk8_aneh0c",
      kind: "asteroids",
      startTick: 253,
      count: 20,
    },
    {
      id: "ext_mrtntwcv_wnk1zf",
      kind: "extractors",
      resource: "met",
      startTick: 253,
      count: 30,
    },
    {
      id: "tech_mrtnzc89_6atso7",
      kind: "tech",
      name: "Artilleriesysteme",
      startTick: 382,
    },
    {
      id: "tech_mrtnzl74_o0pdza",
      kind: "tech",
      name: "Nachrichtenscan",
      startTick: 382,
    },
    {
      id: "tech_mrto08zk_5gbngi",
      kind: "tech",
      name: "Leichtes Orbitalgeschütz",
      startTick: 310,
    },
    {
      id: "tech_mrto0xcw_hl2vq3",
      kind: "tech",
      name: "Opto-elektrische Störfelder",
      startTick: 382,
    },
    {
      id: "tech_mrto15ex_6d6s7g",
      kind: "tech",
      name: "Zerstörer",
      startTick: 454,
    },
    {
      id: "tech_mrtocz1c_gdh987",
      kind: "tech",
      name: "Bergungstechnologie",
      startTick: 382,
    },
  ],
};
