import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { CircleAlert, Trash2 } from "lucide-react";
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
  targetKey,
} from "@/lib/scan-parser";
import { cn } from "@/lib/utils/cn";

/** Eigener Key, getrennt vom Bauplan (gn_tool.plan). */
const STORAGE_KEY = "gn_tool.scans";

type StoredScans = { text: string; earlyGame: boolean };

function loadStored(): StoredScans {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { text: "", earlyGame: false };
    const parsed = JSON.parse(raw) as Partial<StoredScans>;
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      earlyGame: parsed.earlyGame === true,
    };
  } catch {
    return { text: "", earlyGame: false };
  }
}

const PLACEHOLDER = "Scans oder Punktzeilen hier einfügen …";

export function ScanPage() {
  const [stored] = useState(loadStored);
  const [text, setText] = useState(stored.text);
  const [earlyGame, setEarlyGame] = useState(stored.earlyGame);
  const [confirmClear, setConfirmClear] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ text, earlyGame } satisfies StoredScans));
    } catch (err) {
      console.error("Konnte Scans nicht speichern", err);
    }
  }, [text, earlyGame]);

  const parsed = useMemo(() => parseScans(text), [text]);
  const targets = useMemo(() => groupScansByTarget(parsed.scans), [parsed.scans]);
  const primaryKey = primaryTargetKey(parsed.scans);
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
          className="min-h-0 flex-1 font-mono [field-sizing:fixed] placeholder:text-muted-foreground/50 md:text-xs/relaxed"
        />
        <div className="flex flex-col gap-2 text-xs/relaxed text-muted-foreground">
          <p>
            Einfügen lassen sich <span className="text-foreground">Sektor-, Einheiten- und Geschützscans</span>{" "}
            sowie <span className="text-foreground">Punktzeilen</span> aus der Galaxieansicht, z. B.{" "}
            <code className="rounded-sm bg-muted px-1 py-0.5 whitespace-nowrap text-[11px] text-foreground">
              14:5 ☠️ Barrett 37.242.208 28
            </code>
            . Mehrere auf einmal gehen auch. News- und Militärscans werden ignoriert.
          </p>
          <p>
            Beim Einfügen wird automatisch eine Zeitmarke mit der aktuellen Uhrzeit davorgesetzt, z. B.{" "}
            <code className="rounded-sm bg-muted px-1 py-0.5 whitespace-nowrap text-[11px] text-amber-500">@ 23.09. 14:30</code>
            . Sie gilt für alle Scans darunter bis zur nächsten Zeitmarke. Stammt ein Scan von früher,
            etwa aus der Datenbank, pass die Uhrzeit einfach im Text an.{" "}
            <code className="rounded-sm bg-muted px-1 py-0.5 whitespace-nowrap text-[11px] text-amber-500">@ 14:30</code>{" "}
            reicht für denselben Tag wie die Zeitmarke davor.
          </p>
        </div>
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-6">
          {primary ? (
            <h2 className="flex items-baseline gap-2">
              <span className="font-heading text-base font-semibold tracking-tight">
                {primary.target.player}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {primary.target.galaxy}:{primary.target.planet}
              </span>
            </h2>
          ) : (
            <h2 className="font-heading text-base font-semibold text-muted-foreground">–</h2>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-pressed={earlyGame}
              onClick={() => setEarlyGame((v) => !v)}
              title="Schätzt Rubium/Horus ohne Geschützscan"
              className={cn(
                "inline-flex h-7 items-center gap-2 rounded-md border px-2 text-xs font-medium transition-colors",
                earlyGame
                  ? "border-green-500/50 bg-green-500/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "relative h-3 w-5 rounded-full transition-colors",
                  earlyGame ? "bg-green-500" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-2 rounded-full bg-foreground transition-all",
                    earlyGame ? "left-2.5" : "left-0.5",
                  )}
                />
              </span>
              Early-Game
            </button>
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
                  Es kann immer nur ein Spieler ausgewertet werden: {primary.target.player}{" "}
                  {primary.target.galaxy}:{primary.target.planet}.
                </p>
                {foreign.map((t) => (
                  <p key={targetKey(t.target)}>
                    Scans von {t.target.player} {t.target.galaxy}:{t.target.planet} werden ignoriert.
                    Bitte aus dem Textfeld entfernen.
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {primary ? (
            <TargetAnalysis entry={primary} earlyGame={earlyGame} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {text.trim() ? "Keine Scans erkannt." : "Noch keine Scans eingefügt."}
            </p>
          )}

          {parsed.skipped.length > 0 || parsed.warnings.length > 0 ? (
            <div className="mt-6 flex flex-col gap-1 text-[11px] text-muted-foreground">
              {parsed.skipped.map((s, i) => (
                <p key={`skip-${i}`}>
                  {s.type}scan von {s.target.player} {s.target.galaxy}:{s.target.planet} übersprungen
                  (wird noch nicht ausgewertet).
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
            <AlertDialogDescription>
              Leert das Textfeld mit allen Scans. Deine Baupläne bleiben unverändert.
            </AlertDialogDescription>
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
