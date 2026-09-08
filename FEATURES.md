# GN Tools — Feature-Ideen

Arbeitsdokument für die **neue App** (Frontend + Backend), nicht für die bestehende Classic-Frontend-App.

Keine Umsetzung hier, nur Sammlung und Struktur. Offene Punkte sind mit **?** markiert.

Geplant wird trotzdem in diesem Repo. Einen Fork gibt es noch nicht.

Stand: Dokument gilt für die neue App; Classic bleibt Freeze.

---

## Ausgangslage

**Classic** (live, diese Codebasis): ein Feature, der Bauplaner. Rein clientseitig (Browser-Speicher + JSON-Export).

**Neue App** (dieses Dokument): Classic ist nur Referenz und Import-Quelle, nicht der Ort für die Features hier.

Zielbild der neuen App:

- **mehrere eigenständige Tools**, nicht ein Bauplaner mit immer mehr Modi
- gemeinsamer **App-Rahmen** (Routing, Menü)
- **Geräte-Sync** über Backend, ohne klassisches Nutzerkonto

---

## Classic einfrieren, neue App daneben

Classic wird **nicht** in-place zu Multi-Tool + Backend umgebaut. Alles ab hier (Tools, Router, Header, Sync, …) gilt **nur für die neue App**.

**Classic (aktuelle URL, dieses Repo bis zum Fork):**

- bleibt bestehen, so wie sie ist
- nach dem Fork **kein** aktives Entwickeln, kein Router, kein Sync
- Schutz für laufende Runden
- JSON-Export bleibt die Brücke nach rüber

**Neue App (neue URL, einzig aktive Baustelle — Fork steht noch aus):**

- Frontend (Tools, TanStack Router, App-Menü) **plus** Backend/Datenbank
- einmal vom aktuellen Stand abzweigen, danach nur noch dort weiter
- kein zweites lebendes Produkt: Classic ist Freeze, nicht Parallel-Pflege
- Startplan rüberziehen; Pläne aus Classic per **JSON-Import** laden

Neue URL heißt leeres `localStorage` — Import ist deshalb nötig, nicht optional für den Umstieg.

Cutover: sobald die neue App Startplan + Import zuverlässig kann, Classic liegen lassen (URL darf bleiben).

**Offen:** Backend-Hosting; ob/wann Classic einen Hinweis auf die neue URL bekommt; wann/wo der Fork entsteht.

---

## Tool-Übersicht

| # | Arbeitstitel | Status Idee | Kurz |
|---|--------------|-------------|------|
| 1 | Startplan | aus Classic übernehmen, umbenennen | Bauplaner-Verhalten von Tick 0 |
| 2 | Tagesplaner **?** | neu | Planer mit beliebigem Zwischenstand |
| 3 | Ressourcenrechner | neu | Rohstoffe eines Spielers aus Scan/Stand ableiten |
| 4 | Kampfsimulator | später | bewusst hinten anstellen |

Namen von 1 und 2 sind Arbeitstitel, noch nicht final.

---

## App-Rahmen

Mehrere Tools brauchen Navigation und eine klare Trennung zwischen **App-Chrome** und **Tool-UI**.

### Routing

- **TanStack Router** einführen.
- Jedes Tool eine eigene Route (z. B. Startplan, Tagesplaner, Rechner, später Simulator).
- Desktop-First, **keine Mobile-Version** nötig.

### Header / Menü

Der heutige Header ist **Teil des Bauplaners** (Uhr, Tick, nächste Aktion, Meilensteine, Einstellungen).

Das soll so bleiben: Bauplaner-Header bleibt Feature des Startplans.

**Neu darüber:** ein **App-Menü** (übergeordneter Header) zum Wechseln der Tools, evtl. Sync/ID.

Grobe Schichtung:

```
┌─────────────────────────────────────┐
│ App-Menü   Startplan | Tagesplan | … │  ← neu, app-weit
├─────────────────────────────────────┤
│ Tool-Header (nur wo sinnvoll)        │  ← z. B. Startplan wie heute
├─────────────────────────────────────┤
│ Tool-Inhalt                          │
└─────────────────────────────────────┘
```

**Offen:**

- welche Einträge ins App-Menü (nur Tools, oder auch ID/Sync/Export)
- Default-Route (vermutlich Startplan)
- ob Tool-Header und App-Menü visuell eine Leiste oder zwei sind

---

## 1. Startplan (bisher: Bauplaner)

**Idee:** Das bestehende Tool grundsätzlich **so lassen**, wie es ist.

**Änderung nur konzeptionell:**

- umbenennen, z. B. **Startplan**
- klar als „Planung ab Rundenstart / frische Kolonie“ positionieren
- in den App-Rahmen einhängen (Route + App-Menü), intern aber nicht umbauen nur weil andere Tools dazukommen

**Bewusst nicht:** Zwischenstand, Startressourcen, vorhandene Extraktoren ins bestehende Tool mischen.

Grund: Wenn mitten im Plan ein Fehler steckt, läuft alles danach schief. Das soll nicht durch „mittendrin starten“ im selben Tool gelöst werden, sondern durch ein **zweites Tool**.

---

## 2. Tagesplaner **?** (neuer Planer)

**Eigenständiges zweites Tool**, kein Modus/Feature des Startplans.

Ähnlich bedienen wie der Bauplaner (Reihenfolge, Ticks, Timeline), aber **nicht** fest an Tick 0 / Default-Startvorrat gebunden.

**Startzustand angeben können, z. B.:**

- aktuelle Rohstoffe (Metall, Kristall, …)
- vorhandene Extraktoren / Asteroiden
- (vermutlich auch: vorhandene Gebäude, Forschungen, Einheiten — **?** noch nicht genannt)

**Nutzen:** Mitten in der Runde weiterplanen, ohne den ganzen Startplan nachzuvollziehen. Fehler früh im Startplan sollen den Tagesplan nicht zerstören.

**Offen:**

- finaler Name (Tagesplaner, Zwischenplan, Rundenplan, …)
- welche Felder der Startzustand genau hat
- ob Tech-Stand Pflicht ist oder nur Ressourcen + Extraktoren
- wie stark UI/Rechnung vom Startplan geteilt vs. getrennt sein sollen (Produkt: getrennt; Code: **?**)

---

## 3. Ressourcenrechner

**Idee:** Zu einem Spielerstand berechnen, **wie viele Rohstoffe gerade rumliegen**.

Typischer Nutzen: **Angriffe planen** (was liegt zum Einschlagzeitpunkt da?).

**Eingabe:** Scan einfügen ist der **Hauptweg**. Parser liest den Scan, Rechnung läuft, Ergebnis steht — ohne Einheiten, Extraktoren usw. per Hand einzutippen.

Manuelle Angabe bleibt möglich (korrigieren, ergänzen, ohne Scan). Nachrangig.

Regeln / Formeln kommen **später**. Erstmal: das Tool ist geplant.

**Offen:**

- welche Werte der Rechner braucht (Produktion, Lager, Steuern, letzter Tick, …)
- Zeitbezug: „jetzt“ vs. „in X Ticks"

---

## 4. Kampfsimulator (später)

Viertes Feature. **Zurückstellen**, soll aber kommen.

**Eingabe wie beim Rechner:** Scan(s) einfügen ist der Hauptweg — vorhandene Einheiten kommen aus dem Scan, dann Kampf. Manuell Einheiten setzen geht, ist aber nicht der Normalfall.

---

## Sync / Backend

### Problem

Heute: alles Frontend, Plan liegt im Browser. JSON-Export gibt es, ist aber **zum Teilen zwischen Leuten** gedacht, nicht zum Abgleich **mehrerer Geräte desselben Nutzers**.

### Richtung

- Backend + Datenbank, Arbeitshypothese: **SQLite**
- kein klassisches Konto (kein E-Mail/Passwort)

### Identifikation

Am Anfang wird eine **ID generiert**, die der Nutzer selbst speichern muss.

Diese ID ist **Benutzername und Passwort in einem**. Unter der ID liegen die Planstände in der DB.

**Offen:**

- was genau synchronisiert wird (nur Startplan, alle Tools, Einstellungen, mehrere Pläne)
- ID-Format / Länge / Darstellung (kopieren, QR, …)
- wo die ID im UI lebt (App-Menü)
- Verhalten ohne ID: weiter lokal, oder Sync Pflicht **?**
- was passiert bei ID-Verlust (vermutlich: weg)
- Export bleibt zusätzlich fürs Teilen zwischen Nutzern und als Brücke Classic → neu

---

## Querschnitt

### Scan-Parser (kein Tool)

Kein eigenes Feature, keine eigene Route. **Voraussetzung** für Ressourcenrechner und Kampfsimulator.

Spieler-Scans sehen immer gleich aus. Daraus u. a.:

- Einheiten
- Extraktoren
- (weitere Felder **?**)

Technisch voraussichtlich **Regex** (oder ähnlich deterministisch), als **wiederverwendbare Helper-Funktionen** — nicht als UI-Einmal-Logik.

Ablauf in den Tools: Scan einfügen → Helper extrahiert den Stand → direkt Ergebnis (Rohstoffe bzw. Kampf). Manuelle Eingabe ist Fallback, nicht der Kern.

**Offen:** Scan-Beispiele / genaues Format; ob der Tagesplaner denselben Parser später auch nutzt.

### Weiteres

- **App-Struktur:** mehrere Tools hinter Router + App-Menü.
- **Startplan-UI** bleibt fachlich isoliert; nur einhängen, nicht zum Universal-Planer machen.
- **Geteilte Bausteine:** Scan-Parser (Helper), Spielregeln/Daten (`gn-data`), evtl. Tick-/Ressourcenrechnung.
- **Persistenz:** lokal wie bisher plus optional/zentral Sync über ID.
- **Kein Mobile-Layout.**
- **Zwei Deployments:** Classic freeze (alte URL) und neue App (neue URL); entwickelt wird nur die neue.

---

## Nächste Diskussionspunkte

1. Namen für Tool 1 und 2 festziehen.
2. Startzustand Tagesplaner: nur Ressourcen + Extraktoren, oder voller Spielstand?
3. Scan-Beispiele und Felder für den Parser.
4. Regeln für den Ressourcenrechner.
5. App-Menü: Einträge, Default-Route.
6. Sync: Pflicht vs. optional, welche Daten, ID-Verlust.
7. Backend-Form (SQLite wo gehostet — **?**).
8. JSON-Import: Classic-Export in der neuen App lesen (Cutover).
9. Kampfsimulator: grober Umfang, sobald an der Reihe.

---

## Was bewusst nicht in diesem Dokument steht

- konkrete UI-Wireframes
- Implementierungsplan, Dateien, APIs
- Änderungen an Classic (dieses Repo bleibt bis zum Fork nur Planungsort)
