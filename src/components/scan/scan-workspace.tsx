import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { CircleAlert, Trash2 } from "lucide-react";
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
  isUnknownTarget,
  needsTimeMarker,
  parseScans,
  primaryTargetKey,
  resolveRelativeDates,
  targetKey,
  type Scan,
  type TargetScans,
} from "@/lib/scan-parser";
import { cn } from "@/lib/utils/cn";

/** State aus dem localStorage, der bei jeder Änderung zurückgeschrieben wird. */
export function useStoredState<T>(key: string, load: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return load(raw ? JSON.parse(raw) : null);
    } catch {
      return load(null);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error("Konnte Scans nicht speichern", err);
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/** Code-Schnipsel in den Hilfetexten. */
export function HelpCode({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code className={cn("rounded-sm bg-muted px-1 py-0.5 text-[11px] whitespace-nowrap text-foreground", className)}>
      {children}
    </code>
  );
}

/** Hilfetext zur Zeitmarke, gilt für beide Auswertungen. */
export function TimeMarkerHelp() {
  return (
    <p>
      Beim Einfügen wird automatisch eine Zeitmarke mit der aktuellen Uhrzeit davorgesetzt, z. B.{" "}
      <HelpCode className="text-amber-500">@ 23.09. 14:30</HelpCode>. Sie gilt für alle Scans darunter bis zur nächsten
      Zeitmarke. Stammt ein Scan von früher, etwa aus der Datenbank, pass die Uhrzeit einfach im Text an.{" "}
      <HelpCode className="text-amber-500">@ 14:30</HelpCode> reicht für denselben Tag wie die Zeitmarke davor.
    </p>
  );
}

type ScanWorkspaceProps = {
  /** Name der Auswertung, z. B. „Punkteanalyse“. */
  title: string;
  text: string;
  onTextChange: (text: string) => void;
  /** Scan-Arten, die diese Auswertung verarbeitet. Alle anderen lösen einen Fehlerhinweis aus. */
  accepts: ReadonlySet<Scan["kind"]>;
  /** Fehlerhinweis, wenn Scans einer anderen Art im Feld stehen. */
  wrongScan: ReactNode;
  placeholder: string;
  help: ReactNode;
  /** Beim Einfügen eine Zeitmarke davorsetzen (Standard: ja). */
  timeMarker?: boolean;
  /** Zusätzliche Schalter in der Kopfzeile, links von „Scans löschen“. */
  toolbar?: ReactNode;
  children: (primary: TargetScans) => ReactNode;
};

/** Textfeld links, Auswertung des ausgewerteten Spielers rechts. */
export function ScanWorkspace({
  title,
  text,
  onTextChange,
  accepts,
  wrongScan,
  placeholder,
  help,
  timeMarker = true,
  toolbar,
  children,
}: ScanWorkspaceProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parsed = useMemo(() => parseScans(text), [text]);
  const relevant = useMemo(() => parsed.scans.filter((s) => accepts.has(s.kind)), [parsed.scans, accepts]);
  const wrongCount = parsed.scans.length - relevant.length;
  const targets = useMemo(() => groupScansByTarget(relevant), [relevant]);
  const primaryKey = primaryTargetKey(relevant);
  const primary = targets.find((t) => targetKey(t.target) === primaryKey) ?? null;
  const foreign = targets.filter((t) => t !== primary);

  /** Eingefügte Scans bekommen eine Zeitmarke mit der aktuellen Uhrzeit. */
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    // „heute um …“ wird zum festen Datum, damit gespeicherte Scans auch morgen noch stimmen.
    const pasted = resolveRelativeDates(event.clipboardData.getData("text"));
    if (!containsScan(pasted)) return;
    event.preventDefault();
    const el = event.currentTarget;
    const before = text.slice(0, el.selectionStart);
    const after = text.slice(el.selectionEnd);
    const separator = before.trim() === "" ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    // Scans mit eigenem Zeitpunkt („Daten wurden per Scan erfasst …“) brauchen keine Zeitmarke.
    const marker = timeMarker && needsTimeMarker(pasted) ? `${formatTimeMarker(new Date())}\n` : "";
    const insert = `${separator}${marker}${pasted.trim()}\n`;
    const next = before + insert + after;
    const cursor = before.length + insert.length;
    onTextChange(next);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col gap-4 border-r border-border p-6">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          spellCheck={false}
          aria-label={`Scans für die ${title}`}
          className="[field-sizing:fixed] min-h-0 flex-1 font-mono placeholder:text-muted-foreground/50 md:text-xs/relaxed"
        />
        <div className="flex flex-col gap-2 text-xs/relaxed text-muted-foreground">{help}</div>
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-6">
          {primary && isUnknownTarget(primary.target) ? (
            <h2 className="font-heading text-base font-semibold text-muted-foreground">Spieler unbekannt</h2>
          ) : primary ? (
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
            {toolbar}
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
          {wrongCount > 0 ? (
            <div className="mb-6 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              <div className="flex flex-col gap-1">{wrongScan}</div>
            </div>
          ) : null}

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

          {primary ? (
            children(primary)
          ) : wrongCount === 0 ? (
            <p className="text-xs text-muted-foreground">{text.trim() ? "Keine Scans erkannt." : "Noch keine Scans eingefügt."}</p>
          ) : null}

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
            <AlertDialogDescription>
              Leert das Textfeld der {title}. Die andere Auswertung und deine Baupläne bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onTextChange("");
                setConfirmClear(false);
              }}
            >
              Scans löschen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
