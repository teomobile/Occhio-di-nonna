# HANDOFF – Occhio di nonna

**Repository:** https://github.com/teomobile/Occhio-di-nonna (branch `main`)

Questo file serve a riprendere il lavoro al volo, da un altro account o da un'altra sessione.
**Va aggiornato alla fine di ogni sessione di lavoro**: stato, cosa è cambiato, prossimi passi.

---

## 1. In una riga

Webapp PWA per Android: segni sulla mappa dove trovi i tartufi, li salvi con data, note e foto, e funziona anche senza rete. Ci sono mappe offline, calendario di raccolta per Regione, strati con foto aeree storiche e zone vocate ai tartufi, e sincronizzazione automatica col server quando torna la rete.

## 2. Stato attuale

**Ultimo aggiornamento:** 19/11/2026

| Area | Stato | Note |
|---|---|---|
| Mappa + salvataggio punti (GPS o tocco) | ✅ fatto, testato nel browser | Data automatica; tipo, peso, cane, note e foto facoltativi |
| Elenco preferiti, ricerca, filtri, statistiche | ✅ fatto | |
| "Portami qui" (bussola + distanza) | ✅ fatto | Bussola non provata su un telefono vero |
| Mappe offline (satellite, topo, stradale) | ✅ fatto, testato | Limite di 4000 tessere per download |
| Coda di sincronizzazione offline → server | ✅ fatto, testato | Testato spegnendo e riaccendendo il server |
| Calendario per Regione/Provincia (automatico) | ✅ fatto, testato | 16 Regioni + Trentino; vedi §5 per l'affidabilità di ciascuna |
| Strati: foto storiche + zone vocate | ✅ fatto, testato | Passano dal proxy `/ov/` del server |
| Confronto a tendina (foto storica ↔ oggi) | ✅ fatto, testato | Pannello Leaflet `photoPane` ritagliato con `clip`; si attiva da Mappe e strati |
| Strato "boschi nati su ex campi" Toscana | ✅ fatto, testato | Arancione = agricolo nel 1954, bosco nel 2019 |
| "Vecchi campi" calcolati: Lombardia 1980→2015, Italia Corine 1990→2018 | ✅ fatto, testato | `IntersectLayer` in app.js incrocia due carte pixel per pixel nel browser |
| Suolo e geologia: rocce calcaree/marnose (ISPRA), pH (SoilGrids) | ✅ fatto, testato | pH lento (15–20 s/tessera), con un nuovo tentativo automatico |
| Backup GPX / JSON, import | ✅ fatto | Import non testato a fondo |
| Sentieri (Waymarked Trails) on/off | ✅ fatto, testato nel browser | Pulsante a lato + casella in Strati; inclusi nel download offline |
| Ricerca luoghi / coordinate / punti | ✅ fatto, testato nel browser | Nominatim solo all'invio (niente autocompletamento, come chiede la loro policy) |
| Prova su telefono Android reale | ❌ da fare | Serve HTTPS |
| Messa online (hosting HTTPS) | 🟡 provvisoria | Tunnel localhost.run dal PC: l'indirizzo cambia e cade se il PC si spegne. Hosting fisso da scegliere |
| Repository git | ✅ su GitHub | `main` pubblicato su teomobile/Occhio-di-nonna |

## 3. Come si avvia

```powershell
npm start
```

- Apri `http://localhost:8080` (porta modificabile con `$env:PORT=3000`).
- Token facoltativo per la sincronizzazione: `$env:SYNC_TOKEN="frase-lunga"`, da inserire uguale nell'app (Impostazioni → Sincronizzazione).
- Nessuna dipendenza npm: serve solo Node ≥ 18 (testato con Node 22).
- Sul telefono GPS, bussola e service worker funzionano **solo in HTTPS** (o su localhost).
- **Messa online provvisoria** (senza installare nulla): il token sta in `.env` (gitignored).
  ```bash
  export $(cat .env) && PORT=8090 node server.js      # 8080 sul PC di Matteo è occupata da Windows (PID 4)
  ssh -o StrictHostKeyChecking=accept-new -R 80:localhost:8090 nokey@localhost.run
  ```
  Il secondo comando stampa un indirizzo `https://….lhr.life`. Cambia a ogni avvio (e periodicamente): l'app installata con un indirizzo vecchio non si aggiorna più e i dati locali restano legati a quell'indirizzo, quindi esporta un backup prima di cambiarlo.
- Telefono via USB: `%LOCALAPPDATA%AndroidSdkplatform-toolsadb.exe` (serve il Debug USB attivo sul telefono).

## 4. Architettura

```
server.js              Node senza dipendenze:
                         - file statici da public/
                         - POST /api/sync   sincronizzazione (vince l'updatedAt più recente; il cursore è un contatore)
                         - GET  /api/finds  elenco punti (debug/export)
                         - GET  /ov/<id>/<z>/<x>/<y>  proxy tessere dei geoportali (elenco chiuso OVERLAYS)
                         - GET  /ov/<id>/legend       legenda come [{label, img}]
                         dati in data/finds.json (creata al primo salvataggio, da NON committare)
public/
  index.html           struttura UI
  styles.css           tema scuro "terra" (variabili in :root)
  app.js               tutta la logica UI: mappa Leaflet, form, elenco, dettaglio, navigazione,
                       pannello strati, impostazioni, backup, stato sync, zona/calendario
  db.js                IndexedDB (store "finds" e "meta")
  sync.js              coda: ogni record ha synced=false finché il server non lo conferma
  offline.js           BASEMAPS, OVERLAYS (lato client), calcolo e download tessere
  seasons.js           TYPES (specie) + CALENDARS per Regione, con override per Provincia
  zones.js             punto-in-poligono su province.json → {region, province}
  province.json        confini province ISTAT semplificati (~370 KB, fonte openpolis/geojson-italy)
  sw.js                service worker: app offline (network-first, timeout 3,5 s),
                       tessere e /ov/ in cache "tartufi-tiles" (cache-first)
  manifest.webmanifest PWA (icona SVG)
```

**Modello di un ritrovamento:**
`{ id, lat, lng, accuracy, type, weight, dog, notes, photo (dataURL JPEG), createdAt, updatedAt, deleted, synced, onServer }`

- `synced` e `onServer` esistono solo sul client.
- Le eliminazioni diventano "tombstone" (`deleted: true`) se il punto era già sul server.

**Preferenze locali** (localStorage, prefisso `tartufi.`): `view`, `layer`, `overlays`, `overlayOpacity`, `calendar` (zona scelta a mano), `lastType`, `lastDog`, `hintSeen`.

## 5. Fonti dati (verificate il 19/11/2026)

### Calendari di raccolta (`public/seasons.js`)

| Zona | Fonte |
|---|---|
| Piemonte | D.G.R. 15-8506 del 29/04/2024, allegato A (valido dal 1/9/2024) |
| Toscana | L.R. 36/2023, art. 8 |
| Lombardia | D.d.s. 18/03/2026 n. 3516 (stagione 2026–27), con date diverse per Pavia e Mantova |
| Veneto | L.R. 30/1988 art. 8, tabella regionale aggiornata a settembre 2024 |
| Trentino | Servizio Foreste PAT, L.P. 11/2007 (solo 5 specie ammesse) |
| Emilia-Romagna | Calendario 2026–2030, DGR 137/2026 (PDF ufficiale) |
| Marche | L.R. 5/2013 all. A, sostituito da L.R. 17/2024 (testo vigente Consiglio regionale) |
| Umbria | L.R. 12/2015 art. 110 (date "ultima domenica" calcolate: giorno `-1` in `seasons.js`) |
| Abruzzo | L.R. 66/2012 art. 2, testo aggiornato n. 8 (dichiarato vigente fino al 19/11/2025: controllare se c'è un n. 9) |
| Friuli Venezia Giulia | L.R. 23/1999 art. 11, testo vigente dal 27/10/2024 |
| Lazio | L.R. 82/1988 art. 4 (PDF sul sito della Regione) |
| Campania | Reg. reg. 3/2007 art. 8, testo vigente |
| Puglia | L.R. 8/2015 art. 15 (Bussola normativa del Consiglio) |
| Basilicata | L.R. 35/1995 all. A, pagina ufficiale della Regione; cambi annuali per DGR |
| Liguria ⚠️ | L.R. 2/2022 + decreto 2024–25 (temporaneo); nuovo decreto 2025 non letto |
| Molise ⚠️ | L.R. 24/2005 art. 8 (testo 2006 in G.U.) + modifica 2011 da fonte non ufficiale |
| Sicilia ⚠️ | L.R. 35/2020, calendario dal sito della Regione (2022); bianco da stampa; nero pregiato non trovato |
| Calabria, Sardegna, Valle d'Aosta, Alto Adige | Date nazionali indicative. Calabria: trovata solo una proposta di legge. Sardegna: L.R. 10/2023, calendario non trovato |

⚠️ = `check: 'da verificare'` in `seasons.js`; l'app lo mostra con un avviso rosso.
⚠️ La Lombardia rinnova il calendario ogni anno entro il 31 marzo, la Basilicata e la Liguria cambiano spesso per decreto: vanno ricontrollate ogni stagione.

### Strati (`server.js` → `OVERLAYS`)

| id | Servizio | Note |
|---|---|---|
| tos-1954 | WMS Regione Toscana `wmsofc`, layer `rt_ofc.10k54` | |
| tos-boschi-ex-campi | WMS Regione Toscana `wmsucs`, layer `rt_ucs.iducs.10k.2019-1954.rt` | Boschi 2019 colorati per uso del suolo 1954 |
| lom-1954 | ArcGIS REST `BaseMap/Lombardia_GAI_UTM32N` (export) | |
| pie-bianco / pie-nero / pie-scorzone | WMS CSI Piemonte `wms_vocazione_tartufigena_2025` | |
| lom-vocazione / lom-riservate | ArcGIS REST `agricoltura/agr_tartufi`, `aree_funghi_tartufi` | |
| ven-<specie> | GeoServer Regione Veneto `rv:<specie>_vocazionalita` | 9 specie |
| lom-agri1980 | ArcGIS `opendata/suolo1980`, layer 2, filtro `CODICE LIKE '2%'` | Sorgente per lom-ex-campi |
| lom-dusaf2015 | ArcGIS `BaseMap/DUSAF2015` | Non accetta filtri né query: i boschi si riconoscono dal colore (121,242,56) e arbusteti (164,255,115). Lento: ~20 s alla prima richiesta |
| corine-agri1990 / corine-bosco2018 | EEA `image.discomap.eea.europa.eu` Corine `CLC1990_WM` / `CLC2018_WM`, layer 0 vettoriale con `layerDefs` | Il vettoriale esiste solo sotto 1:250.000 → strato da zoom 11 |
| geo-litologia | GeoServer ISPRA `ge-core8` `litologia100k` + SLD nostro (`LITO_SLD` in server.js) | Stile di default inutile (tutto grigio). Salti netti tra fogli 1:100k |
| soil-ph | ISRIC SoilGrids `phh2o_0-5cm_mean` | Valori in pH×10; 15–20 s per tessera |

Strati calcolati nell'app (`intersect` in `offline.js`): `lom-ex-campi` (lom-agri1980 × lom-dusaf2015) e `it-corine-ex-campi` (corine-agri1990 × corine-bosco2018).

**Scartati:**
- PCN 1994: il servizio era giù.
- Veneto `rv:1954gai`: è solo il quadro d'unione, non le foto.
- Trentino: nessun WMS storico pubblico trovato.

**Mappe di base:** Esri World Imagery, OpenTopoMap, OpenStreetMap. Non permettono download massivi, da qui il limite di 4000 tessere. Per un uso serio serve un provider con chiave (MapTiler, Thunderforest).

## 6. Decisioni prese

- **Webapp/PWA prima dell'app nativa.** Un'eventuale app Android si può fare dopo con TWA (Bubblewrap) o Capacitor, riusando la webapp.
- **Vanilla JS + Leaflet 1.9.4 da unpkg**, senza build step: si modifica e si ricarica.
- **Salvataggio sempre prima in locale** (IndexedDB), sincronizzazione dopo. Si sincronizza all'evento `online`, al ritorno in primo piano, ogni 60 s e dopo ogni modifica.
- **Strati via proxy del server**: risolve CORS, il contenuto misto HTTP/HTTPS e permette la cache offline. Il proxy ha un elenco chiuso di sorgenti (non è un proxy aperto).
- **Le date di raccolta solo da fonti ufficiali verificate**, mai a memoria.
- **Zona automatica**: si usa il GPS se è recente e visibile sulla mappa, altrimenti il centro della mappa.
- **Nome: "Occhio di nonna".** I nomi interni restano `tartufi` (IndexedDB, prefisso localStorage, cache del service worker) per non perdere i dati già salvati.
- **"Vecchi campi"**: non si analizzano le foto pixel per pixel (inaffidabile sul b/n del 1954). Si usano le carte ufficiali dell'uso del suolo di due date; l'incrocio si fa nel browser (canvas), non sul server, così le tessere di partenza restano in cache per l'offline.
- **Calendari incerti**: si mostrano comunque, con l'avviso "da verificare", invece di nasconderli.

## 7. Decisioni aperte

- [ ] Dove ospitarla in HTTPS (VPS, Render, Fly.io, Railway…). Il server salva su file, quindi serve un disco persistente.
- [ ] Rendere il token di sincronizzazione obbligatorio in produzione: i punti sono segreti.

## 8. Prossimi passi (in ordine)

1. Mettere online in HTTPS e provare su un Android vero: GPS, bussola, tendina col dito, installazione, offline in un bosco.
2. Icone PNG 192/512 (per l'installazione su Android sono più affidabili dell'SVG).
3. Verificare i calendari segnati ⚠️ (Liguria, Molise, Sicilia) e cercare Sardegna (L.R. 10/2023) e Calabria.
4. Idee raccolte, non ancora fatte:
   - blocco con PIN o "modalità discreta";
   - storico dei ritrovamenti per tartufaia (più ritrovamenti nello stesso punto);
   - carte regionali dei suoli con pH e carbonati misurati (non trovate come servizio WMS; ERSAF, IPLA, ARPAV hanno i dati);
   - "vecchi campi" in Veneto con la Carta di copertura del suolo regionale (`rv:c0506171_ccs2021` sul GeoServer Veneto).

## 9. Diario delle sessioni

- **19/11/2026 – sessione 1**
  - Creata la webapp completa (mappa, salvataggio, preferiti, navigazione, mappe offline, sincronizzazione, backup) e il server Node.
  - Aggiunti calendario per Regione/Provincia (5 zone verificate su fonti ufficiali) e strati storici e tartufigeni via proxy.
  - Tutto testato nel browser a misura di telefono; nessun test su un dispositivo reale.
- **19/11/2026 – sessione 1 (continua)**
  - App rinominata "Occhio di nonna".
  - Aggiunti il confronto a tendina tra foto storica e satellite e lo strato Toscana "boschi nati su ex campi (1954→2019)".
  - Creato il repository git e pubblicato `main` su GitHub (teomobile/Occhio-di-nonna).
- **19/11/2026 – sessione 2**
  - Strati "vecchi campi" calcolati: Lombardia (uso del suolo 1980 × DUSAF 2015) e Italia (Corine 1990 × 2018).
  - Nuovo gruppo "Suolo e geologia": rocce calcaree e marnose (ISPRA) e pH del suolo (SoilGrids).
  - Calendari aggiunti per 12 Regioni (9 da testi ufficiali, 3 da verificare); supporto alle date "ultima domenica del mese".
  - Testato nel browser a misura di telefono (Bergamo, Perugia).
- **20/11/2026 – sessione 3 (strati offline)**
  - Il Pixel era rimasto alla v8 (avviato senza cavo, quindi il service worker non si aggiornava): forzato l'aggiornamento, l'interruttore della sincronizzazione c'è ed è spento.
  - Ogni strato ha ora un dettaglio massimo (`maxNative` in `offline.js`: foto 17, ex-campi Toscana/Lombardia 16, litologia 14, pH e Corine 13). Oltre quel dettaglio Leaflet ingrandisce le tessere già salvate: si scarica molto meno e offline lo strato resta visibile a ogni zoom. Service worker v10. **Non ancora committato.**
  - L'utente cerca di solito in **Trentino**, dove valgono solo gli strati nazionali (litologia, pH, Corine ex-campi). Scaricati sul Pixel per **tutta la provincia di Trento** (solo tessere dentro il confine di `province.json`): pH z9–13, Corine 1990 e 2018 z11–13, litologia z9–14 = 5.949 tessere, circa 50 MB. Lanciato via CDP con `downloadTiles` della pagina. **Completato il 23/11** (5.949/5.949, 0 errori; ripreso dopo un'interruzione a 3.042). Provato senza server (`adb reverse --remove`): la litologia a zoom 16 compare dalle tessere salvate. Tolte dalla cache del telefono le 61 tessere `ov/it-1988`. Per rifarlo o per un'altra zona: `tools/tn.cjs` (tessere dentro un confine di `province.json`), `tools/dl.mjs start|status`, `tools/cdp.mjs`. Le mappe di base vanno scaricate a parte per zona.
  - Amico: senza HTTPS pubblico l'unica via è installarla sul suo telefono via USB dal PC (`adb reverse`), come per il Pixel.
- **20/11/2026 – sessione 3 (continua)**
  - **Sincronizzazione spenta di base** (per ora i punti restano solo sul telefono). Interruttore "Sincronizza con un server" nelle Impostazioni; indirizzo e token restano salvati (`enabled` in meta `sync`, default false). A sincronizzazione spenta niente pallini "da sincronizzare" e la pillola dice "Sul telefono".
  - Aggiunti lo strato Sentieri (tile.waymarkedtrails.org, pane `trailPane` z 350, preferenza `trails`) e la ricerca (luoghi Nominatim limitati all'Italia, coordinate, note dei punti). Service worker v5.
  - Testato nel browser a misura di telefono e sul Pixel 8a.
  - Slider strati: era 0,2–1, partiva da 0,7 a prescindere ed era ignorato dalle foto in modalità tendina. Ora 0–100% dal valore reale, vale anche nel confronto, e mentre si trascina il pannello diventa trasparente (classe `body.peek`).
  - Italia 1988 (PCN) **rimosso su richiesta**. Motivi: a zoom ≤ 12 il WMS restituisce un JPEG tutto bianco (velo bianco sulla mappa) → `minZoom: 13`. In alcune zone (es. sopra il Garda, 45.89 N 10.93 E) il PCN risponde con un errore `msShapefileOpen(): Unable to access file` per alcune tessere: buco lato loro, quelle tessere restano vuote.
  - Debug sul telefono: `adb forward tcp:9222 localabstract:chrome_devtools_remote` e poi Runtime.evaluate via WebSocket (script di prova nella scratchpad, non nel repo).
- **19/11/2026 – sessione 3**
  - App online in HTTPS provvisoria: server sulla porta 8090 con token obbligatorio (`.env`) e tunnel localhost.run. Verificato che risponde e che `/api/sync` senza token dà 401.
  - Tunnel localhost.run troppo lento (limite banda gratuita). App installata sul Pixel 8a via USB: `adb reverse tcp:8090 tcp:8090` e Chrome su `http://localhost:8090` (contesto sicuro), poi Installa. Token inserito. Il reverse si perde a ogni scollegamento del cavo.

---

### Come aggiornare questo file
A fine sessione: aggiorna la data e la tabella "Stato attuale", sposta in "Decisioni prese" quello che è stato deciso, riordina i "Prossimi passi" e aggiungi una voce breve al diario.
