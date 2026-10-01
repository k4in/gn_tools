# Kampfwerte

Quelle: [galaxy-network.de/helpsys](https://galaxy-network.de/helpsys) (Kampfsystem).
Kosten und Bauzeiten: `ships.ts`, `defense.ts` (15-Minuten-Ticks).

Jedes Schiff/Geschütz hat mehrere mögliche Ziele. Tritt nur **ein** gelisteter Gegnertyp auf, gilt der **absolute** Wert. Treten **alle** gelisteten Typen auf, gilt der Prozentwert darunter (Feuerverteilung). Treffen nicht alle Typen zu, im Tool: Anteile der anwesenden Ziele neu normieren.

Nach dem ersten Schussdurchgang können Schützen übrig sein, deren Soll-Ziele schon tot sind bzw. die kein volles Ziel mehr schaffen — die feuern dann mit voller Kraft auf die restlichen gültigen Ziele (siehe Help-Beispiel Horus vs. Draco+Cleptor).

## Geschütze

Baufertigung in Ticks, Kosten Metall/Kristall.

| Einheit | Tech | Ticks | Met | Kris | Summe | Ziele (absolut) | Feuerverteilung | Vorfeuer |
|---------|------|------:|----:|-----:|------:|-----------------|-----------------|----------|
| Horus | Abfangjäger | 8 | 1000 | 1000 | 2000 | 0,0114 Draco **oder** 0,3200 Cleptor | 40% / 60% | — |
| Rubium | Leichtes Orbitalgeschütz | 18 | 6000 | 2000 | 8000 | 0,3000 Leo **oder** 1,2800 Cleptor | 60% / 40% | — |
| Pulsar | Leichtes Raumgeschütz | 28 | 20000 | 10000 | 30000 | 1,2000 Aquilae **oder** 0,5334 Fornax | 40% / 60% | 1 Tick vorher, 50% Wirksamkeit. Bomber in Trägern sind nicht betroffen. |
| Coon | Mittleres Raumgeschütz | 52 | 60000 | 100000 | 160000 | 0,9143 Draco **oder** 0,4267 Goron | 40% / 60% | 1 Tick vorher, 50% |
| Centurion | Schweres Raumgeschütz | 80 | 200000 | 300000 | 500000 | 0,5000 Pentalin **oder** 0,3750 Zenit | 50% / 50% | 2 Ticks vorher 20%, 1 Tick vorher 60%. Trägerabschuss tötet Jäger/Bomber im Träger. |
| Zitadelle | Raumbasis | 128 | 500000 | 300000 | 800000 | 0,3200 Sculptor **oder** 125,00 Cleptor | 60% / 40% | 2 Ticks vorher 25%, 1 Tick vorher 50% |

## Schiffe

| Einheit | Tech | Ticks | Met | Kris | Summe | Ziele (absolut) | Feuerverteilung | Sonder |
|---------|------|------:|----:|-----:|------:|-----------------|-----------------|--------|
| Leo | Jäger | 12 | 4000 | 6000 | 10000 | 0,0050 Zitadelle **oder** 0,4000 Aquilae **oder** 0,0263 Goron | 35% / 30% / 35% | fliegt **nur im Zenit**; ohne Träger kein Angriff |
| Aquilae | Bomber | 16 | 2000 | 8000 | 10000 | 0,0080 Centurion **oder** 0,0100 Pentalin **oder** 0,0075 Zenit **oder** 0,0040 Sculptor | 25% / 25% / 25% / 25% | fliegt **nur im Zenit**; in Trägern kein Pulsar-Vorfeuer |
| Fornax | Fregatte | 32 | 15000 | 7500 | 22500 | 4,5000 Horus **oder** 0,9000 Leo | 60% / 40% | — |
| Draco | Zerstörer | 56 | 40000 | 30000 | 70000 | 3,5000 Rubium **oder** 1,2444 Fornax | 60% / 40% | — |
| Goron | Kreuzer | 80 | 65000 | 85000 | 150000 | 2,0000 Pulsar **oder** 0,8571 Draco **oder** 10,0000 Cancri | 35% / 30% / 35% | — |
| Pentalin | Schlachtschiff | 120 | 250000 | 150000 | 400000 | 1,0000 Coon **oder** 1,0666 Goron **oder** 0,4000 Pentalin **oder** 0,3019 Zenit **oder** 0,1600 Sculptor | 20% je | — |
| Zenit | Trägerschiff | 120 | 200000 | 50000 | 250000 | 25,000 Cleptor **oder** 14,0000 Cancri | 50% / 50% | **100** Leo/Aquilae je Zenit. Ohne Träger können Jäger und Bomber nicht angreifen. Trägerabschuss tötet die Ladung. |
| Sculptor | Kommandoschiff | 192 | 400000 | 600000 | 1000000 | 0,500 Zitadelle **oder** 1,200 Zenit **oder** 120,0 Cancri | 40% / 30% / 30% | — |
| Cancri | Schildschiff | 40 | 1000 | 1500 | 2500 | kein Schaden | — | blockt je Tick 1 gegnerischen Cleptor beim Extraktor-Diebstahl |
| Cleptor | Kaperschiff | 32 | 1500 | 1000 | 2500 | kein Schaden | — | klaut **genau 1** Extraktor, wenn nach Beschuss noch weniger Cancri als Cleptoren da sind, und wird dabei zerstört |

## Wertvernichtung

Nahezu alle Design-Matchups liegen bei **≈ 0,40** zerstörtem Baukostenwert pro eingesetzter Baukosteneinheit **pro Kampftick** (100 % Feuer auf genau dieses Ziel).

Ausnahmen darunter (Ziel ist „zäher“ als die Kostenformel):

| Schütze | Ziel | Wert/Kosten/Tick |
|---------|------|-----------------:|
| Aquilae | Zenit | 0,188 |
| Pentalin | Zenit | 0,189 |
| Centurion | Zenit | 0,188 |
| Goron | Cancri | 0,167 |
| Zenit | Cleptor | 0,250 |
| Zenit | Cancri | 0,140 |
| Sculptor | Zenit | 0,300 |
| Sculptor | Cancri | 0,300 |
| Rubium | Leo | 0,375 |

## Help-Beispiel (Feuerverteilung + Restfeuer)

2500 Horus gegen 200 Draco und 1500 Cleptor.

1. Split 40/60: `2500 × 0,0114 × 0,4 = 11,4` → 11 Draco; `2500 × 0,32 × 0,6 = 480` Cleptor.
2. Verbrauchte Horus: `11 / 0,0114 ≈ 965` plus `480 / 0,32 = 1500` → Rest ≈ 35.
3. 35 Horus schaffen keinen ganzen Draco mehr → 100 % auf Cleptor: `35 × 0,32 ≈ 11`.
4. Ergebnis: **11 Draco, 491 Cleptor**.
