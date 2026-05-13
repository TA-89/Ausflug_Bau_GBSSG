/* =========================================================
   GBS Bauabteilung · Karten + Interaktion + PWA
   Verwendet: Leaflet.js + OpenStreetMap (CARTO Voyager Tiles)
   ========================================================= */

(function() {
  'use strict';

  // ============ SERVICE WORKER + AUTO-UPDATE ============
  // Network-First-Strategie im Service Worker sorgt dafür, dass online immer die neueste Version geladen wird.
  // Zusätzlich: Wenn eine neue Service-Worker-Version installiert wird, zeigen wir einen Update-Banner.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('service-worker.js').then(function(registration) {
        // Bei jedem Page-Load nach Updates suchen
        registration.update();

        // Auf neue Service-Worker-Installationen reagieren
        registration.addEventListener('updatefound', function() {
          var newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Neue Version wartet → Update-Banner zeigen
              showUpdateBanner(newWorker);
            }
          });
        });
      }).catch(function() {});

      // Wenn der neue Service Worker übernimmt, Seite einmal neu laden
      var reloadingForUpdate = false;
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (reloadingForUpdate) return;
        reloadingForUpdate = true;
        window.location.reload();
      });

      // Stündlich nach Updates suchen (für lange offene Sessions, z.B. PWA im Hintergrund)
      setInterval(function() {
        navigator.serviceWorker.getRegistration().then(function(reg) {
          if (reg) reg.update();
        });
      }, 60 * 60 * 1000);
    });
  }

  function showUpdateBanner(worker) {
    var banner = document.getElementById('update-banner');
    var updateBtn = document.getElementById('update-btn');
    if (!banner || !updateBtn) return;
    banner.classList.add('show');
    updateBtn.addEventListener('click', function() {
      // Service Worker auffordern, sofort zu übernehmen
      worker.postMessage({ type: 'SKIP_WAITING' });
      banner.classList.remove('show');
    }, { once: true });
  }

  // ============ HARD REFRESH BUTTON ============
  // Leert den PWA-Cache und lädt die Seite frisch vom Server.
  // Wichtig: Ohne Cache-Löschung würde die App-Version aus dem Service Worker geladen.
  var refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      refreshBtn.classList.add('spinning');

      var clearCache = function() {
        if ('caches' in window) {
          return caches.keys().then(function(names) {
            return Promise.all(names.map(function(n) { return caches.delete(n); }));
          });
        }
        return Promise.resolve();
      };

      var unregisterSW = function() {
        if ('serviceWorker' in navigator) {
          return navigator.serviceWorker.getRegistrations().then(function(regs) {
            return Promise.all(regs.map(function(r) { return r.unregister(); }));
          });
        }
        return Promise.resolve();
      };

      // Cache leeren + Service Worker zurücksetzen, dann hart neuladen
      Promise.all([clearCache(), unregisterSW()]).catch(function() {}).finally(function() {
        // Cache-Buster-Parameter erzwingt Netzwerk-Anfrage
        var url = window.location.pathname + '?reload=' + Date.now();
        window.location.replace(url);
      });

      // Sicherheits-Fallback: falls Promise.finally nicht durchläuft, nach 2 Sek. hart reloaden
      setTimeout(function() {
        window.location.reload();
      }, 2000);
    });
  }

  // ============ WELCOME POPUP (1. Besuch oder erste PWA-Nutzung) ============
  var welcomeOverlay = document.getElementById('welcome-overlay');
  var welcomeClose = document.getElementById('welcome-close');
  var welcomeShownKey = 'gbs-reise-welcome-shown';
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (welcomeOverlay && !localStorage.getItem(welcomeShownKey)) {
    // Kurze Verzögerung, damit erst die Seite kurz zu sehen ist
    setTimeout(function() {
      welcomeOverlay.classList.add('show');
    }, isStandalone ? 600 : 1000);
  }

  function closeWelcome() {
    if (welcomeOverlay) {
      welcomeOverlay.classList.remove('show');
      localStorage.setItem(welcomeShownKey, '1');
    }
  }

  if (welcomeClose) welcomeClose.addEventListener('click', closeWelcome);
  if (welcomeOverlay) {
    // Klick auf den Hintergrund (nicht auf die Card) schliesst auch
    welcomeOverlay.addEventListener('click', function(e) {
      if (e.target === welcomeOverlay) closeWelcome();
    });
  }
  // ESC schliesst Popup
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && welcomeOverlay && welcomeOverlay.classList.contains('show')) {
      closeWelcome();
    }
  });

  // ============ PWA INSTALL — Button in der Topbar ============
  // Android Chrome (und andere unterstützte Browser) feuern beforeinstallprompt.
  // Wir fangen das Event ab, blenden den Topbar-Button ein, und triggern es per Klick.
  // Auf iOS gibt es kein Event → Button bleibt unsichtbar (Apple lässt das nicht zu).
  var deferredPrompt = null;
  var topbarInstallBtn = document.getElementById('install-btn');
  var alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (!alreadyInstalled && topbarInstallBtn) {
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
      // Button entfernen hidden + zeigen
      topbarInstallBtn.hidden = false;
      topbarInstallBtn.classList.add('available');
    });

    topbarInstallBtn.addEventListener('click', function() {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choice) {
        if (choice.outcome === 'accepted') {
          // Erfolgreich installiert → Button verschwindet
          topbarInstallBtn.classList.remove('available');
          topbarInstallBtn.hidden = true;
        }
        deferredPrompt = null;
      });
    });

    // Wenn die App tatsächlich installiert wurde
    window.addEventListener('appinstalled', function() {
      topbarInstallBtn.classList.remove('available');
      topbarInstallBtn.hidden = true;
      deferredPrompt = null;
    });
  }

  // ============ KARTEN-REGISTRY (für Card-Klicks die auf Pins fokussieren) ============
  var mapRegistry = {};

  // ============ KARTEN HELPERS ============
  function createPin(type, number, isMajor) {
    var classes = 'pin-marker ' + type + (isMajor ? ' major' : '');
    return L.divIcon({
      className: '',
      html: '<div class="' + classes + '"><span>' + (number || '') + '</span></div>',
      iconSize: [32, 42],
      iconAnchor: [16, 38],
      popupAnchor: [0, -38]
    });
  }

  function popup(opts) {
    var navUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + opts.lat + ',' + opts.lng;
    var infoLink = '';
    if (opts.link) {
      infoLink = '<a href="' + opts.link + '" target="_blank" rel="noopener">ℹ️ Mehr erfahren</a>';
    }
    return '<div class="popup">' +
      '<span class="popup-tag ' + opts.type + '">' + opts.tag + '</span>' +
      '<h4>' + opts.name + '</h4>' +
      '<p>' + opts.desc + '</p>' +
      '<div class="popup-links">' +
        '<a href="' + navUrl + '" target="_blank" rel="noopener">📍 Navigieren</a>' +
        (infoLink ? ' &nbsp; ' + infoLink : '') +
      '</div>' +
    '</div>';
  }

  // ============ MAP FACTORY ============
  // Erzeugt eine eigenständige Karte. Mehrere Karten parallel sind problemlos —
  // jede hat ihren eigenen Scope für User-Marker und Locate-Button.
  // major-Pins werden im Vollbild grösser angezeigt und im Vollbild-Auto-Zoom berücksichtigt.
  function buildMap(config) {
    var mapEl = document.getElementById(config.mapId);
    if (!mapEl) return;

    var map = L.map(config.mapId, {
      center: config.center,
      zoom: config.zoom,
      scrollWheelZoom: false
    });

    map.on('click', function() { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function() { map.scrollWheelZoom.disable(); });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    var majorBounds = [];
    config.places.forEach(function(p) {
      var marker = L.marker([p.lat, p.lng], { icon: createPin(p.type, p.num, p.major) }).addTo(map);
      marker.bindPopup(popup(p));
      if (p.major) majorBounds.push([p.lat, p.lng]);
    });

    // Geolocation pro Karte
    var userMarker = null;
    var accuracyCircle = null;
    var btn = document.getElementById(config.btnId);

    if (btn) {
      btn.addEventListener('click', function() {
        if (!navigator.geolocation) {
          alert('Geolokalisierung wird von deinem Browser nicht unterstützt.');
          return;
        }
        btn.classList.add('active');
        var btnLabel = btn.querySelector('span');
        if (btnLabel) btnLabel.textContent = 'Suche...';

        navigator.geolocation.getCurrentPosition(
          function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            var accuracy = pos.coords.accuracy;

            if (userMarker) map.removeLayer(userMarker);
            if (accuracyCircle) map.removeLayer(accuracyCircle);

            var youIcon = L.divIcon({
              className: '',
              html: '<div class="you-marker"></div>',
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            });
            userMarker = L.marker([lat, lng], { icon: youIcon }).addTo(map);
            userMarker.bindPopup('<div class="popup"><span class="popup-tag point">Du</span><h4>Dein Standort</h4><p>Genauigkeit: ±' + Math.round(accuracy) + ' m</p></div>');
            accuracyCircle = L.circle([lat, lng], {
              radius: accuracy,
              color: '#94B8D0',
              fillColor: '#94B8D0',
              fillOpacity: 0.1,
              weight: 1
            }).addTo(map);
            map.setView([lat, lng], 15);

            if (btnLabel) btnLabel.textContent = 'Standort aktualisiert';
            setTimeout(function() {
              if (btnLabel) btnLabel.textContent = 'Wo bin ich?';
              btn.classList.remove('active');
            }, 2500);
          },
          function(err) {
            alert('Standort konnte nicht ermittelt werden.\n\nMögliche Ursachen:\n• Berechtigung verweigert\n• Kein GPS-Signal\n• Browser im Privat-Modus\n• Seite läuft nicht via HTTPS');
            if (btnLabel) btnLabel.textContent = 'Wo bin ich?';
            btn.classList.remove('active');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    // ============ VOLLBILD ============
    // Karte merkt sich ihre normalen Bounds, im Vollbild zoomt sie auf die Major-Punkte
    var wrap = document.getElementById(config.wrapId);
    var fsBtn = wrap ? wrap.querySelector('.fullscreen-btn') : null;
    if (fsBtn && wrap) {
      var normalCenter = config.center;
      var normalZoom = config.zoom;

      fsBtn.addEventListener('click', function() {
        var isFs = wrap.classList.toggle('fullscreen');
        document.body.classList.toggle('has-fullscreen-map', isFs);

        // Button-Label umschalten
        var label = fsBtn.querySelector('span');
        if (label) label.textContent = isFs ? 'Schliessen' : 'Vollbild';

        // Map invalidieren (sonst rendert sie nur halb)
        setTimeout(function() {
          map.invalidateSize();
          if (isFs && majorBounds.length > 0) {
            // Auf die Hauptpunkte zoomen, mit Padding damit die Pins schön sichtbar sind
            map.fitBounds(majorBounds, { padding: [80, 80], maxZoom: 15 });
          } else if (!isFs) {
            // Zurück zur Normalansicht
            map.setView(normalCenter, normalZoom);
          }
        }, 50);
      });

      // ESC schliesst den Vollbild
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && wrap.classList.contains('fullscreen')) {
          fsBtn.click();
        }
      });
    }

    // Karte in der Registry ablegen — damit Card-Klicks darauf zugreifen können
    mapRegistry[config.mapId] = {
      map: map,
      wrapId: config.wrapId
    };

    return map;
  }

  // ============ DÜSSELDORF KARTE ============
  buildMap({
    mapId: 'map-dd',
    wrapId: 'map-dd-wrap',
    btnId: 'locate-dd',
    center: [51.2240, 6.7735],
    zoom: 14,
    places: [
      { lat: 51.2224, lng: 6.77522, type:'reserved', name:'Hotel Ruby Luna ★', major: true,
        tag:'BASIS', desc:'Kasernenstr. 39, 40213. Euer Quartier mitten in der Carlstadt.', num:'★',
        link:'https://www.rubyhotels.com/de/hotels/duesseldorf/ruby-luna/' },
      { lat: 51.2179423, lng: 6.7616801, type:'reserved', name:'Qomo · Rheinturm', major: true,
        tag:'Do 20:30 RESERVIERT', desc:'Asiatisches Fine Dining auf 172 m, rotierender Boden. Treffpunkt 20:15 vor dem Rheinturm.', num:'Q',
        link:'https://www.qomo-restaurant.de/' },
      { lat: 51.2161667, lng: 6.7572861, type:'reserved', name:'Medienhafen',
        tag:'Sa 11:30 PROGRAMM', desc:'Gehry-Bauten „Neuer Zollhof", WDR-Funkhaus, ehem. Industriehafen.', num:'M',
        link:'https://de.wikipedia.org/wiki/Medienhafen' },
      { lat: 51.2215533, lng: 6.78528, type:'reserved', name:'Brauerei Schumacher', major: true,
        tag:'Sa 19:00 RESERVIERT', desc:'Oststr. 123. Älteste Altbier-Brauerei Düsseldorfs, 1838.', num:'S',
        link:'https://www.schumacher-alt.de/' },

      { lat: 51.2274494, lng: 6.7711009, type:'tour-a', name:'Schlossturm & Burgplatz',
        tag:'Tour A · 14:30', desc:'Letzter Rest des Düsseldorfer Schlosses, 13. Jh. Heute Schifffahrtsmuseum.', num:'1',
        link:'https://de.wikipedia.org/wiki/Schlossturm_(D%C3%BCsseldorf)' },
      { lat: 51.2283929, lng: 6.775985, type:'tour-a', name:'K20 Kunstsammlung NRW',
        tag:'Tour A · 15:00', desc:'Schwarze Granitfassade von Dissing+Weitling. Picasso, Beuys, Klee.', num:'2',
        link:'https://www.kunstsammlung.de/de/museum/K20' },
      { lat: 51.2274, lng: 6.7820, type:'tour-a', name:'Kö-Bogen I + II',
        tag:'Tour A · 16:30', desc:'Libeskind (2013) + Ingenhoven (größte begrünte Fassade Europas — 30’000 Hainbuchen).', num:'3',
        link:'https://de.wikipedia.org/wiki/K%C3%B6-Bogen' },
      { lat: 51.2218775, lng: 6.779264, type:'tour-a', name:'Königsallee „Kö"',
        tag:'Tour A · 17:00', desc:'Boulevard dem Stadtgraben entlang. Vorbei am Dreischeibenhaus — Ikone der Nachkriegsmoderne.', num:'4',
        link:'https://de.wikipedia.org/wiki/K%C3%B6nigsallee_(D%C3%BCsseldorf)' },
      { lat: 51.2210, lng: 6.7690, type:'tour-a', name:'Mannesmann-Hochhaus',
        tag:'Tour A · 18:00', desc:'Eiermann & Schneider-Esleben, 1956–58. Eines der ersten modernen Hochhäuser Deutschlands.', num:'5',
        link:'https://de.wikipedia.org/wiki/Mannesmann-Hochhaus' },

      { lat: 51.2275403, lng: 6.7718871, type:'tour-b', name:'Stadterhebungsmonument',
        tag:'Tour B · 14:30', desc:'Bronze-Skulptur von Bert Gerresheim mit 30+ Szenen Stadtgeschichte. Burgplatz.', num:'1',
        link:'https://de.wikipedia.org/wiki/Stadterhebungsmonument' },
      { lat: 51.2282953, lng: 6.7715864, type:'tour-b', name:'St. Lambertus (schiefer Turm)',
        tag:'Tour B · 14:45', desc:'Backsteingotik 1288. Der verdrehte Spitzhelm ist Bauschaden, nicht Stilmittel.', num:'2',
        link:'https://de.wikipedia.org/wiki/St._Lambertus_(D%C3%BCsseldorf)' },
      { lat: 51.2249992, lng: 6.7722509, type:'tour-b', name:'Uerige',
        tag:'Tour B · 15:30', desc:'Berger Str. 1. Altbier-Klassiker. Köbes schenkt nach, bis ihr den Deckel aufs Glas legt.', num:'3',
        link:'https://www.uerige.de/' },
      { lat: 51.2250704, lng: 6.7725847, type:'tour-b', name:'Et Kabüffke',
        tag:'Tour B · 16:30', desc:'Flinger Str. 1. Heimat des Killepitsch-Kräuterlikörs. 6 Plätze drinnen, der Rest steht.', num:'4',
        link:'https://www.killepitsch.de/' },
      { lat: 51.2295321, lng: 6.7752499, type:'tour-b', name:'Brauerei Füchschen',
        tag:'Tour B · 17:00', desc:'Ratinger Str. 28. Familiärer als Uerige, gute rheinische Küche.', num:'5',
        link:'https://www.fuechschen.de/' },
      { lat: 51.2284918, lng: 6.7705631, type:'tour-b', name:'Rheinuferpromenade',
        tag:'Tour B · 18:00', desc:'1995 von Niklaus Fritschi gestaltet. Autofrei, 1,5 km bis zum Rheinturm.', num:'6',
        link:'https://de.wikipedia.org/wiki/Rheinuferpromenade' }
    ]
  });

  // ============ KÖLN KARTE (Tag) ============
  buildMap({
    mapId: 'map-cgn',
    wrapId: 'map-cgn-wrap',
    btnId: 'locate-cgn',
    center: [50.9450, 6.9400],
    zoom: 13,
    places: [
      { lat: 50.9430, lng: 6.9583, type:'point', name:'Köln Hauptbahnhof', major: true,
        tag:'ANKUNFT ~10:25', desc:'Ankunft mit RE/RB von Düsseldorf. 2 Minuten Fußweg zum Dom.', num:'B',
        link:'https://www.bahnhof.de/koeln-hbf' },
      { lat: 50.9413, lng: 6.9583, type:'reserved', name:'Kölner Dom', major: true,
        tag:'Fr 11:45 FÜHRUNG', desc:'UNESCO-Welterbe. Baubeginn 1248, Fertigstellung 1880. 157 m hoch.', num:'D',
        link:'https://www.koelner-dom.de/' },
      { lat: 50.9420, lng: 6.9560, type:'point', name:'Altstadt-Bereich (Lunch)',
        tag:'Fr ~13:00', desc:'Heumarkt-Bereich. „Leckerle" — Halve Hahn, Reibekuchen, Mettbrötchen.', num:'A',
        link:'https://www.koelntourismus.de/sehen-erleben/koelner-altstadt' },
      { lat: 50.9503, lng: 6.9144, type:'point', name:'Streetart Ehrenfeld',
        tag:'Fr Nm STREETART', desc:'Bahnhof Ehrenfeld und Heliosstraße. Geprägt vom CityLeaks-Festival.', num:'★',
        link:'https://www.koelntourismus.de/kunst-kultur/street-art' },
      { lat: 50.9355839, lng: 6.9521362, type:'reserved', name:"Bei d'r Tant", major: true,
        tag:'Fr ab 18:00 RESERVIERT', desc:'Cäcilienstr. 28. Traditionsgaststätte. Kölsch vom Fass, rheinische Küche.', num:'T',
        link:'https://beidrtant.de/' }
    ]
  });

  // ============ KÖLN NIGHTLIFE-KARTE ============
  buildMap({
    mapId: 'map-cgn-night',
    wrapId: 'map-cgn-night-wrap',
    btnId: 'locate-cgn-night',
    center: [50.9385, 6.9450],
    zoom: 14,
    places: [
      { lat: 50.9355839, lng: 6.9521362, type:'reserved', name:"Bei d'r Tant", major: true,
        tag:'AUSGANGSPUNKT', desc:'Ab hier startet ihr Richtung Nachtleben.', num:'T',
        link:'https://beidrtant.de/' },
      { lat: 50.9355, lng: 6.9385, type:'nightlife', name:'Rudolfplatz / Friesenviertel', major: true,
        tag:'AUSGEHVIERTEL', desc:'Klassisches Ausgehviertel. Bars, Pubs, kleine Clubs entlang Friesenstraße.', num:'1',
        link:'https://www.koeln.de/leben/stadtteile/friesenviertel/' },
      { lat: 50.9357, lng: 6.9433, type:'nightlife', name:'Belgisches Viertel', major: true,
        tag:'HIPSTER & CRAFT', desc:'Brüsseler Platz und Umgebung. Craft Beer, Cocktailbars, Lieblings-Eckkneipen.', num:'2',
        link:'https://www.koelntourismus.de/kunst-kultur/sehenswuerdigkeiten/detail/belgisches-viertel' },
      { lat: 50.9332, lng: 6.9523, type:'nightlife', name:'Heumarkt / Alter Markt', major: true,
        tag:'BRAUHÄUSER', desc:'Päffgen, Gaffel am Dom, Sünner im Walfisch — Kölsch direkt am Quell.', num:'3',
        link:'https://de.wikipedia.org/wiki/Heumarkt_(K%C3%B6ln)' },
      { lat: 50.9268, lng: 6.9527, type:'nightlife', name:'Südstadt (Severinsviertel)',
        tag:'GEMÜTLICH', desc:'Chilbi, Sünner Keller, das legendäre Lommerzheim (oft Schlange).', num:'4',
        link:'https://www.koeln.de/leben/stadtteile/severinsviertel/' }
    ]
  });

  // ============ CARD-KLICKS → KARTE FOKUSSIEREN ============
  // Buttons/Cards mit Attributen: data-map-focus="mapId" data-lat="..." data-lng="..." data-zoom="..."
  // Wenn man auf eine Card klickt: Seite scrollt zur Karte, Karte zentriert auf Punkt, Pin pulsiert.
  document.querySelectorAll('[data-map-focus]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      // Klick auf einen Link innerhalb der Card → dem Link folgen, nicht fokussieren
      if (e.target.tagName === 'A') return;

      var targetId = el.dataset.mapFocus;
      var lat = parseFloat(el.dataset.lat);
      var lng = parseFloat(el.dataset.lng);
      var zoom = parseInt(el.dataset.zoom || '16', 10);
      var entry = mapRegistry[targetId];
      if (!entry) return;

      var wrap = document.getElementById(entry.wrapId);
      if (!wrap) return;

      // Zur Karte scrollen
      wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Nach kurzer Wartezeit fokussieren + Pin pulsieren lassen
      setTimeout(function() {
        entry.map.setView([lat, lng], zoom);

        // Pin in der Nähe finden und visuell hervorheben
        entry.map.eachLayer(function(layer) {
          if (layer instanceof L.Marker) {
            var pos = layer.getLatLng();
            if (Math.abs(pos.lat - lat) < 0.0005 && Math.abs(pos.lng - lng) < 0.0005) {
              var iconEl = layer.getElement();
              if (iconEl) {
                var pin = iconEl.querySelector('.pin-marker');
                if (pin) {
                  pin.classList.add('focus-pulse');
                  setTimeout(function() { pin.classList.remove('focus-pulse'); }, 1900);
                }
              }
              layer.openPopup();
            }
          }
        });
      }, 600);
    });
  });

})();
