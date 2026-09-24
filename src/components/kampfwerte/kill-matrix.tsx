import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { formatNumber, formatRatio, formatShare, ratioStyle } from "@/components/kampfwerte/format";
import { combatUnits, valueRatio, type CombatUnit } from "@/gn-data/kampfwerte";
import { cn } from "@/lib/utils/cn";

const GROUPS: { kind: CombatUnit["kind"]; label: string }[] = [
  { kind: "defense", label: "Geschütze" },
  { kind: "ship", label: "Schiffe" },
];

const shooters = combatUnits.filter((u) => u.shots.length > 0);

/**
 * Trennlinien zwischen Geschützen und Schiffen, kräftiger als die Zeilenlinien.
 * Seitenspezifische Farbe, sonst färbt sie auch die übrigen Zellränder.
 */
const DIVIDER_LEFT = "border-l border-l-foreground/25";
const DIVIDER_TOP = "border-t border-t-foreground/25";

function startsGroup(units: CombatUnit[], index: number) {
  return index > 0 && units[index - 1].kind !== units[index].kind;
}

/** Schütze × Ziel: Abschüsse je Tick, eingefärbt nach Wertquote. */
export function KillMatrix() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            <th
              colSpan={2}
              rowSpan={2}
              className="sticky left-0 z-10 border-b border-border bg-background pr-3 pb-2.5 pl-9 text-left align-bottom text-[10px] font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase"
            >
              Schütze ↓ · Ziel →
            </th>
            {GROUPS.map((group, i) => (
              <th
                key={group.kind}
                colSpan={combatUnits.filter((u) => u.kind === group.kind).length}
                className={cn(
                  "px-2 pt-3 pb-1.5 text-center text-[10px] font-medium tracking-wider text-muted-foreground uppercase",
                  i > 0 && DIVIDER_LEFT,
                )}
              >
                {group.label}
              </th>
            ))}
          </tr>
          <tr>
            {combatUnits.map((target, i) => (
              <th
                key={target.name}
                className={cn(
                  "border-b border-border px-1 pb-2.5 text-center text-[11px] font-medium",
                  startsGroup(combatUnits, i) && DIVIDER_LEFT,
                )}
              >
                {target.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shooters.map((shooter, row) => {
            const groupStart = row === 0 || startsGroup(shooters, row);
            // Horizontale Trennlinie an den Zellen, tr-Rahmen sind mit rowSpan unzuverlässig.
            const top = startsGroup(shooters, row) && DIVIDER_TOP;
            return (
              <tr
                key={shooter.name}
                className="border-b border-border/50 last:border-b-0"
              >
                {groupStart ? (
                  <th
                    rowSpan={shooters.filter((u) => u.kind === shooter.kind).length}
                    className={cn("sticky left-0 z-10 w-7 bg-background px-1 align-middle", top)}
                  >
                    <span className="block rotate-180 text-[10px] font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase [writing-mode:vertical-rl]">
                      {GROUPS.find((g) => g.kind === shooter.kind)?.label}
                    </span>
                  </th>
                ) : null}
                <th className={cn("sticky left-7 z-10 bg-background py-1 pr-3 pl-2 text-left font-medium whitespace-nowrap", top)}>
                  {shooter.name}
                </th>
                {combatUnits.map((target, i) => {
                  const shot = shooter.shots.find((s) => s.target === target.name);
                  const divider = cn(startsGroup(combatUnits, i) && DIVIDER_LEFT, top);
                  if (!shot) {
                    return <td key={target.name} className={cn("p-0.5", divider)} />;
                  }
                  const ratio = valueRatio(shooter, shot);
                  return (
                    <td key={target.name} className={cn("p-0.5", divider)}>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <div
                              className="flex min-w-14 cursor-default flex-col items-center rounded-sm px-1 py-1 leading-tight"
                              style={ratioStyle(ratio)}
                            />
                          }
                        >
                          <span className="font-medium">{formatNumber(shot.perTick)}</span>
                          <span className="text-[10px] opacity-70">{formatRatio(ratio)}</span>
                        </TooltipTrigger>
                        <TooltipContent className="flex-col items-start gap-0.5 text-left">
                          <span className="font-medium">
                            {shooter.name} → {target.name}
                          </span>
                          <span className="text-muted-foreground">
                            {formatNumber(shot.perTick)} {target.name} je Schütze und Tick
                          </span>
                          <span className="text-muted-foreground">
                            Verteilung {formatShare(shot.share)} · Wertquote {formatRatio(ratio)}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
