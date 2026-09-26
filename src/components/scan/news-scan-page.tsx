import { useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { NewsAnalysisView, type NewsViewState } from "@/components/scan/news-analysis-view";
import { ScanWorkspace, useStoredState } from "@/components/scan/scan-workspace";
import type { Scan } from "@/lib/scan-parser";

/** Eigener Key, getrennt vom Bauplan (gn_tool.plan) und der Punkteanalyse. */
const STORAGE_KEY = "gn_tool.scans.news";

type Stored = { text: string; news: NewsViewState };

function loadNewsState(raw: unknown): NewsViewState {
  const o = raw && typeof raw === "object" ? (raw as Partial<NewsViewState>) : {};
  return {
    fleetTicks: o.fleetTicks && typeof o.fleetTicks === "object" ? o.fleetTicks : {},
    retreatChoices: o.retreatChoices && typeof o.retreatChoices === "object" ? o.retreatChoices : {},
  };
}

function load(raw: unknown): Stored {
  const o = raw && typeof raw === "object" ? (raw as Partial<Stored>) : {};
  return {
    text: typeof o.text === "string" ? o.text : "",
    news: loadNewsState(o.news),
  };
}

const ACCEPTS: ReadonlySet<Scan["kind"]> = new Set(["news"]);

export function NewsScanPage() {
  const [stored, setStored] = useStoredState(STORAGE_KEY, load);
  const setText = useCallback((text: string) => setStored((s) => ({ ...s, text })), [setStored]);
  const setNews = useCallback((news: NewsViewState) => setStored((s) => ({ ...s, news })), [setStored]);

  return (
    <ScanWorkspace
      title="Newsscan-Analyse"
      text={stored.text}
      onTextChange={setText}
      accepts={ACCEPTS}
      placeholder="Newsscan hier einfügen …"
      timeMarker={false}
      wrongScan={
        <>
          <p className="font-medium">Falscher Scan eingefügt. Bitte einen gültigen Newsscan einfügen.</p>
          <p>
            Sektor-, Einheiten- und Geschützscans sowie Punktzeilen werden hier ignoriert. Sie gehören in die{" "}
            <Link to="/scan/sektor" className="underline underline-offset-2 hover:text-foreground">
              Punkteanalyse
            </Link>
            .
          </p>
        </>
      }
      help={
        <>
          <p>
            Einfügen lässt sich ein <span className="text-foreground">Newsscan</span>, kopiert aus der Scan-Datenbank oder
            direkt aus WhatsApp. Die Auswertung zeigt, wann welche Flotte kämpft.
          </p>
          <p>
            Ausgewertet wird immer ab <span className="text-foreground">jetzt</span>: Es zählen die Einträge der letzten
            10 Stunden, eine Zeitmarke braucht es nicht. Zurückgezogene Flotten werden ausgeblendet.
          </p>
        </>
      }
    >
      {(primary) => (primary.news ? <NewsAnalysisView news={primary.news} state={stored.news} onChange={setNews} /> : null)}
    </ScanWorkspace>
  );
}
