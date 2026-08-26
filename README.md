# GN Tools — Galaxy-Network Build-Order-Planner

Ein Browser-Planer für [Galaxy Network](https://galaxy-network.de/portal). Du legst fest, **wann** Gebäude, Forschungen, Schiffe, Aufklärung und Economy-Aufträge starten sollen. Das Tool simuliert den Ablauf Tick für Tick: Ressourcen, Voraussetzungen, parallele Jobs, Quest-Belohnungen und die daraus entstehende Timeline.

Quellcode: [https://github.com/k4in/gn_tools](https://github.com/k4in/gn_tools)

---

## Was der Planer kann

- Einen kompletten Build-Order-Plan anlegen, bearbeiten und zurücksetzen
- Startzeitpunkt und Tick-Länge einstellen (Default: 15 Minuten, wie im Spiel)
- Anzeigen, **welcher Tick gerade läuft** und was als Nächstes ansteht
- Meilensteine im Header (Extraktor, Kaperschiff, Schildschiff) mit Restzeit
- Timeline, Aktionsliste und Tick-Protokoll
- Vorlagen (**Templates**) nur ansehen, ohne den eigenen Plan zu überschreiben
- Den eigenen Plan als JSON exportieren
- Den Plan lokal im Browser speichern (`localStorage`)

Der Planer spielt das Spiel nicht für dich. Er rechnet, **wann** Aufträge starten können und **wann** sie fertig sind — unter den Regeln unten.

---

## Lokal starten

Voraussetzung: Node.js und [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev
```

Dann die angezeigte lokale URL im Browser öffnen. Build: `pnpm build`.

---

## Grundbegriffe

### Ticks

Galaxy Network läuft in Ticks. Im Spiel ist ein Tick üblicherweise **15 Minuten** (z. B. 20:00, 20:15, 20:30). Im Planer ist das einstellbar.

Tick **0** ist der von dir gesetzte Planstart (Datum + Uhrzeit in den Einstellungen). Der Header zeigt die aktuelle Uhrzeit und den daraus berechneten **aktuellen Tick**. Liegt der Start in der Zukunft, ist der Tick negativ.

### Wunsch-Tick

Jeder Plan-Eintrag hat einen **Wunsch-Start** (das Zahlenfeld *Start-Tick* im Dialog). Das ist keine Garantie, sondern die früheste erlaubte Startzeit:

- Der Auftrag startet **nie früher** als dieser Tick.
- Er startet erst, wenn **alle Voraussetzungen fertig** sind (nicht nur angefangen).
- Und erst, wenn **Metall und Kristall** in diesem Tick reichen.

Fehlt noch Forschung oder Geld, rutscht der Start Tick für Tick nach hinten.

### Parallelität

Beliebig viele Gebäude, Forschungen, Einheiten und Economy-Jobs können gleichzeitig laufen. Es gibt keine Bau-Schlange.

### Ressourcen-Konflikt

Wenn zwei Einträge im **selben Tick** beide startklar sind, bekommt der mit dem **früheren Wunsch-Tick** zuerst die Rohstoffe. Haben beide denselben Wunsch-Tick, gilt die Reihenfolge im Plan.

Beispiel: A soll Tick 5, B Tick 10. A kann erst Tick 10 zahlen. Beide wollen dann gleichzeitig starten — A hat Vorrang, weil der Wunsch-Tick früher ist.

---

## Die Oberfläche

### Header

Links: **Info** und **Einstellungen**.

Danach: aktuelle Uhrzeit, aktueller Tick, nächste Aktion mit Restzeit, und die Meilensteine Extraktor / Kaperschiff / Schildschiff (Tick + Uhrzeit + Restzeit). Ist der Plan nicht berechenbar, erscheint ein Hinweis.

### Plan-Leiste

Direkt unter dem Header:

- **Mein Plan** — dein gespeicherter, editierbarer Plan
- **Templates:** — fertige Vorlagen nur zum Anschauen

Klick wechselt nur die Ansicht. Speichern und Reset betreffen immer nur **Mein Plan**.

### Sidebar (nur in „Mein Plan“)

Vier Reiter:

| Reiter        | Inhalt                                      |
| ------------- | ------------------------------------------- |
| Tech          | Gebäude und Forschungen, die jetzt frei sind |
| Extraktoren   | Asteroiden scannen und/oder Extraktoren bauen |
| Einheiten     | Schiffe, deren Techs im Plan stehen         |
| Aufklärung    | z. B. Scanverstärker                        |

Ein Klick öffnet den Dialog *Zum Plan hinzufügen*. In Template-Ansichten fehlt die Sidebar; die Timeline ist dort nicht editierbar.

### Timeline

Balken pro Auftrag, Farbe nach Typ (Gebäude, Forschung, Einheit, Recon, Economy). In **Mein Plan** öffnet ein Klick auf einen Balken den Bearbeiten-Dialog.

Darunter die **Aktionsliste**: alle Ticks, in denen etwas startet.

### Tick-Protokoll

Jeder simulierte Tick mit Start/Fertig, Ressourcenstand und Quest-Belohnungen.

---

## Plan bearbeiten

### Hinzufügen

1. In der Sidebar den Eintrag wählen.
2. **Start-Tick** prüfen oder ändern. Der Dialog schlägt den frühesten sinnvollen Tick vor (Deps fertig + mindestens bezahlbar).
3. Bei Einheiten/Recon: **Anzahl**. Bei Economy: Asteroiden, Extraktoren, Ressource (Metall oder Kristall).
4. **Hinzufügen**.

Ein späterer Wunsch-Tick als der Vorschlag bedeutet: bewusst warten. Ein früherer Tick wird von der Simulation trotzdem nach hinten geschoben, sobald Deps oder Rohstoffe fehlen.

### Bearbeiten und Entfernen

In der Timeline auf den Balken klicken. Start-Tick (und Anzahl / Economy) ändern oder **Entfernen**. Abhängige Folge-Einträge können mit entfernt werden.

### JSON exportieren

In **Mein Plan** neben den Tabs: **JSON exportieren**. Zeigt das komplette Plan-JSON. **Kopieren** legt es in die Zwischenablage.

---

## Einstellungen

Zahnrad oben links.

### Planstart

- **Datum** und **Uhrzeit** von Tick 0
- **Tick-Länge** in Minuten (Default 15)

**Übernehmen** schreibt die Werte in den laufenden Plan. Header-Zeiten und „in X Stunden“ rechnen sich davon.

### Plan zurücksetzen

Combobox mit den Default-Plänen, dann **Zurücksetzen** (mit Bestätigung). Ersetzt nur die Plan-Einträge von **Mein Plan**. Datum, Uhrzeit und Tick-Länge bleiben.

---

## Templates

| Template         | Inhalt |
| ---------------- | ------ |
| **Balanced**     | Voller Beispielplan (Tech, Economy, Cleptor, …). Default beim ersten Besuch. |
| **Fast Cleptor** | Platzhalter bis Raumstation / Observatorium. |
| **Fast Raumhafen** | Gleicher früher Abschnitt bis Observatorium. |

Templates sind fest im Code. In der Template-Ansicht siehst du Timeline und Protokoll mit **deinem** Planstart (Datum/Uhrzeit/Tick-Länge), aber du kannst nichts am Template ändern.

---

## Was die Simulation mitrechnet

- Startvorrat: **10 500 Metall** und **10 500 Kristall** (wie eine frische Kolonie im relevanten Rahmen)
- Minen-Einkommen nach Fertigstellung (Koloniezentrum, Metall-/Kristallminen-Stufen)
- Asteroiden: nach **Observatorium**, 10 000 Kristall pro Scan, 20 Extraktor-Plätze pro Asteroid
- Extraktoren: nach **Extraktor**-Tech, steigende Metallkosten, 50 Rohstoffe/Tick, Metall oder Kristall
- Quest-Belohnungen, soweit sie bis zu den Extraktoren relevant sind (Rohstoffe, teils Extraktoren)
- Unbegrenzt parallele Jobs
- Simulations-Horizont: 5000 Ticks. Wird der Plan nicht fertig oder ist er unmöglich (keine Produktion, zu wenig Startkapital), gilt er als nicht berechenbar.

Nicht modelliert bzw. nur grob: Kampf, Flottenbewegung, späteres Quest-System, manuelle Abweichungen im Live-Spiel.

---

## Speichern

Der aktuelle Plan (Einträge + Startzeit + Tick-Länge + Startressourcen) liegt im Browser unter `localStorage` (`gn_tool.plan`).

- Erster Besuch ohne Speicher: Kopie von **Balanced**, Start **28.08.2026 20:00**, 15-Minuten-Ticks
- Weitere Besuche: zuletzt gespeicherter Stand
- Anderer Rechner / anderes Profil / gelöschte Website-Daten: wieder der Default

---

## Info

Im Header links neben den Einstellungen: GitHub, Galaxy Network, Copyright.

- GitHub: https://github.com/k4in/gn_tools
- Galaxy Network: https://galaxy-network.de/portal

© k4in 2026
