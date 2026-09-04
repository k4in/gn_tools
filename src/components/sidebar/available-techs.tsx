import { useMemo, useState } from "react";
import { jobTypeClass } from "@/components/overview/actionplan";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { StatusDot } from "@/components/sidebar/status-dot";
import { formatRes } from "@/lib/calculateFastestWayToGoal";
import type { TechTreeEntry } from "@/gn-data/techtree";

export type AvailableTechsProps = {
  techs: TechTreeEntry[];
  needed: Set<string>;
  planned: Set<string>;
  onAdd: (name: string) => void;
};

export function AvailableTechs({ techs, needed, planned, onAdd }: AvailableTechsProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return techs;
    return techs.filter((tech) => tech.name.toLowerCase().includes(q));
  }, [techs, query]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 py-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtern…"
          aria-label="Technologien filtern"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {filtered.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">
              {techs.length === 0
                ? "Keine weiteren Technologien"
                : "Keine Treffer"}
            </li>
          ) : (
            filtered.map((tech) => {
              const blocked = tech.dependencies.some((dep) => !planned.has(dep));
              return (
                <li key={tech.name}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onAdd(tech.name)}
                    className="h-auto w-full justify-between gap-2 px-2 py-1.5 text-left font-normal whitespace-normal"
                  >
                    <span className="min-w-0">
                      <span className={jobTypeClass(tech.type)}>
                        {tech.name}
                        {needed.has(tech.name) ? <StatusDot kind="needed" /> : null}
                        {blocked ? <StatusDot kind="blocked" /> : null}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                        {tech.ticks} T · {formatRes(tech.cost.met)} M ·{" "}
                        {formatRes(tech.cost.kris)} K
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">+</span>
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </section>
  );
}
