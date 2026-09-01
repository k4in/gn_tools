import { useMemo, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import {
  ASTEROID_SLOT_CAPACITY,
  clockLabel,
  type PlanResult,
  type StartConfig,
} from "@/lib/calculateFastestWayToGoal";
import { cn } from "@/lib/utils/cn";

export type ExtractorsDialogProps = {
  startCfg: StartConfig;
  plan: PlanResult | null;
  currentTick: number;
  children: ReactNode;
};

type ExtractorEventRow = {
  sortTick: number;
  tickLabel: string;
  clockLabel: string;
  met: number;
  kris: number;
  asteroids: number;
  source: "Bau" | "Roid" | "Quest";
};

function sourceClass(source: ExtractorEventRow["source"]) {
  if (source === "Bau") return "text-sky-500";
  if (source === "Roid") return "text-blue-400";
  return "text-green-500";
}

function snapshotAtTick(plan: PlanResult, currentTick: number) {
  if (currentTick < 0) return null;
  let best: (typeof plan.ticks)[number] | null = null;
  for (const tick of plan.ticks) {
    if (tick.tick > currentTick) break;
    best = tick;
  }
  return best;
}

function buildRows(plan: PlanResult, startCfg: StartConfig): ExtractorEventRow[] {
  const rows: ExtractorEventRow[] = [];
  const roids = new Map<
    string,
    { start: number; end: number; met: number; kris: number; clock: string }
  >();

  for (const tick of plan.ticks) {
    let met = 0;
    let kris = 0;
    let asteroids = 0;
    for (const job of tick.started) {
      if (job.type !== "economy") continue;
      if (job.name.startsWith("Asteroid")) asteroids += 1;
      else if (job.name.startsWith("Extraktor (Metall)")) met += 1;
      else if (job.name.startsWith("Extraktor (Kristall)")) kris += 1;
    }
    if (met > 0 || kris > 0 || asteroids > 0) {
      rows.push({
        sortTick: tick.tick,
        tickLabel: String(tick.tick),
        clockLabel: tick.clockLabel,
        met,
        kris,
        asteroids,
        source: "Bau",
      });
    }

    for (const quest of tick.quests) {
      if (quest.reward.kind !== "extractors") continue;
      rows.push({
        sortTick: tick.tick,
        tickLabel: String(tick.tick),
        clockLabel: tick.clockLabel,
        met: quest.reward.resource === "met" ? quest.reward.count : 0,
        kris: quest.reward.resource === "kris" ? quest.reward.count : 0,
        asteroids: 0,
        source: "Quest",
      });
    }

    for (const loot of tick.roidLoot) {
      const current = roids.get(loot.planEntryId);
      if (!current) {
        roids.set(loot.planEntryId, {
          start: tick.tick,
          end: tick.tick,
          met: loot.met,
          kris: loot.kris,
          clock: tick.clockLabel,
        });
      } else {
        current.end = tick.tick;
        current.met += loot.met;
        current.kris += loot.kris;
      }
    }
  }

  for (const entry of startCfg.plan) {
    if (entry.kind !== "roid") continue;
    const loot = roids.get(entry.id);
    const start = loot?.start ?? entry.startTick;
    const end = loot?.end ?? entry.startTick + Math.max(0, entry.duration - 1);
    rows.push({
      sortTick: start,
      tickLabel: start === end ? String(start) : `${start}–${end}`,
      clockLabel: loot?.clock ?? clockLabel(startCfg, start),
      met: loot?.met ?? 0,
      kris: loot?.kris ?? 0,
      asteroids: 0,
      source: "Roid",
    });
  }

  const sourceOrder = { Bau: 0, Roid: 1, Quest: 2 };
  return rows.sort(
    (a, b) => a.sortTick - b.sortTick || sourceOrder[a.source] - sourceOrder[b.source],
  );
}

export function ExtractorsDialog({
  startCfg,
  plan,
  currentTick,
  children,
}: ExtractorsDialogProps) {
  const [open, setOpen] = useState(false);
  const snap = plan ? snapshotAtTick(plan, currentTick) : null;
  const rows = useMemo(
    () => (plan ? buildRows(plan, startCfg) : []),
    [plan, startCfg],
  );

  const asteroids = snap?.asteroids ?? 0;
  const metOwned = snap?.extractorsMet ?? 0;
  const krisOwned = snap?.extractorsKris ?? 0;
  const slots = asteroids * ASTEROID_SLOT_CAPACITY;
  const occupied = Math.min(metOwned + krisOwned, slots);
  const slotShortage = metOwned + krisOwned > slots;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className="flex min-w-28 cursor-pointer flex-col justify-center gap-0.5 rounded-md text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Extraktoren</DialogTitle>
          <DialogDescription>
            Bestand im aktuellen Tick und alle geplanten Zugänge.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Asteroiden
            </dt>
            <dd className="tabular-nums font-medium">{asteroids}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Flächen
            </dt>
            <dd className={cn("tabular-nums font-medium", slotShortage && "text-destructive")}>
              {occupied}/{slots}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Met-Exen
            </dt>
            <dd className="tabular-nums font-medium">{metOwned}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Kris-Exen
            </dt>
            <dd className="tabular-nums font-medium">{krisOwned}</dd>
          </div>
        </dl>
        <div className="max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tick</TableHead>
              <TableHead>Uhrzeit</TableHead>
              <TableHead className="text-right">+Met-Ex</TableHead>
              <TableHead className="text-right">+Kris-Ex</TableHead>
              <TableHead className="text-right">+Ast</TableHead>
              <TableHead>Quelle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Keine Extraktor-Einträge im Plan.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={`${row.source}-${row.tickLabel}-${i}`}>
                  <TableCell className="tabular-nums">{row.tickLabel}</TableCell>
                  <TableCell className="tabular-nums">{row.clockLabel}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", row.met > 0 && "text-green-500")}>
                    {row.met ? `+${row.met}` : "—"}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", row.kris > 0 && "text-green-500")}>
                    {row.kris ? `+${row.kris}` : "—"}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", row.asteroids > 0 && "text-green-500")}>
                    {row.asteroids ? `+${row.asteroids}` : "—"}
                  </TableCell>
                  <TableCell className={sourceClass(row.source)}>{row.source}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
