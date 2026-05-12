# Auffahrtsausflug Düsseldorf & Köln 2026

Reise-Webseite für den Auffahrtsausflug der **GBS St.Gallen · Bauabteilung** vom **14. – 17. Mai 2026**.

🔗 Live: `https://<dein-username>.github.io/<repo-name>/`

---

## 📁 Projektstruktur

```
/
├── index.html          # Hauptseite (alle Tage, Touren, Karten)
├── styles.css          # Styles (Farben, Layout, Responsive)
├── script.js           # Interaktive Karten (Leaflet) + Geolocation
├── assets/
│   └── gbs-logo.png    # GBS-Logo (für Header und Favicon)
└── README.md           # Diese Datei
```

## 🚀 Deployment auf GitHub Pages

1. Repository auf GitHub anlegen (Public).
2. Alle Dateien hochladen (inkl. Ordner `assets/`).
3. **Settings → Pages → Source: `Deploy from a branch` · Branch: `main` · Folder: `/ (root)`**
4. Nach 1–2 Minuten ist die Seite live unter `https://<username>.github.io/<repo>/`.

> Wichtig: Die Geolocation („Wo bin ich?") funktioniert nur via **HTTPS**. GitHub Pages liefert automatisch HTTPS.

## ✏️ Inhalte ändern

- **Programmpunkte / Zeiten**: in `index.html` im jeweiligen `<section class="day">`-Block.
- **Karten-Marker**: in `script.js` in den `places: [...]`-Arrays. Jeder Eintrag hat `lat`, `lng`, `type`, `name`, `tag`, `desc`, `num`.
- **Farben**: in `styles.css` ganz oben unter `:root { --lime: ... }`.

Marker-Typen für die Karten:
- `reserved` → rot (fix gebucht)
- `tour-a` → orange (Tour A)
- `tour-b` → violett (Tour B)
- `point` → dunkelblau (allgemein)
- `nightlife` → dunkelviolett (Ausgehviertel)

## 🛠️ Technik

- **Vanilla HTML/CSS/JS** — kein Build-Step nötig, einfach hochladen.
- **Leaflet 1.9.4** (Karten) — geladen via unpkg CDN.
- **OpenStreetMap + CARTO Voyager Tiles** — kostenlos, kein API-Key, DSGVO-freundlich.
- **Google Fonts**: Caveat, Outfit, Manrope.

## 📝 Lizenz / Kredits

- Kartenmaterial © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright) & © [CARTO](https://carto.com/attributions)
- GBS-Logo: Eigentum der [GBS St.Gallen](https://gbssg.ch)

---

*Stand: Mai 2026 · Alle Angaben ohne Gewähr.*
