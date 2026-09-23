import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type StatusDotKind = "needed" | "blocked" | "delayed";

/**
 * Status-Marker hinter einem Namen. Bewusst verschiedene Formen, nicht nur
 * Farben: benötigt = hohler Ring, Voraussetzung fehlt = roter Punkt,
 * verspätet (Rohstoffe) = gelbe Uhr.
 */
export function StatusDot({ kind }: { kind: StatusDotKind }) {
  if (kind === "delayed") {
    return (
      <Clock3
        aria-label="Start verspätet (Rohstoffe)"
        className="ml-1 inline-block size-3 shrink-0 align-[-2px] text-yellow-300"
      >
        <title>Start verspätet (Rohstoffe)</title>
      </Clock3>
    );
  }
  return (
    <span
      className={cn(
        "ml-1 inline-block size-1.5 shrink-0 rounded-full align-middle",
        kind === "needed" ? "ring-1 ring-foreground/80 ring-inset" : "bg-destructive",
      )}
      title={kind === "needed" ? "Für den Plan benötigt" : "Abhängigkeiten fehlen"}
    />
  );
}
