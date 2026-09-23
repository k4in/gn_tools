import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import { formatNumber, formatPreFire, formatShare } from "@/components/kampfwerte/format";
import type { CombatUnit } from "@/gn-data/kampfwerte";
import { formatRes } from "@/lib/calculateFastestWayToGoal";

function Targets({ unit }: { unit: CombatUnit }) {
  if (!unit.shots.length) return <span className="text-muted-foreground">kein Schaden</span>;
  return (
    <div className="grid w-fit grid-cols-[auto_auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
      {unit.shots.map((shot) => (
        <div key={shot.target} className="contents">
          <span>{shot.target}</span>
          <span className="text-right">{formatNumber(shot.perTick)}</span>
          <span className="text-right text-muted-foreground">{formatShare(shot.share)}</span>
        </div>
      ))}
    </div>
  );
}

export function UnitTable({
  units,
  showPreFire = false,
}: {
  units: CombatUnit[];
  showPreFire?: boolean;
}) {
  return (
    <Table className="table-fixed">
      <colgroup>
        <col className="w-40" />
        <col className="w-14" />
        <col className="w-20" />
        <col className="w-20" />
        <col className="w-22" />
        <col className="w-64" />
        {showPreFire ? <col className="w-36" /> : null}
        <col />
      </colgroup>
      <TableHeader className="static bg-transparent">
        <TableRow>
          <TableHead>Einheit</TableHead>
          <TableHead className="text-right">Bau</TableHead>
          <TableHead className="text-right">Metall</TableHead>
          <TableHead className="text-right">Kristall</TableHead>
          <TableHead className="text-right">Summe</TableHead>
          <TableHead className="pl-6">
            Ziel <span className="font-normal text-muted-foreground">· je Tick · Verteilung</span>
          </TableHead>
          {showPreFire ? <TableHead>Vorfeuer</TableHead> : null}
          <TableHead>Besonderheit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {units.map((unit) => (
          <TableRow key={unit.name} className="align-top hover:bg-muted/30">
            <TableCell className="py-2.5 align-top">
              <div className="font-medium">{unit.name}</div>
              <div className="text-[11px] text-muted-foreground">{unit.role}</div>
            </TableCell>
            <TableCell className="py-2.5 align-top text-right tabular-nums">{unit.ticks} T</TableCell>
            <TableCell className="py-2.5 align-top text-right tabular-nums">{formatRes(unit.cost.met)}</TableCell>
            <TableCell className="py-2.5 align-top text-right tabular-nums">{formatRes(unit.cost.kris)}</TableCell>
            <TableCell className="py-2.5 align-top text-right font-medium tabular-nums">{formatRes(unit.total)}</TableCell>
            <TableCell className="py-2.5 align-top pl-6">
              <Targets unit={unit} />
            </TableCell>
            {showPreFire ? (
              <TableCell className="py-2.5 align-top whitespace-pre tabular-nums">
                {formatPreFire(unit.preFire) ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
            ) : null}
            <TableCell className="py-2.5 align-top whitespace-normal text-muted-foreground">
              {unit.note ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
