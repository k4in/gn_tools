import type { ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { defenses } from "@/gn-data/defense";
import { ships } from "@/gn-data/ships";
import { formatRes } from "@/lib/calculateFastestWayToGoal";
import {
  analyzeHistory,
  countMismatches,
  currentResources,
  earlyGameEstimate,
  estimateResources,
  latestPointsUpdate,
  type HistoryPoint,
  type HistoryStep,
} from "@/lib/scan-analysis";
import { SHIP_SCAN_LABEL, type TargetScans } from "@/lib/scan-parser";
import { cn } from "@/lib/utils/cn";

function formatSigned(n: number) {
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${formatRes(rounded)}`;
}

function formatTime(time: number | undefined) {
  if (time === undefined) return null;
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Uhrzeiten hervorgehoben, damit auf einen Blick klar ist, von wann ein Wert stammt. */
/**
 * Uhrzeiten nach Quelle eingefärbt, in den Planer-Farben: gelb (wie Gebäude) für
 * Sektor-, Einheiten- und Geschützscans, violett (wie Forschung) für Punktzeilen.
 */
function Timestamp({
  time,
  short = false,
  source = "scan",
}: {
  time: number | undefined;
  short?: boolean;
  source?: "scan" | "points";
}) {
  const label = formatTime(time);
  if (!label) return null;
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        source === "points" ? "text-fuchsia-500" : "text-amber-500",
      )}
    >
      {short ? label.slice(-5) : label}
    </span>
  );
}

function pointSource(point: HistoryPoint) {
  return point.source === "points" ? "points" : "scan";
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function ScanMeta({ accuracy, time }: { accuracy: number; time?: number }) {
  return (
    <>
      {accuracy < 100 ? (
        <span className="ml-1.5 font-normal normal-case text-yellow-300">{accuracy} %</span>
      ) : null}
      {time !== undefined ? (
        <span className="ml-1.5 normal-case tracking-normal">
          <Timestamp time={time} />
        </span>
      ) : null}
    </>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground/70">{children}</p>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{formatRes(value)}</span>
    </div>
  );
}

function UnitList({ rows }: { rows: { name: string; label?: string; count: number }[] }) {
  if (rows.length === 0) return <Missing>keine vorhanden</Missing>;
  const sum = rows.reduce((acc, row) => acc + row.count, 0);
  return (
    <ul className="mt-2 flex flex-col text-xs tabular-nums">
      {rows.map((row) => (
        <li key={row.name} className="flex items-baseline justify-between gap-3 py-0.5">
          <span>
            {row.name}
            {row.label ? <span className="ml-1.5 text-muted-foreground">{row.label}</span> : null}
          </span>
          <span className="font-medium">{formatRes(row.count)}</span>
        </li>
      ))}
      <li className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1.5 text-muted-foreground">
        <span>Summe</span>
        <span>{formatRes(sum)}</span>
      </li>
    </ul>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-xs text-yellow-300">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function formatPercent(share: number) {
  return `${(share * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function verdictLabel(step: Pick<HistoryStep, "verdict" | "shortfall">) {
  const tax = step.shortfall !== null ? formatPercent(step.shortfall) : null;
  switch (step.verdict) {
    case "same-tick":
      return "gleicher Tick";
    case "normal":
      return tax ? `normal (Steuern ${tax})` : "normal";
    case "suspicious":
      return tax ? `auffällig (Steuern ${tax})` : "auffällig";
    case "building":
      return "Einheiten im Bau";
    case "finished":
      return "Einheiten fertig";
  }
}

const VERDICT_CLASS: Record<HistoryStep["verdict"], string> = {
  "same-tick": "text-muted-foreground",
  normal: "text-green-500",
  suspicious: "text-yellow-300",
  building: "text-destructive",
  finished: "text-emerald-400",
};

/** Hinweis, ob der fortgeschriebene Rohstoffwert noch zum Einkommen passt. */
function CarryForwardHint({
  verdict,
  shortfall,
  since,
}: {
  verdict: HistoryStep["verdict"];
  shortfall: number | null;
  since: number;
}) {
  if (verdict === "same-tick") return null;
  const tax = shortfall !== null ? formatPercent(shortfall) : "";
  const sinceLabel = <Timestamp time={since} />;
  if (verdict === "normal") {
    return (
      <p className="text-xs text-green-500">
        Zuwachs seit {sinceLabel} passt zum Einkommen, vermutlich {tax} Steuern. Der Wert ist
        verlässlich.
      </p>
    );
  }
  if (verdict === "suspicious") {
    return (
      <Notice>
        Zuwachs seit {sinceLabel} liegt {tax} unter dem Maximum. Eher Steuern als ein Bau, zur
        Sicherheit neu scannen.
      </Notice>
    );
  }
  return (
    <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <div>
        {verdict === "building"
          ? `Punkte liegen deutlich unter dem Erwarteten: Einheiten im Bau.`
          : `Punkte liegen über dem möglichen Einkommen: Einheiten sind fertig geworden.`}{" "}
        Der Rohstoffwert ist unzuverlässig. Bitte neuen Sektor-, Einheiten- und Geschützscan machen.
      </div>
    </div>
  );
}

/** Early-Game ohne Geschützscan: Rohstoffe nur als Spanne. */
function ResourceRange({ entry }: { entry: TargetScans }) {
  const estimate = earlyGameEstimate(entry);
  if (!estimate || !entry.sector) return null;
  if (estimate.inconsistent) {
    return (
      <Missing>
        Die Punkte reichen nicht einmal für lauter Horus. Die Early-Game-Annahme passt hier nicht.
      </Missing>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-2xl font-semibold tabular-nums">
          {formatRes(estimate.resourcesMin)} – {formatRes(estimate.resourcesMax)}
        </span>
        <span className="text-xs text-muted-foreground">
          Metall + Kristall · Stand <Timestamp time={entry.sector.time} />
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Spanne je nach Verhältnis von Rubium zu Horus: keine Rubium ergibt den Höchstwert, möglichst
        viele den Mindestwert. Mit einem Geschützscan wird die Zahl exakt.
      </p>
    </div>
  );
}

function Resources({ entry, earlyGame }: { entry: TargetScans; earlyGame: boolean }) {
  const estimate = estimateResources(entry, earlyGame);
  if (estimate === null && earlyGame && entry.sector) return <ResourceRange entry={entry} />;
  if (estimate === null) {
    const missing = [
      !entry.sector && "Sektorscan",
      entry.sector && !entry.units && entry.sector.ships > 0 && "Einheitenscan",
      entry.sector && !entry.defense && entry.sector.defense > 0 && "Geschützscan",
    ].filter(Boolean);
    return <Missing>Für die Berechnung fehlt: {missing.join(", ")}</Missing>;
  }
  const { resources, sector, mismatched } = estimate;
  const olderSector = sector !== entry.sector;
  const current = mismatched ? null : currentResources(entry, estimate);

  if (current) {
    const unreliable = current.comparison.verdict === "building" || current.comparison.verdict === "finished";
    return (
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-heading text-2xl font-semibold tabular-nums",
              (unreliable || current.resources < 0) && "text-yellow-300",
            )}
          >
            {formatRes(current.resources)}
          </span>
          <span className="text-xs text-muted-foreground">
            Metall + Kristall · Stand{" "}
            <Timestamp time={current.point.time} source={pointSource(current.point)} />
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Fortgeschrieben vom Sektorscan <Timestamp time={sector.time} /> (
          {formatRes(resources)} Rohstoffe) mit dem Punktestand von{" "}
          <Timestamp time={current.point.time} source={pointSource(current.point)} />, unter der Annahme, dass keine Einheiten dazugekommen
          sind.
        </p>
        <CarryForwardHint
          verdict={current.comparison.verdict}
          shortfall={current.comparison.shortfall}
          since={sector.time!}
        />
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-heading text-2xl font-semibold tabular-nums",
            (resources < 0 || mismatched) && "text-yellow-300",
          )}
        >
          {formatRes(resources)}
        </span>
        <span className="text-xs text-muted-foreground">Metall + Kristall</span>
      </div>
      {mismatched ? (
        <p className="text-xs text-yellow-300">
          Unsicher: Kein Sektorscan passt zu den Zahlen aus Einheiten- und Geschützscan.
        </p>
      ) : resources < 0 ? (
        <p className="text-xs text-yellow-300">
          Negativ: Die Scans passen nicht zusammen, vermutlich ist einer veraltet.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Stand{" "}
        {sector.time !== undefined ? <Timestamp time={sector.time} /> : "ohne Zeitmarke"}, berechnet
        mit dem Sektorscan von diesem Zeitpunkt
        {olderSector && !mismatched
          ? ". Neuere Sektorscans passen nicht zu Einheiten- und Geschützscan."
          : "."}
      </p>
    </div>
  );
}

function EarlyGame({ entry }: { entry: TargetScans }) {
  const estimate = earlyGameEstimate(entry);
  if (!estimate) return null;
  if (estimate.defense === 0) return <Missing>Keine Geschütze im Sektorscan.</Missing>;
  if (estimate.inconsistent) {
    return (
      <Missing>
        Die Punkte reichen nicht einmal für lauter Horus. Vermutlich gibt es schon andere
        Einheiten, die Early-Game-Annahme passt hier nicht.
      </Missing>
    );
  }
  const share = estimate.rubiumMax / estimate.defense;
  return (
    <div className="mt-2 flex flex-col gap-2 text-xs">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-green-500" style={{ width: `${share * 100}%` }} />
      </div>
      <p>
        Von {formatRes(estimate.defense)} Geschützen sind{" "}
        <span className="font-medium">höchstens {formatRes(estimate.rubiumMax)} Rubium</span> (
        {Math.round(share * 100)} %), der Rest Horus. Das gilt, wenn keine Rohstoffe herumliegen.
      </p>
      <p className="text-muted-foreground">
        Liegen Rohstoffe herum, sind es entsprechend weniger Rubium.
      </p>
    </div>
  );
}

function formatDelta(n: number | null) {
  if (n === null) return <span className="text-muted-foreground/60" title="Nur Punktzeile, keine Einheitenzahlen">?</span>;
  return n ? formatSigned(n) : "—";
}

function History({ steps }: { steps: HistoryStep[] }) {
  return (
    <table className="mt-2 w-full text-xs tabular-nums">
      <thead className="text-[11px] text-muted-foreground">
        <tr className="border-b border-border">
          <th className="py-1 text-left font-normal">Zeitraum</th>
          <th className="py-1 text-right font-normal">Ticks</th>
          <th className="py-1 text-right font-normal">Punkte</th>
          <th className="py-1 text-right font-normal">erwartet</th>
          <th className="py-1 pl-4 text-left font-normal">Bewertung</th>
          <th className="py-1 text-right font-normal">Exen</th>
          <th className="py-1 text-right font-normal">Schiffe</th>
          <th className="py-1 text-right font-normal">Vert.</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step) => (
          <tr key={`${step.from.time}-${step.to.time}`} className="border-b border-border/50 last:border-b-0">
            <td className="py-1.5 whitespace-nowrap">
              <Timestamp time={step.from.time} source={pointSource(step.from)} /> →{" "}
              <Timestamp time={step.to.time} source={pointSource(step.to)} short />
            </td>
            <td className="py-1.5 text-right">{step.ticks}</td>
            <td className="py-1.5 text-right">{formatSigned(step.pointsDelta)}</td>
            <td className="py-1.5 text-right text-muted-foreground">
              {step.ticks > 0 ? `${formatRes(step.lower)}–${formatRes(step.upper)}` : "—"}
            </td>
            <td
              className={cn(
                "py-1.5 pl-4",
                VERDICT_CLASS[step.verdict],
              )}
            >
              {verdictLabel(step)}
              {step.verdict === "building" ? (
                <span className="text-muted-foreground"> · bis zu {formatRes(step.spentResources)} Res</span>
              ) : null}
            </td>
            <td className="py-1.5 text-right">{formatDelta(step.extractorsDelta)}</td>
            <td className="py-1.5 text-right">{formatDelta(step.shipsDelta)}</td>
            <td className="py-1.5 text-right">{formatDelta(step.defenseDelta)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Überschrift einer Gruppe mit durchgezogener Linie, trennt Scan-Daten und Auswertung. */
function GroupHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h4 className="text-[11px] font-semibold tracking-wider text-foreground/80 uppercase">
        {children}
      </h4>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function TargetAnalysis({ entry, earlyGame }: { entry: TargetScans; earlyGame: boolean }) {
  const { sector, units, defense } = entry;
  const shipRows = ships
    .filter((s) => units?.units[s.name] !== undefined)
    .map((s) => ({ name: s.name, label: SHIP_SCAN_LABEL[s.name], count: units!.units[s.name]! }));
  const defenseRows = defenses
    .filter((d) => defense?.units[d.name] !== undefined)
    .map((d) => ({ name: d.name, count: defense!.units[d.name]! }));
  const mismatches = countMismatches(entry);
  const steps = analyzeHistory(entry);
  const pointsUpdate = latestPointsUpdate(entry);
  // Letzter Punktestand: Punktzeile, falls neuer als der Sektorscan, sonst der Sektorscan.
  const latestPoints = pointsUpdate ?? (sector ? { points: sector.points, time: sector.time } : null);
  const showEarlyGame = earlyGame && sector && !defense;

  return (
    <div className="flex flex-col gap-5">
      {earlyGame ? (
        <div className="flex gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs/relaxed text-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-green-500" />
          <p>
            <span className="font-medium">Early-Game-Modus:</span> Angenommen wird, dass es nur Horus,
            Rubium, Cleptor und Cancri gibt. Cleptor und Cancri kosten beide 2.500, daher reicht ein
            Sektorscan für die Auswertung. Ohne Geschützscan werden Rohstoffe und das Verhältnis von
            Rubium zu Horus als Spanne geschätzt.
          </p>
        </div>
      ) : null}
      <GroupHeading>Scan-Daten</GroupHeading>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-muted/20">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-6 p-4">
          <section>
            <SectionLabel>
              Letzter Sektorscan
              {sector ? <ScanMeta accuracy={sector.accuracy} time={sector.time} /> : null}
            </SectionLabel>
            {sector ? (
              <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-3">
                <Stat label="Punkte" value={sector.points} />
                <Stat label="Schiffe" value={sector.ships} />
                <Stat label="Verteidigung" value={sector.defense} />
                <Stat label="M-Extraktoren" value={sector.extractorsMet} />
                <Stat label="K-Extraktoren" value={sector.extractorsKris} />
                <Stat label="Asteroiden" value={sector.asteroids} />
              </div>
            ) : (
              <Missing>Kein Sektorscan</Missing>
            )}
          </section>
          <section className="min-w-40 border-l border-border pl-6">
            <SectionLabel>
              Letzter Punktestand
              {latestPoints?.time !== undefined ? (
                <span className="ml-1.5 normal-case tracking-normal">
                  <Timestamp time={latestPoints.time} source={pointsUpdate ? "points" : "scan"} />
                </span>
              ) : null}
            </SectionLabel>
            {latestPoints ? (
              <div className="mt-2 font-heading text-xl font-semibold tabular-nums">
                {formatRes(latestPoints.points)}
              </div>
            ) : (
              <Missing>—</Missing>
            )}
            {pointsUpdate ? (
              <p className="mt-1 text-[11px] text-muted-foreground">aus Punktzeile</p>
            ) : null}
          </section>
        </div>
        <div className="grid grid-cols-2 gap-6 p-4">
          <section>
            <SectionLabel>
              Schiffe
              {units ? <ScanMeta accuracy={units.accuracy} time={units.time} /> : null}
            </SectionLabel>
            {units ? <UnitList rows={shipRows} /> : <Missing>Kein Einheitenscan</Missing>}
          </section>
          <section>
            <SectionLabel>
              Geschütze
              {defense ? <ScanMeta accuracy={defense.accuracy} time={defense.time} /> : null}
            </SectionLabel>
            {defense ? <UnitList rows={defenseRows} /> : <Missing>Kein Geschützscan</Missing>}
          </section>
        </div>
      </div>

      <GroupHeading>Auswertung</GroupHeading>

      {!sector ? (
        <Notice>
          Nur Punktestände, kein Sektorscan. Für Rohstoffe und Verlauf braucht es mindestens einen
          Sektorscan dieses Ziels.
        </Notice>
      ) : null}

      {mismatches.length > 0 ? (
        <Notice>
          {mismatches.map((m) => (
            <p key={m.kind}>
              {m.kind === "ships" ? "Einheitenscan" : "Geschützscan"}: {formatRes(m.scanned)}{" "}
              {m.kind === "ships" ? "Schiffe" : "Geschütze"}, Sektorscan: {formatRes(m.sector)}.
              Einer der Scans ist vermutlich veraltet.
            </p>
          ))}
        </Notice>
      ) : null}

      <section>
        <SectionLabel>Rohstoffe</SectionLabel>
        <Resources entry={entry} earlyGame={earlyGame} />
      </section>

      {showEarlyGame ? (
        <section>
          <SectionLabel>Early-Game-Schätzung</SectionLabel>
          <EarlyGame entry={entry} />
        </section>
      ) : null}

      {steps.length > 0 ? (
        <section>
          <SectionLabel>Punkteverlauf</SectionLabel>
          <History steps={steps} />
        </section>
      ) : null}
    </div>
  );
}
