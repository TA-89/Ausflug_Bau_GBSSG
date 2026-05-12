# Auffahrtsausflug Düsseldorf & Köln 2026

Reise-Webseite für den Auffahrtsausflug der **GBS St.Gallen · Bauabteilung** vom **14. – 17. Mai 2026**.

🔗 Live: `https://<dein-username>.github.io/<repo-name>/`

---

## 📁 Projektstruktur

```
/
├── index.html              # Hauptseite (alle Tage, Touren, Karten, Tipps)
├── programm.html           # Übersichtsseite (kompaktes Programm)
├── styles.css              # Styles
├── script.js               # Interaktive Karten + PWA-Logik
├── manifest.json           # PWA-Manifest (für App-Installation)
├── service-worker.js       # Offline-Support
├── assets/
│   ├── gbs-logo.png        # GBS-Logo (Header)
│   ├── icon-192.png        # PWA-Icon klein
│   ├── icon-512.png        # PWA-Icon gross
│   ├── apple-touch-icon.png # iOS Home-Screen-Icon
│   └── favicon-32.png      # Browser-Tab-Icon
└── README.md               # Diese Datei
```

## ✨ Features

- **Interaktive Karten** (Leaflet + OpenStreetMap) für Düsseldorf, Köln Tag, Köln Nacht
- **Geolocation** „Wo bin ich?" auf jeder Karte
- **Sehenswürdigkeits-Links** zu Webseiten/Wikipedia bei jedem Pin
- **2 Tour-Varianten** für Donnerstag-Nachmittag
- **6 Optionen** für Samstag-Nachmittag
- **PWA-fähig**: lässt sich auf iOS und Android als App installieren
- **Offline-fähig** durch Service Worker
- **Übersichtsseite** mit kompaktem Tabellen-Programm

## 🚀 Deployment auf GitHub Pages

1. Repository auf GitHub anlegen (Public).
2. Alle Dateien hochladen (inkl. Ordner `assets/`).
3. **Settings → Pages → Source: `Deploy from a branch` · Branch: `main` · Folder: `/ (root)`**
4. Nach 1–2 Minuten ist die Seite live unter `https://<username>.github.io/<repo>/`.

> Wichtig: Die Geolocation („Wo bin ich?") und die PWA-Installation funktionieren nur via **HTTPS**. GitHub Pages liefert automatisch HTTPS.

## 📱 PWA-Installation (App auf Handy)

**Android (Chrome):**
- Beim Öffnen der Seite erscheint unten ein dezenter Banner „App installieren?"
- Auf „Installieren" tippen → App landet auf dem Home-Screen

**iPhone/iPad (Safari):**
- Seite öffnen → Teilen-Symbol antippen → „Zum Home-Bildschirm"
- Die Seite zeigt diesen Hinweis automatisch

## ✏️ Inhalte ändern

- **Programmpunkte / Zeiten**: in `index.html` (Haupt) und `programm.html` (Übersicht)
- **Karten-Marker**: in `script.js` in den `places: [...]`-Arrays
- **Sehenswürdigkeits-Links**: in `script.js` beim jeweiligen `link: "..."`-Feld
- **Farben**: in `styles.css` ganz oben unter `:root { --lime: ... }`

Marker-Typen für Karten:
- `reserved` → rot (fix gebucht)
- `tour-a` → orange (Tour A)
- `tour-b` → violett (Tour B)
- `point` → dunkelblau (allgemein)
- `nightlife` → dunkelviolett (Ausgehviertel)

## 🛠️ Technik

- **Vanilla HTML/CSS/JS** — kein Build-Step nötig
- **Leaflet 1.9.4** für Karten — CDN via unpkg
- **OpenStreetMap + CARTO Voyager Tiles** — DSGVO-freundlich, kein API-Key
- **Service Worker** für Offline-Support (Cache-First-Strategie)
- **Google Fonts**: Caveat, Outfit, Manrope

## 📝 Lizenz / Kredits

- Kartenmaterial © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright) & © [CARTO](https://carto.com/attributions)
- GBS-Logo: Eigentum der [GBS St.Gallen](https://gbssg.ch)

---

*Stand: Mai 2026 · Alle Angaben ohne Gewähr.*
