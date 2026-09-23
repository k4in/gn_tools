import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { formatNumber, formatRatio, formatShare, ratioHue } from "@/components/kampfwerte/format";
import { combatUnits, valueRatio } from "@/gn-data/kampfwerte";
import { cn } from "@/lib/utils/cn";

const shooters = combatUnits.filter((u) => u.shots.length > 0);

/** Schütze × Ziel: Abschüsse je Tick, eingefärbt nach Wertquote. */
export function KillMatrix() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-border bg-background px-3 py-2 text-left text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Schütze ↓ · Ziel →
            </th>
            {combatUnits.map((target, i) => (
              <th
                key={target.name}
                className={cn(
                  "border-b border-border px-1 py-2 text-center text-[11px] font-medium",
                  target.kind === "defense" ? "text-muted-foreground" : "text-foreground",
                  i > 0 &&
                    combatUnits[i - 1].kind !== target.kind &&
                    "border-l border-l-border",
                )}
              >
                {target.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shooters.map((shooter, row) => (
            <tr
              key={shooter.name}
              className={cn(
                "border-b border-border/50 last:border-b-0",
                row > 0 &&
                  shooters[row - 1].kind !== shooter.kind &&
                  "border-t border-t-border",
              )}
            >
              <th className="sticky left-0 z-10 bg-background px-3 py-1 text-left font-medium whitespace-nowrap">
                {shooter.name}
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  {shooter.kind === "defense" ? "Geschütz" : "Schiff"}
                </span>
              </th>
              {combatUnits.map((target, i) => {
                const shot = shooter.shots.find((s) => s.target === target.name);
                const divider =
                  i > 0 && combatUnits[i - 1].kind !== target.kind && "border-l border-l-border";
                if (!shot) {
                  return <td key={target.name} className={cn("p-0.5", divider)} />;
                }
                const ratio = valueRatio(shooter, shot);
                const hue = ratioHue(ratio);
                return (
                  <td key={target.name} className={cn("p-0.5", divider)}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <div
                            className="flex min-w-14 cursor-default flex-col items-center rounded-sm px-1 py-1 leading-tight"
                            style={{
                              backgroundColor: `oklch(0.6 0.14 ${hue} / 0.22)`,
                              color: `oklch(0.86 0.13 ${hue})`,
                            }}
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
                          Verteilung {formatShare(shot.share)} · Wertquote {formatNumber(ratio, 3)}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
