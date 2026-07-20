import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import {
  formatRes,
  type JobKind,
  type TickSnapshot,
} from "@/lib/calculateFastestWayToGoal";
import { cn } from "@/lib/utils/cn";

export type DisplayJob = { name: string; type: JobKind; suffix?: string };

export function jobTypeClass(type: JobKind) {
  if (type === "building") return "text-amber-500";
  if (type === "research") return "text-fuchsia-500";
  return "text-sky-500";
}

/** Asteroiden/Extraktoren pro Tick zusammenfassen statt einzeln zu listen. */
export function collapseEconomyJobs(items: DisplayJob[]): DisplayJob[] {
  let asteroids = 0;
  let extractorsMet = 0;
  let extractorsKris = 0;
  let extractorsGeneric = 0;
  const rest: DisplayJob[] = [];

  for (const item of items) {
    if (item.type === "economy" && item.name.startsWith("Asteroid scannen")) {
      asteroids += 1;
      continue;
    }
    if (item.type === "economy" && item.name.startsWith("Extraktor (Metall)")) {
      extractorsMet += 1;
      continue;
    }
    if (item.type === "economy" && item.name.startsWith("Extraktor (Kristall)")) {
      extractorsKris += 1;
      continue;
    }
    if (item.type === "economy" && /^Extraktor\b/.test(item.name)) {
      extractorsGeneric += 1;
      continue;
    }
    rest.push(item);
  }

  const out: DisplayJob[] = [];
  if (asteroids > 0) {
    out.push({
      name: asteroids === 1 ? "1 Asteroid scannen" : `${asteroids} Asteroiden scannen`,
      type: "economy",
    });
  }
  if (extractorsMet > 0) {
    out.push({
      name:
        extractorsMet === 1
          ? "1 Metallextraktor bauen"
          : `${extractorsMet} Metallextraktoren bauen`,
      type: "economy",
    });
  }
  if (extractorsKris > 0) {
    out.push({
      name:
        extractorsKris === 1
          ? "1 Kristallextraktor bauen"
          : `${extractorsKris} Kristallextraktoren bauen`,
      type: "economy",
    });
  }
  if (extractorsGeneric > 0) {
    out.push({
      name:
        extractorsGeneric === 1
          ? "1 Extraktor bauen"
          : `${extractorsGeneric} Extraktoren bauen`,
      type: "economy",
    });
  }
  return [...out, ...rest];
}

export function JobList({ items }: { items: DisplayJob[] }) {
  const collapsed = collapseEconomyJobs(items);
  return (
    <span className="inline">
      {collapsed.map((item, i) => (
        <span key={`${item.name}-${i}`}>
          {i > 0 && <span className="text-muted-foreground">, </span>}
          <span className={jobTypeClass(item.type)}>
            {item.name}
            {item.suffix ? (
              <span className="text-muted-foreground"> {item.suffix}</span>
            ) : null}
          </span>
        </span>
      ))}
    </span>
  );
}

function deltaClass(n: number) {
  if (n > 0) return "text-green-500";
  if (n < 0) return "text-red-500";
  return "";
}

function formatDelta(n: number) {
  if (!n) return "—";
  return `${n > 0 ? "+" : ""}${formatRes(n)}`;
}

function TruncateCell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <TableCell className={cn("max-w-0", className)}>
      <div className="truncate">{children}</div>
    </TableCell>
  );
}

/** Vollständiges Tick-Protokoll (Ressourcen + Aktiv/Start/Ende). */
export function TickTable({
  ticks,
  currentTick,
}: {
  ticks: TickSnapshot[];
  currentTick: number;
}) {
  const highlightTick = ticks.reduce<number | null>((best, t) => {
    if (t.tick > currentTick) return best;
    if (best === null || t.tick > best) return t.tick;
    return best;
  }, null);

  return (
    <Table className="table-fixed" containerClassName="overflow-x-hidden">
      <colgroup>
        <col className="w-14" />
        <col className="w-28" />
        <col className="w-18" />
        <col className="w-18" />
        <col className="w-14" />
        <col className="w-14" />
        <col />
        <col className="w-60" />
        <col className="w-60" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Tick</TableHead>
          <TableHead>Uhrzeit</TableHead>
          <TableHead className="text-right">Met</TableHead>
          <TableHead className="text-right">Kris</TableHead>
          <TableHead className="text-right">+M</TableHead>
          <TableHead className="text-right">+K</TableHead>
          <TableHead>Aktiv</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>Ende</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ticks.map((t) => {
          const isCurrent = highlightTick !== null && t.tick === highlightTick;
          return (
            <TableRow key={t.tick}>
              <TableCell className="tabular-nums">{t.tick}</TableCell>
              <TableCell className={cn("tabular-nums", isCurrent && "text-green-500")}>
                {t.clockLabel}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatRes(t.met)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatRes(t.kris)}</TableCell>
              <TableCell className={cn("text-right tabular-nums", deltaClass(t.incomeMet))}>
                {formatDelta(t.incomeMet)}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums", deltaClass(t.incomeKris))}>
                {formatDelta(t.incomeKris)}
              </TableCell>
              <TruncateCell>
                {t.active.length ? (
                  <JobList
                    items={t.active.map((j) => ({
                      name: j.name,
                      type: j.type,
                      suffix: `(${j.remainingTicks})`,
                    }))}
                  />
                ) : (
                  "—"
                )}
              </TruncateCell>
              <TruncateCell>
                {t.started.length ? <JobList items={t.started} /> : "—"}
              </TruncateCell>
              <TruncateCell>
                {t.finished.length ? <JobList items={t.finished} /> : "—"}
              </TruncateCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export type ActionPlanProps = {
  ticks: TickSnapshot[];
  currentTick: number;
  hasPlan: boolean;
};

/** Kompakter Auftragsplan: Tick · Uhrzeit · Auftrag */
export function ActionPlan({ ticks, currentTick, hasPlan }: ActionPlanProps) {
  if (!hasPlan) {
    return <p className="p-4 text-sm text-muted-foreground">Kein Plan berechenbar.</p>;
  }

  const highlightTick = ticks.reduce<number | null>((best, t) => {
    if (t.tick > currentTick) return best;
    if (best === null || t.tick > best) return t.tick;
    return best;
  }, null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tick</TableHead>
          <TableHead>Uhrzeit</TableHead>
          <TableHead>Auftrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ticks.map((t) => {
          const isCurrent = highlightTick !== null && t.tick === highlightTick;
          return (
            <TableRow key={t.tick}>
              <TableCell>{t.tick}</TableCell>
              <TableCell className={cn(isCurrent && "text-green-500")}>{t.clockLabel}</TableCell>
              <TableCell>{t.started.length ? <JobList items={t.started} /> : "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
