# 👽 AlienClicker — Bio-Specimen Harvester

Ein Auto-Clicker im Stil des **Alien**-Filmuniversums (Weyland-Yutani / Xenomorph).
Reines HTML/CSS/JS — keine Installation, kein Build.

## Spielen

`index.html` im Browser öffnen (Doppelklick genügt).

## Spielprinzip

Im Auftrag der **Weyland-Yutani Biowaffen-Sparte** erntest du **Biomasse** aus einem Ovomorph.

- **Klicken** auf das Ei → Biomasse pro Entnahme.
- **Spezimen** (Auto-Produzenten): der Xenomorph-Lebenszyklus
  Facehugger → Chestburster → Drohne → Krieger → Praetorianer → Königin →
  Hive → Derelict → LV-426 → W-Y Biowaffen-Sparte. Jede Stufe produziert
  passiv Biomasse pro Sekunde.
- **Ausrüstung**: einmalige Upgrades (Pulsgewehr, Power-Loader, Flammenwerfer …),
  die deine Klickkraft vervielfachen.
- **Auto-Save** im Browser-`localStorage`, inkl. gedeckeltem Offline-Ertrag.

## Aufbau

| Datei         | Inhalt                                   |
|---------------|------------------------------------------|
| `index.html`  | Struktur & UI (Weyland-Yutani-Terminal)  |
| `style.css`   | CRT-/Scanline-Optik, Layout              |
| `game.js`     | Spiellogik, Generatoren, Speichern       |

Neue Spezimen oder Ausrüstung lassen sich einfach in den Arrays `GENERATORS`
bzw. `EQUIPMENT` am Anfang von `game.js` ergänzen.
