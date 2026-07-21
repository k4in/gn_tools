# Ticks

Galaxy-Network basiert auf Ticks. Ein Tick ist immer 15 Minuten lang. Mit jedem Tick wird Baufortschritt berechnet, Ressourcen gutgeschrieben, etc.
Ticks sind immer zu vollen 15min (z.B. 14:00, 14:15, 14:30, etc...)

# Bauen und Forschen.

Ein "angebrochener" Tick zählt bereits zur Bauzeit/Forschungszeit hinzu. Praktisches Beispiel:
Die Bergbau-Forschung dauert 60 Minuten. Wenn ich die Forschung um 14:05 in Auftrag gebe, ist sie in 55 Minuten fertig. Ticks um: 14:15, 14:30, 14:45 und 15:00. Die Bergbau-Forschung ist mit dem Tick um 15:00 abgeschlossen.

Beliebig viele Gebäude und Forschungen können parallel zueinander gestartet werden oder laufen, vorrausgesetzt die jeweiligen Dependencies wurden bereits gebaut/erforscht.

# Ressourcen

Es gibt in Galaxy-Network 2 Ressourcen, Metall und Kristall.

## Koloniezentrum und Minen

Die folgenden Werte sind absolut, nicht komulierend. Die Werte gelten immer ab dem nächsten Tick nach Fertigstellung. Hat man z.B. das Koloniezentrum und eine Kristallmine, bekommt man 500 Metall und 1000 Kristall pro Tick.

- Koloniezentrum: 500 Metall und 500 Kristall
- Kristallmine: 1000 Kristall
- Metallmine: 1000 Metall
- Zweite Kristallmine: 2000 Kristall
- Zweite Metallmine: 2000 Metall
- Tiefe Kristallmine: 4000 Kristall
- Tiefe Metallmine: 4000 Metall
- Vollautomatisierte Kristallmine: 10000 Kristall
- Vollautomatisierte Metallmine: 10000 Metall

## Asteroiden und Extraktoren

### Asteroiden

- Nachdem das Observatorium gebaut ist, kann nach Asterioiden gescannt werden. 1 Asteroid kostet 10000 Kristall.
- Ein Asteroid bietet Platz für 20 Extraktoren.

### Extraktoren

- Ein Extraktor kann gebaut werden nachdem die Extraktoren-Technologie erforscht ist.
- Der erste Extraktor kostet 65 Metall. Jeder weitere Extraktor kostet 65 weitere Metalleinheiten. (Der erste kostet 65, der zweite 130, der dritte 195, etc..)
- Ein Extraktor liefert immer 50 Rohstoffe pro Tick nachdem er gebaut wurde. Es gibt Metallextraktoren und Kristallextraktoren, die Metall bzw. Kristall fördern.

# Techtree-Pfade (reine Bau-/Forschzeiten, Summe der Ticks)

## Pfad 1 — Antrieb / Werften

| Step | Tech | Ticks | Cumulative | Dependency of (ships) |
|------|------|------:|----------:|-----------------------|
| 1 | Militärischer Ionenantrieb | 144 | **144** | Fregatte |
| 2 | Protonenantrieb | 144 | **288** | Zerstörer |
| 3 | Fusionsantrieb | 108 | **396** | — |
| 4 | Nanofabriken | 144 | **540** | Jäger, Bomber, Kreuzer |
| 5 | Mak-tol Werften | 180 | **720** | Trägerschiff |
| 6 | Antimaterieantrieb | 108 | **828** | Schlachtschiff, Kommandoschiff |

**Total: 828 ticks**

## Pfad 2 — Waffen

| Step | Tech | Ticks | Cumulative | Dependency of (ships) |
|------|------|------:|----------:|-----------------------|
| 1 | Kinetische Raketen | 72 | **72** | Fregatte |
| 2 | Protonentorpedos | 72 | **144** | Zerstörer |
| 3 | Plasmawerfer | 72 | **216** | Jäger |
| 4 | Plasmabomben | 108 | **324** | Bomber |
| 5 | Fusionstorpedos | 108 | **432** | Kreuzer |
| 6 | Quantum Rotationskanonen | 108 | **540** | Trägerschiff |
| 7 | Antimaterietorpedos | 108 | **648** | Schlachtschiff, Kommandoschiff |

**Total: 648 ticks**
