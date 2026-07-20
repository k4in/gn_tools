import { useEffect, useMemo, useState } from "react";
import planData from "@/gn-data/plan.json";
import { Header } from "@/components/header";
import { Overview } from "@/components/overview/overview";
import { Sidebar } from "@/components/sidebar/sidebar";
import {
  calculateFastestWayToGoal,
  computeCurrentTick,
  getTechtree,
  getUnlockedTechs,
  maxAffordableExtractors,
  newEconomyOrderId,
  type EconomyOrder,
  type StartConfig,
} from "@/lib/calculateFastestWayToGoal";
import { TooltipProvider } from "@/components/shadcn/tooltip";

const STORAGE_KEY = "gn_tool.plan";
const FALLBACK_PLAN = ["Koloniezentrum"] as const;
const defaultConfig = planData as StartConfig;

function normalizeEconomyOrders(raw: unknown): EconomyOrder[] {
  if (!Array.isArray(raw)) return [];
  const out: EconomyOrder[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : newEconomyOrderId();
    const count = typeof o.count === "number" && o.count > 0 ? Math.floor(o.count) : 0;
    const atTick =
      typeof o.atTick === "number" && Number.isFinite(o.atTick)
        ? Math.max(0, Math.floor(o.atTick))
        : 0;
    if (!count) continue;
    if (o.kind === "asteroids") {
      out.push({ id, kind: "asteroids", count, atTick });
    } else if (o.kind === "extractors") {
      const resource = o.resource === "kris" ? "kris" : "met";
      out.push({ id, kind: "extractors", count, resource, atTick });
    }
  }
  return out;
}

function normalizeConfig(raw: unknown): StartConfig {
  const base: StartConfig = {
    start_time: defaultConfig.start_time,
    start_date: defaultConfig.start_date,
    starting_resources: {
      metall: defaultConfig.starting_resources.metall,
      kristall: defaultConfig.starting_resources.kristall,
    },
    plan: defaultConfig.plan?.length ? [...defaultConfig.plan] : [...FALLBACK_PLAN],
    economyOrders: normalizeEconomyOrders(
      (defaultConfig as { economyOrders?: unknown }).economyOrders,
    ),
  };

  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<StartConfig>;

  const start_time =
    typeof obj.start_time === "string" && obj.start_time.trim()
      ? obj.start_time
      : base.start_time;
  const start_date =
    typeof obj.start_date === "string" && obj.start_date.trim()
      ? obj.start_date
      : base.start_date;

  const res = obj.starting_resources;
  const metall =
    res && typeof res.metall === "number" && Number.isFinite(res.metall)
      ? res.metall
      : base.starting_resources.metall;
  const kristall =
    res && typeof res.kristall === "number" && Number.isFinite(res.kristall)
      ? res.kristall
      : base.starting_resources.kristall;

  const plan =
    Array.isArray(obj.plan) && obj.plan.every((x) => typeof x === "string") && obj.plan.length > 0
      ? [...obj.plan]
      : base.plan;

  const economyOrders = normalizeEconomyOrders(
    (obj as { economyOrders?: unknown }).economyOrders,
  );

  return {
    start_time,
    start_date,
    starting_resources: { metall, kristall },
    plan,
    economyOrders,
  };
}

function loadStoredConfig(): StartConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = normalizeConfig(defaultConfig);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return normalizeConfig(defaultConfig);
  }
}

export default function App() {
  const [startCfg, setStartCfg] = useState<StartConfig>(() => loadStoredConfig());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(startCfg));
    } catch (err) {
      console.error("Konnte Plan nicht speichern", err);
    }
  }, [startCfg]);

  const planNames = startCfg.plan;
  const economyOrders = startCfg.economyOrders ?? [];
  const hasObservatorium = planNames.includes("Observatorium");
  const hasExtraktorTech = planNames.includes("Extraktor");
  const canUseUnits = hasExtraktorTech;

  const plan = useMemo(() => {
    try {
      return calculateFastestWayToGoal(startCfg);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [startCfg]);

  const defaultEconomyTick = useMemo(() => {
    if (!plan) return 0;
    const ext = plan.steps.find((s) => s.name === "Extraktor");
    if (ext) return ext.endTick;
    const obs = plan.steps.find((s) => s.name === "Observatorium");
    return obs?.endTick ?? plan.finishTick;
  }, [plan]);

  const maxExtractorsAtTech = useMemo(() => {
    if (!plan || !hasExtraktorTech) return 0;
    const job = plan.steps.find((s) => s.name === "Extraktor");
    if (!job) return 0;
    const snap = plan.ticks.find((t) => t.tick === job.endTick);
    let met = snap?.met ?? plan.finalRes.met;
    let kris = snap?.kris ?? plan.finalRes.kris;
    for (const s of plan.steps) {
      if (s.startTick === job.endTick && s.type === "economy") {
        met += s.cost.met;
        kris += s.cost.kris;
      }
    }
    return maxAffordableExtractors({
      met,
      kris,
      alreadyBuilt: 0,
      asteroids: 0,
      slots: 0,
    });
  }, [plan, hasExtraktorTech]);

  const unlocked = useMemo(() => getUnlockedTechs(planNames), [planNames]);
  const techByName = useMemo(() => {
    return new Map(getTechtree().map((t) => [t.name, t]));
  }, []);

  const maxTick = Math.max(plan?.finishTick ?? 1, 1);
  const actionTicks = useMemo(
    () => (plan ? plan.ticks.filter((t) => t.started.length > 0) : []),
    [plan],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentTick = computeCurrentTick(startCfg, now);
  const nextAction = useMemo(
    () => actionTicks.find((t) => t.tick >= currentTick) ?? null,
    [actionTicks, currentTick],
  );

  const addToPlan = (name: string) => {
    setStartCfg((prev) =>
      prev.plan.includes(name) ? prev : { ...prev, plan: [...prev.plan, name] },
    );
  };

  const removeFromPlan = (index: number) => {
    setStartCfg((prev) => {
      const next = prev.plan.filter((_, i) => i !== index);
      return {
        ...prev,
        plan: next.length > 0 ? next : [...FALLBACK_PLAN],
      };
    });
  };

  const movePlanItem = (index: number, direction: -1 | 1) => {
    setStartCfg((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.plan.length) return prev;
      const next = [...prev.plan];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return { ...prev, plan: next };
    });
  };

  const addEconomyOrder = (order: EconomyOrder) => {
    setStartCfg((prev) => ({
      ...prev,
      economyOrders: [...(prev.economyOrders ?? []), order],
    }));
  };

  const removeEconomyOrder = (id: string) => {
    setStartCfg((prev) => ({
      ...prev,
      economyOrders: (prev.economyOrders ?? []).filter((o) => o.id !== id),
    }));
  };

  const resetPlan = () => {
    setStartCfg(normalizeConfig(defaultConfig));
  };

  return (
    <TooltipProvider>
      <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
        <Header
          now={now}
          currentTick={currentTick}
          startCfg={startCfg}
          plan={plan}
          nextAction={nextAction}
        />
        <div className="grid min-h-0 flex-1 grid-cols-[22rem_minmax(0,1fr)]">
          <Sidebar
            unlocked={unlocked}
            planNames={planNames}
            techByName={techByName}
            plan={plan}
            startCfg={startCfg}
            canUseUnits={canUseUnits}
            hasObservatorium={hasObservatorium}
            economyOrders={economyOrders}
            defaultEconomyTick={defaultEconomyTick}
            maxExtractorsAtTech={maxExtractorsAtTech}
            onAddTech={addToPlan}
            onMoveTech={movePlanItem}
            onRemoveTech={removeFromPlan}
            onAddOrder={addEconomyOrder}
            onRemoveOrder={removeEconomyOrder}
            onReset={resetPlan}
          />
          <Overview
            actionTicks={actionTicks}
            logTicks={plan?.ticks ?? []}
            steps={plan?.steps ?? []}
            maxTick={maxTick}
            currentTick={currentTick}
            hasPlan={!!plan}
          />
        </div>
      </main>
    </TooltipProvider>
  );
}
