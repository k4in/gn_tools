import { useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { HelpCode, ScanWorkspace, TimeMarkerHelp, useStoredState } from "@/components/scan/scan-workspace";
import { TargetAnalysis } from "@/components/scan/target-analysis";
import type { Scan } from "@/lib/scan-parser";
import { cn } from "@/lib/utils/cn";

/** Eigener Key, getrennt vom Bauplan (gn_tool.plan) und der Newsscan-Analyse. */
const STORAGE_KEY = "gn_tool.scans.sektor";

type Stored = { text: string; earlyGame: boolean };

function load(raw: unknown): Stored {
  const o = raw && typeof raw === "object" ? (raw as Partial<Stored>) : {};
  return {
    text: typeof o.text === "string" ? o.text : "",
    earlyGame: o.earlyGame === true,
  };
}

const ACCEPTS: ReadonlySet<Scan["kind"]> = new Set(["sector", "units", "defense", "points"]);

export function PointsAnalysisPage() {
  const [stored, setStored] = useStoredState(STORAGE_KEY, load);
  const { text, earlyGame } = stored;
  const setText = useCallback((text: string) => setStored((s) => ({ ...s, text })), [setStored]);

  return (
    <ScanWorkspace
      title="Punkteanalyse"
      text={text}
      onTextChange={setText}
      accepts={ACCEPTS}
      placeholder="Sektorscans oder Punktzeilen hier einfügen …"
      wrongScan={
        <>
          <p className="font-medium">Falscher Scan eingefügt. Bitte einen gültigen Sektorscan einfügen.</p>
          <p>
            Newsscans werden in der Punkteanalyse ignoriert. Sie gehören in die{" "}
            <Link to="/scan/news" className="underline underline-offset-2 hover:text-foreground">
              Newsscan-Analyse
            </Link>
            .
          </p>
        </>
      }
      toolbar={
        <button
          type="button"
          aria-pressed={earlyGame}
          onClick={() => setStored((s) => ({ ...s, earlyGame: !s.earlyGame }))}
          title="Schätzt Rubium/Horus ohne Geschützscan"
          className={cn(
            "inline-flex h-7 items-center gap-2 rounded-md border px-2 text-xs font-medium transition-colors",
            earlyGame
              ? "border-green-500/50 bg-green-500/15 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <span className={cn("relative h-3 w-5 rounded-full transition-colors", earlyGame ? "bg-green-500" : "bg-muted")}>
            <span
              className={cn("absolute top-0.5 size-2 rounded-full bg-foreground transition-all", earlyGame ? "left-2.5" : "left-0.5")}
            />
          </span>
          Early-Game
        </button>
      }
      help={
        <>
          <p>
            Einfügen lassen sich <span className="text-foreground">Sektor-, Einheiten- und Geschützscans</span>, kopiert aus der
            Scan-Datenbank oder direkt aus WhatsApp, sowie <span className="text-foreground">Punktzeilen</span> aus der
            Galaxieansicht, z. B. <HelpCode>14:5 ☠️ Barrett 37.242.208 28</HelpCode>. Mehrere auf einmal gehen auch.
            Militärscans werden ignoriert. Ausgewertet werden Rohstoffe und Punkteverlauf.
          </p>
          <p>
            Die Scans gehen auch im Format <HelpCode>Daten wurden per Scan erfasst …</HelpCode>, auch als ganzer Block ab{" "}
            <HelpCode>Scans von …</HelpCode>. Sie enthalten ihren Zeitpunkt selbst; „heute“ wird beim Einfügen zum festen
            Datum. Fehlt die „Scans von“-Zeile, werden sie dem ausgewerteten Spieler zugeordnet.
          </p>
          <TimeMarkerHelp />
        </>
      }
    >
      {(primary) => <TargetAnalysis entry={primary} earlyGame={earlyGame} />}
    </ScanWorkspace>
  );
}
