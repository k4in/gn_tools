import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { CircleAlert, Trash2 } from "lucide-react";
import { NewsAnalysisView, type NewsViewState } from "@/components/scan/news-analysis-view";
import { TargetAnalysis } from "@/components/scan/target-analysis";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import {
  containsScan,
  formatTimeMarker,
  groupScansByTarget,
  parseScans,
  primaryTargetKey,
  scanMode,
  scansForMode,
  targetKey,
} from "@/lib/scan-parser";
import { cn } from "@/lib/utils/cn";

/** Eigener Key, getrennt vom Bauplan (gn_tool.plan). */
const STORAGE_KEY = "gn_tool.scans";

type StoredScans = { text: string; earlyGame: boolean; news: NewsViewState };

const DEFAULT_NEWS_STATE: NewsViewState = {
  fleetTicks: {},
  retreatChoices: {},
};

function loadNewsState(raw: unknown): NewsViewState {
  if (!raw || typeof raw !== "object") return DEFAULT_NEWS_STATE;
  const o = raw as Partial<NewsViewState>;
  return {
    fleetTicks: o.fleetTicks && typeof o.fleetTicks === "object" ? o.fleetTicks : {},
    retreatChoices:
      o.retreatChoices && typeof o.retreatChoices === "object" ? o.retreatChoices : {},
  };
}

function loadStored(): StoredScans {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { text: "", earlyGame: false, news: DEFAULT_NEWS_STATE };
    const parsed = JSON.parse(raw) as Partial<StoredScans>;
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      earlyGame: parsed.earlyGame === true,
      news: loadNewsState(parsed.news),
    };
  } catch {
    return { text: "", earlyGame: false, news: DEFAULT_NEWS_STATE };
  }
}

const PLACEHOLDER = "Scans oder Punktzeilen hier einfügen …";

export function ScanPage() {
  const [stored] = useState(loadStored);
  const [text, setText] = useState(stored.text);
  const [earlyGame, setEarlyGame] = useState(stored.earlyGame);
  const [newsState, setNewsState] = useState(stored.news);
  const [confirmClear, setConfirmClear] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ text, earlyGame, news: newsState } satisfies StoredScans));
    } catch (err) {
      console.error("Konnte Scans nicht speichern", err);
    }
  }, [text, earlyGame, newsState]);

  const parsed = useMemo(() => parseScans(text), [text]);
  const mode = scanMode(parsed.scans);
  // Early-Game gibt es nur, wenn der erste Scan ein Sektorscan ist.
  const earlyGameAvailable = parsed.scans[0]?.kind === "sector";
  const relevant = useMemo(() => scansForMode(parsed.scans, mode), [parsed.scans, mode]);
  const ignoredByMode = parsed.scans.length - relevant.length;
  const targets = useMemo(() => groupScansByTarget(relevant), [relevant]);
  const primaryKey = primaryTargetKey(relevant);
  const primary = targets.find((t) => targetKey(t.target) === primaryKey) ?? null;
  const foreign = targets.filter((t) => t !== primary);

  /** Eingefügte Scans bekommen eine Zeitmarke mit der aktuellen Uhrzeit. */
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!containsScan(pasted)) return;
    event.preventDefault();
    const el = event.currentTarget;
    const before = text.slice(0, el.selectionStart);
    const after = text.slice(el.selectionEnd);
    const separator = before.trim() === "" ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const insert = `${separator}${formatTimeMarker(new Date())}\n${pasted.trim()}\n`;
    const next = before + insert + after;
    const cursor = before.length + insert.length;
    setText(next);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <main className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
      <section className="flex min-h-0 flex-col gap-4 border-r border-border p-6">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={handlePaste}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          aria-label="Scans"
          className="[field-sizing:fixed] min-h-0 flex-1 font-mono placeholder:text-muted-foreground/50 md:text-xs/relaxed"
        />
        <div className="flex flex-col gap-2 text-xs/relaxed text-muted-foreground">
          <p>
            Einfügen lassen sich <span className="text-foreground">Sektor-, Einheiten-, Geschütz- und Newsscans</span>,
            kopiert aus der Scan-Datenbank oder direkt aus WhatsApp, sowie{" "}
            <span className="text-foreground">Punktzeilen</span> aus der Galaxieansicht, z. B.{" "}
            <code className="rounded-sm bg-muted px-1 py-0.5 text-[11px] whitespace-nowrap text-foreground">
              14:5 ☠️ Barrett 37.242.208 28
            </code>
            . Mehrere auf einmal gehen auch. Militärscans werden ignoriert.
          </p>
          <p>
            Der erste Scan im Feld bestimmt die Auswertung: Steht ein <span className="text-foreground">Newsscan</span> vorne, zeigt die
            rechte Seite, wann welche Flotte kämpft. Steht ein <span className="text-foreground">Sektorscan</span> vorne,
            werden Rohstoffe und Punkteverlauf ausgewertet.
          </p>
          <p>
            Beim Einfügen wird automatisch eine Zeitmarke mit der aktuellen Uhrzeit davorgesetzt, z. B.{" "}
            <code className="rounded-sm bg-muted px-1 py-0.5 text-[11px] whitespace-nowrap text-amber-500">@ 23.09. 14:30</code>. Sie gilt
            für alle Scans darunter bis zur nächsten Zeitmarke. Stammt ein Scan von früher, etwa aus der Datenbank, pass die Uhrzeit einfach
            im Text an. <code className="rounded-sm bg-muted px-1 py-0.5 text-[11px] whitespace-nowrap text-amber-500">@ 14:30</code> reicht
            für denselben Tag wie die Zeitmarke davor.
          </p>
        </div>
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-6">
          {primary ? (
            <h2 className="flex items-baseline gap-2">
              <span className="font-heading text-base font-semibold tracking-tight">{primary.target.player}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {primary.target.galaxy}:{primary.target.planet}
              </span>
            </h2>
          ) : (
            <h2 className="font-heading text-base font-semibold text-muted-foreground">–</h2>
          )}
          <div className="ml-auto flex items-center gap-1">
            {earlyGameAvailable ? (
              <button
                type="button"
                aria-pressed={earlyGame}
                onClick={() => setEarlyGame((v) => !v)}
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
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={!text}
              onClick={() => setConfirmClear(true)}
              className="hover:bg-destructive/15 hover:text-destructive"
            >
              <Trash2 data-icon="inline-start" />
              Scans löschen
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {foreign.length > 0 && primary ? (
            <div className="mb-6 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">
                  Es kann immer nur ein Spieler ausgewertet werden: {primary.target.player} {primary.target.galaxy}:{primary.target.planet}.
                </p>
                {foreign.map((t) => (
                  <p key={targetKey(t.target)}>
                    Scans von {t.target.player} {t.target.galaxy}:{t.target.planet} werden ignoriert. Bitte aus dem Textfeld entfernen.
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {ignoredByMode > 0 ? (
            <p className="mb-6 text-xs text-muted-foreground">
              {mode === "news"
                ? `${ignoredByMode} weitere Scans werden in der News-Auswertung ignoriert.`
                : `${ignoredByMode} Newsscan${ignoredByMode === 1 ? " wird" : "s werden"} in der Rohstoff-Auswertung ignoriert. Für die News-Auswertung den Newsscan an den Anfang stellen.`}
            </p>
          ) : null}

          {primary && mode === "news" && primary.news ? (
            <NewsAnalysisView news={primary.news} state={newsState} onChange={setNewsState} />
          ) : primary ? (
            <TargetAnalysis entry={primary} earlyGame={earlyGame && earlyGameAvailable} />
          ) : (
            <p className="text-xs text-muted-foreground">{text.trim() ? "Keine Scans erkannt." : "Noch keine Scans eingefügt."}</p>
          )}

          {parsed.skipped.length > 0 || parsed.warnings.length > 0 ? (
            <div className="mt-6 flex flex-col gap-1 text-[11px] text-muted-foreground">
              {parsed.skipped.map((s, i) => (
                <p key={`skip-${i}`}>
                  {s.type}scan von {s.target.player} {s.target.galaxy}:{s.target.planet} übersprungen (wird noch nicht ausgewertet).
                </p>
              ))}
              {parsed.warnings.map((w, i) => (
                <p key={`warn-${i}`} className="text-yellow-300/80">
                  {w}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alle Scans löschen?</AlertDialogTitle>
            <AlertDialogDescription>Leert das Textfeld mit allen Scans. Deine Baupläne bleiben unverändert.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setText("");
                setConfirmClear(false);
              }}
            >
              Scans löschen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
