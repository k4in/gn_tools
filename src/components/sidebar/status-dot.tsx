import { cn } from "@/lib/utils/cn";

export type StatusDotKind = "needed" | "blocked";

export function StatusDot({ kind }: { kind: StatusDotKind }) {
  return (
    <span
      className={cn(
        "ml-1 inline-block size-1.5 shrink-0 rounded-full align-middle",
        kind === "needed" ? "bg-primary" : "bg-destructive",
      )}
      title={kind === "needed" ? "Für den Plan benötigt" : "Abhängigkeiten fehlen"}
    />
  );
}
