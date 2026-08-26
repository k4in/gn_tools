# GN Tools — Galaxy-Network Build-Order-Planner

Direkt nutzen: [gn-tool.vercel.app](https://gn-tool.vercel.app)

Das ist ein **reines Planungstool**. Es verbindet sich nicht mit deinem Galaxy-Network-Account, klickt nichts im Spiel und automatisiert **keine** Spielabläufe. Du planst hier, **wann** du im Spiel bauen, forschen oder produzieren willst — umsetzen musst du das weiter selbst.

Spiel: [galaxy-network.de/portal](https://galaxy-network.de/portal)  
Quellcode: [github.com/k4in/gn_tools](https://github.com/k4in/gn_tools)

---

## Wofür ist das gut?

Du willst wissen: *Wenn ich so baue — wann habe ich Extraktoren? Wann das Kaperschiff? Was muss ich als Nächstes klicken?*

Der Planer nimmt deine Reihenfolge und Wunschzeiten und rechnet Tick für Tick durch:

- wann ein Auftrag wirklich starten kann
- wann er fertig ist
- wie Metall und Kristall dabei mitlaufen
- was als Nächstes ansteht und wie lange das noch dauert

Oben siehst du Uhrzeit, aktuellen Tick, die nächste Aktion und grobe Meilensteine (Extraktor, Kaperschiff, Schildschiff).

---

## So arbeitest du damit

1. Öffne [gn-tool.vercel.app](https://gn-tool.vercel.app).
2. Unter **Einstellungen** (Zahnrad) stellst du Startdatum und -uhrzeit auf deinen Rundenstart. Tick-Länge ist normalerweise 15 Minuten, wie im Spiel.
3. Links fügst du Gebäude, Forschungen, Schiffe, Aufklärung oder Asteroiden/Extraktoren hinzu.
4. In der Timeline siehst du den Ablauf. Klick auf einen Balken zum Ändern oder Entfernen.
5. **JSON exportieren** (neben Timeline / Tick-Protokoll) kopiert deinen Plan, z. B. zum Teilen.

Dein Plan bleibt in diesem Browser gespeichert. Anderes Gerät oder gelöschte Website-Daten: wieder der mitgelieferte Beispielplan.

Zum Zurücksetzen: Einstellungen → einen Default-Plan wählen → Zurücksetzen. Dein Startzeitpunkt bleibt.

---

## Wie die Planung rechnet

Galaxy Network läuft in **Ticks** (meist 15 Minuten: 20:00, 20:15, 20:30, …). Tick **0** ist der Start, den du in den Einstellungen setzt. Liegt der Start noch in der Zukunft, ist der Tick negativ.

### Wunsch-Tick

Beim Hinzufügen gibst du einen **Start-Tick** an. Das ist die früheste Zeit, nicht „genau dann, egal was“:

- Es startet **nie früher**.
- Voraussetzungen müssen **fertig** sein, nicht nur angefangen.
- Metall und Kristall müssen in diesem Tick reichen.

Fehlt noch Forschung oder Geld, rutscht der Start nach hinten. Der Dialog schlägt dir den frühesten sinnvollen Tick vor. Einen späteren Tick setzt du, wenn du bewusst warten willst.

Mehrere Dinge können gleichzeitig laufen — es gibt keine Bau-Schlange.

### Wer bekommt zuerst die Rohstoffe?

Wollen zwei Aufträge im **selben Tick** starten und das Geld reicht nur für einen, gewinnt der mit dem **früheren Wunsch-Tick**. Gleicher Wunsch-Tick: wer zuerst im Plan steht.

---

## Die Seite im Überblick

**Oben:** Info, Einstellungen, Uhr, Tick, nächste Aktion, Meilensteine.

**Darunter:** **Mein Plan** ist dein bearbeitbarer Plan. Daneben kannst du fertige Beispielpläne nur anschauen — dein Plan wird dadurch nicht überschrieben.

**Links (nur in Mein Plan):**

- **Tech** — Gebäude und Forschungen, die als Nächstes frei sind
- **Extraktoren** — Asteroiden scannen und Extraktoren bauen
- **Einheiten** — Schiffe, deren Voraussetzungen im Plan stehen
- **Aufklärung** — z. B. Scanverstärker

**Mitte:** Timeline (Balken), darunter die Liste aller Start-Ticks. **Tick-Protokoll** zeigt jeden Tick mit Ressourcen und Quest-Belohnungen.

---

## Was steckt in der Rechnung?

Ungefähr das, was für eine frische Kolonie zählt:

- Startvorrat 10 500 Metall und 10 500 Kristall
- Minen-Einkommen nach Fertigstellung
- Asteroiden nach dem Observatorium (10 000 Kristall, 20 Extraktor-Plätze)
- Extraktoren nach der Extraktor-Forschung (steigende Metallkosten, 50 Rohstoffe pro Tick)
- die frühen Quest-Belohnungen bis zu den Extraktoren

Nicht enthalten: Kampf, Flotten, späteres Quest-Zeug und alles, was du im Live-Spiel anders machst als geplant. Wird ein Plan unmöglich oder endlos, sagt das Tool das klar.

---

## Lokal starten (optional)

Nur nötig, wenn du selbst am Code arbeiten willst. Fürs Planen reicht [gn-tool.vercel.app](https://gn-tool.vercel.app).

```bash
pnpm install
pnpm dev
```

---

© k4in 2026
