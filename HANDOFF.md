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
| Calendario per Regione/Provincia (automatico) | ✅ fatto, testato | Piemonte, Toscana, Lombardia (+Pavia/Mantova), Veneto, Trentino |
| Strati: foto storiche + zone vocate | ✅ fatto, testato | Passano dal proxy `/ov/` del server |
| Confronto a tendina (foto storica ↔ oggi) | ✅ fatto, testato | Pannello Leaflet `photoPane` ritagliato con `clip`; si attiva da Mappe e strati |
| Strato "boschi nati su ex campi" Toscana | ✅ fatto, testato | Arancione = agricolo nel 1954, bosco nel 2019 |
| Backup GPX / JSON, import | ✅ fatto | Import non testato a fondo |
| Prova su telefono Android reale | ❌ da fare | Serve HTTPS |
| Messa online (hosting HTTPS) | ❌ da fare | |
| Repository git | ✅ creato in locale | Vedi il diario: verificare se il push su GitHub è stato fatto |

## 3. Come si avvia

```powershell
npm start
```

- Apri `http://localhost:8080` (porta modificabile con `$env:PORT=3000`).
- Token facoltativo per la sincronizzazione: `$env:SYNC_TOKEN="frase-lunga"`, da inserire uguale nell'app (Impostazioni → Sincronizzazione).
- Nessuna dipendenza npm: serve solo Node ≥ 18 (testato con Node 22).
- Sul telefono GPS, bussola e service worker funzionano **solo in HTTPS** (o su localhost).

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
| Altre zone | L. 752/1985: date **indicative**, non verificate per Regione |

⚠️ La Lombardia rinnova il calendario ogni anno entro il 31 marzo: va ricontrollato ogni primavera.

### Strati (`server.js` → `OVERLAYS`)

| id | Servizio | Note |
|---|---|---|
| it-1988 | WMS PCN/MASE `ortofoto_bn_88` | Solo HTTP, a volte non risponde (il server riprova una volta) |
| tos-1954 | WMS Regione Toscana `wmsofc`, layer `rt_ofc.10k54` | |
| tos-boschi-ex-campi | WMS Regione Toscana `wmsucs`, layer `rt_ucs.iducs.10k.2019-1954.rt` | Boschi 2019 colorati per uso del suolo 1954 |
| lom-1954 | ArcGIS REST `BaseMap/Lombardia_GAI_UTM32N` (export) | |
| pie-bianco / pie-nero / pie-scorzone | WMS CSI Piemonte `wms_vocazione_tartufigena_2025` | |
| lom-vocazione / lom-riservate | ArcGIS REST `agricoltura/agr_tartufi`, `aree_funghi_tartufi` | |
| ven-<specie> | GeoServer Regione Veneto `rv:<specie>_vocazionalita` | 9 specie |

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
- **"Vecchi campi"**: non si analizzano le foto pixel per pixel (inaffidabile sul b/n del 1954). Si usano le carte ufficiali dell'uso del suolo di due date.

## 7. Decisioni aperte

- [ ] Dove ospitarla in HTTPS (VPS, Render, Fly.io, Railway…). Il server salva su file, quindi serve un disco persistente.
- [ ] Rendere il token di sincronizzazione obbligatorio in produzione: i punti sono segreti.

## 8. Prossimi passi (in ordine)

1. Mettere online in HTTPS e provare su un Android vero: GPS, bussola, tendina col dito, installazione, offline in un bosco.
2. Icone PNG 192/512 (per l'installazione su Android sono più affidabili dell'SVG).
3. "Vecchi campi" in Lombardia: incrociare Uso del suolo 1980 (`agricoltura/Uso_suolo_1980` o `opendata/suolo1980`) con DUSAF recente (`opendata/dusaf*`) sul server ArcGIS della Regione.
4. Idee raccolte, non ancora fatte:
   - blocco con PIN o "modalità discreta";
   - storico dei ritrovamenti per tartufaia (più ritrovamenti nello stesso punto);
   - carte dei suoli/geologiche (pH, calcare);
   - Corine Land Cover 1990→2018 per i campi abbandonati;
   - calendari di altre Regioni.

## 9. Diario delle sessioni

- **19/11/2026 – sessione 1**
  - Creata la webapp completa (mappa, salvataggio, preferiti, navigazione, mappe offline, sincronizzazione, backup) e il server Node.
  - Aggiunti calendario per Regione/Provincia (5 zone verificate su fonti ufficiali) e strati storici e tartufigeni via proxy.
  - Tutto testato nel browser a misura di telefono; nessun test su un dispositivo reale.
- **19/11/2026 – sessione 1 (continua)**
  - App rinominata "Occhio di nonna".
  - Aggiunti il confronto a tendina tra foto storica e satellite e lo strato Toscana "boschi nati su ex campi (1954→2019)".
  - Creato il repository git locale con primo commit; remote `origin` impostato su GitHub.

---

### Come aggiornare questo file
A fine sessione: aggiorna la data e la tabella "Stato attuale", sposta in "Decisioni prese" quello che è stato deciso, riordina i "Prossimi passi" e aggiungi una voce breve al diario.
