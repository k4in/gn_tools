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
