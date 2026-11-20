# Occhio di nonna

Webapp (PWA) per segnare i punti dove trovi i tartufi, pensata per Android e per funzionare nel bosco senza rete.

## Avvio

```powershell
npm start
```

Apri `http://localhost:8080`. Per usare un altro porto: `$env:PORT=3000; npm start`.
Per proteggere i dati con un token: `$env:SYNC_TOKEN="una-frase-lunga"; npm start` e inserisci lo stesso token nell'app (Impostazioni → Sincronizzazione).

## Sul telefono

GPS, bussola e funzionamento offline richiedono **HTTPS** (o `localhost`). Per provare dal telefono:
- pubblica la cartella su un hosting con HTTPS (il server Node serve sia l'app sia l'API), oppure
- usa un tunnel HTTPS verso il PC (es. Cloudflare Tunnel, ngrok).

Poi in Chrome: menu ⋮ → **Aggiungi a schermata Home / Installa app**.

## Funzioni

- **Salva qui**: salva la posizione GPS con la precisione (±m); oppure tocca la mappa per scegliere il punto.
- Data e ora salvate in automatico; tipo di tartufo, peso, cane, note e foto sono facoltativi.
- Avviso se entro 30 m hai già trovato tartufi (anche anni precedenti).
- **Portami qui**: freccia con bussola e distanza per tornare al punto, schermo sempre acceso.
- **Calendario regionale automatico**: l'app riconosce Regione e Provincia (anche offline, dai confini in `public/province.json`) e mostra cosa è in stagione lì. Calendari di 16 Regioni più il Trentino (vedi HANDOFF.md per le fonti; alcune sono segnate "da verificare"); altrove date nazionali indicative. Si può anche scegliere la zona a mano.
- **Strati** (pulsante in alto a destra): foto aeree storiche (Toscana 1954, Lombardia 1954) e carte delle zone vocate ai tartufi (Piemonte, Lombardia, Veneto) con legenda. Passano dal server (`/ov/...`) e si possono scaricare per l'uso offline.
- **Confronto a tendina**: foto storica a sinistra, satellite di oggi a destra, separati da una barra da trascinare.
- **Vecchi campi**: boschi di oggi nati su terreni un tempo coltivati. Toscana 1954→2019 (carta regionale), Lombardia 1980→2015 e Italia 1990→2018 (Corine), calcolati dall'app incrociando due carte.
- **Suolo e geologia**: rocce calcaree e marnose (ISPRA, carta litologica 1:100.000) e pH del suolo (SoilGrids).
- **Sentieri**: sentieri segnati (CAI e altri, da OpenStreetMap via Waymarked Trails) sopra qualsiasi mappa; si accendono e spengono col pulsante a lato o dal pannello Strati, e si possono scaricare per l'uso offline.
- **Cerca** (lente in alto a destra): paesi, monti e località (OpenStreetMap/Nominatim, serve la rete), coordinate (`44.70, 8.03` o `44,70 8,03`) e note dei tuoi punti (anche offline).
- **Mappe offline**: satellite, topografica, stradale. Scarica la zona visibile; le zone già viste restano in cache.
- **Sincronizzazione**: tutto si salva prima sul telefono (IndexedDB); i punti in attesa partono da soli appena torna la rete.
- Backup: esporta **GPX** (app GPS, Google Earth) e backup JSON con note e foto; importa backup.

## Struttura

```
server.js            server Node senza dipendenze (file statici + /api/sync), dati in data/finds.json
public/index.html    interfaccia
public/app.js        logica dell'app (mappa, form, elenco, navigazione, impostazioni)
public/db.js         archivio locale IndexedDB
public/sync.js       coda di sincronizzazione
public/offline.js    download tessere mappa
public/seasons.js    tipi di tartufo e calendario
public/sw.js         service worker (offline)
```

## Fonti dei calendari (da ricontrollare ogni stagione)

| Zona | Fonte |
|---|---|
| Piemonte | D.G.R. 15-8506 del 29/04/2024, allegato A |
| Toscana | L.R. 36/2023, art. 8 |
| Lombardia | D.d.s. 18/03/2026 n. 3516, calendario 2026–2027 |
| Veneto | L.R. 30/1988 art. 8, tabella regionale aggiornata a settembre 2024 |
| Trentino | Servizio Foreste PAT, L.P. 11/2007 |

Le date sono in `public/seasons.js`.

## Note sulle mappe

Le tessere vengono da Esri World Imagery, OpenTopoMap e OpenStreetMap. Questi servizi non permettono download massivi: l'app limita ogni download a 4000 tessere. Per un uso più intenso conviene un fornitore di tessere con chiave (es. MapTiler, Thunderforest).
