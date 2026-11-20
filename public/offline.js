// Mappe offline: le tessere vengono messe in una cache che il service worker legge per primo.
export const TILE_CACHE = 'tartufi-tiles';
export const MAX_TILES = 4000;

export const BASEMAPS = {
  sat: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxNativeZoom: 18,
    kbPerTile: 25,
    attribution: 'Immagini © Esri, Maxar, Earthstar Geographics',
  },
  topo: {
    name: 'Topografica',
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 17,
    kbPerTile: 20,
    attribution: '© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)',
  },
  osm: {
    name: 'Stradale',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 19,
    kbPerTile: 15,
    attribution: '© OpenStreetMap contributors',
  },
};

// Sentieri segnati (CAI e altri) da OpenStreetMap: immagine trasparente da sovrapporre a qualsiasi mappa
export const TRAILS = {
  name: 'Sentieri',
  url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
  maxNativeZoom: 18,
  kbPerTile: 6,
  attribution: 'Sentieri © waymarkedtrails.org, OpenStreetMap (CC-BY-SA)',
};

// Strati sopra la mappa. Passano dal server dell'app (/ov/...), che li prende dai geoportali ufficiali:
// così funzionano anche in HTTPS e possono essere salvati per l'uso offline.
export const OVERLAYS = [
  { id: 'tos-1954',     group: 'Foto aeree storiche', name: 'Toscana 1954',       region: 'Toscana',   opacity: 1,   source: 'Regione Toscana – Geoscopio' },
  { id: 'lom-1954',     group: 'Foto aeree storiche', name: 'Lombardia 1954 (volo GAI)', region: 'Lombardia', opacity: 1, source: 'Regione Lombardia – Geoportale' },
  { id: 'tos-boschi-ex-campi', group: 'Vecchi campi', name: 'Toscana – boschi nati su ex campi (1954→2019)', region: 'Toscana', opacity: 0.7, legend: true,
    source: 'Regione Toscana – Uso del suolo 2019-1954', hint: 'Arancione: nel 1954 era terreno agricolo, oggi è bosco. Verde: bosco già nel 1954.' },
  // Calcolati nell'app incrociando due carte: dove ieri si coltivava e oggi c'è bosco o arbusteto
  { id: 'lom-ex-campi', group: 'Vecchi campi', name: 'Lombardia – boschi nati su ex campi (1980→2015)', region: 'Lombardia', opacity: 0.8,
    intersect: { past: 'lom-agri1980', now: 'lom-dusaf2015', nowColors: [[121, 242, 56], [164, 255, 115]] }, color: '#ff8c1a',
    legendItems: [{ color: '#ff8c1a', label: 'Agricolo nel 1980, bosco o arbusteto nel 2015' }],
    source: 'Calcolato da Regione Lombardia: Uso del suolo 1980 × DUSAF 2015', hint: 'Dettaglio buono (carte regionali), visibile da zoom 12.', minZoom: 12 },
  { id: 'it-corine-ex-campi', group: 'Vecchi campi', name: 'Italia – campi diventati bosco (1990→2018)', region: null, opacity: 0.75,
    intersect: { past: 'corine-agri1990', now: 'corine-bosco2018' }, color: '#e8590c',
    legendItems: [{ color: '#e8590c', label: 'Agricolo nel 1990, bosco o vegetazione naturale nel 2018' }],
    source: 'Calcolato da Corine Land Cover 1990 × 2018 (Copernicus/EEA)', hint: 'Grossolano: aree minime di 25 ettari. Indica le zone, non i singoli campi. Visibile da zoom 11.', minZoom: 11 },

  { id: 'geo-litologia', group: 'Suolo e geologia', name: 'Rocce calcaree e marnose', region: null, opacity: 0.55,
    legendItems: [{ color: '#2f7de1', label: 'Calcari e dolomie' }, { color: '#9b59d0', label: 'Marne' }],
    source: 'ISPRA – Carta litologica d’Italia 1:100.000', hint: 'Substrati calcarei e marnosi, i preferiti da molti tartufi. Ai bordi tra fogli possono esserci salti netti.' },
  { id: 'soil-ph', group: 'Suolo e geologia', name: 'pH del suolo (0–5 cm)', region: null, opacity: 0.6, legend: true,
    source: 'ISRIC SoilGrids 250 m (CC-BY 4.0)', hint: 'Stima da modello, risoluzione 250 m. Il tartufo bianco e il nero amano suoli sub-alcalini (pH 7–8,5). Può essere lento a caricare.' },
  { id: 'pie-bianco',  group: 'Zone vocate ai tartufi', name: 'Piemonte – bianco',    region: 'Piemonte', opacity: 0.6, legend: true, source: 'Regione Piemonte / IPLA, ed. 2025' },
  { id: 'pie-nero',     group: 'Zone vocate ai tartufi', name: 'Piemonte – nero',      region: 'Piemonte', opacity: 0.6, legend: true, source: 'Regione Piemonte / IPLA, ed. 2025' },
  { id: 'pie-scorzone', group: 'Zone vocate ai tartufi', name: 'Piemonte – scorzone',  region: 'Piemonte', opacity: 0.6, legend: true, source: 'Regione Piemonte / IPLA, ed. 2025' },
  { id: 'lom-vocazione', group: 'Zone vocate ai tartufi', name: 'Lombardia – vocazione', region: 'Lombardia', opacity: 0.6, legend: true, source: 'Regione Lombardia' },
  { id: 'lom-riservate', group: 'Zone vocate ai tartufi', name: 'Lombardia – raccolta riservata', region: 'Lombardia', opacity: 0.8, legend: true, source: 'Regione Lombardia (l.r. 31/2008)' },
  { id: 'ven-magnatum',     group: 'Zone vocate ai tartufi', name: 'Veneto – bianco',        region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
  { id: 'ven-melanosporum', group: 'Zone vocate ai tartufi', name: 'Veneto – nero pregiato', region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
  { id: 'ven-aestivum',     group: 'Zone vocate ai tartufi', name: 'Veneto – scorzone',      region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
  { id: 'ven-uncinatum',    group: 'Zone vocate ai tartufi', name: 'Veneto – uncinato',      region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
  { id: 'ven-borchii',      group: 'Zone vocate ai tartufi', name: 'Veneto – bianchetto',    region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
  { id: 'ven-brumale',      group: 'Zone vocate ai tartufi', name: 'Veneto – nero invernale', region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
  { id: 'ven-moschatum',    group: 'Zone vocate ai tartufi', name: 'Veneto – nero moscato',  region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
  { id: 'ven-macrosporum',  group: 'Zone vocate ai tartufi', name: 'Veneto – nero liscio',   region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
  { id: 'ven-mesentericum', group: 'Zone vocate ai tartufi', name: 'Veneto – nero ordinario', region: 'Veneto', opacity: 0.6, legend: true, source: 'Regione Veneto, DGR 1441/2025' },
];
export const OVERLAY_MIN_ZOOM = 9;
export const OVERLAY_MAX_NATIVE = 18;
export const overlayUrl = id => `ov/${id}/{z}/{x}/{y}`;
// Tessere da scaricare per un overlay: per quelli calcolati servono entrambe le carte di partenza
export const overlaySources = o => (o.intersect ? [o.intersect.past, o.intersect.now] : [o.id]);
export const overlayAsBasemap = id => ({ url: new URL(overlayUrl(id), location.href).href.replace(/%7B/g, '{').replace(/%7D/g, '}'), maxNativeZoom: OVERLAY_MAX_NATIVE, kbPerTile: 30 });

const lon2x =(lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export function tileUrls(basemap, bounds, zMin, zMax) {
  const urls = [];
  const top = Math.min(bounds.getNorth(), 85), bottom = Math.max(bounds.getSouth(), -85);
  for (let z = zMin; z <= Math.min(zMax, basemap.maxNativeZoom); z++) {
    const x0 = lon2x(bounds.getWest(), z), x1 = lon2x(bounds.getEast(), z);
    const y0 = lat2y(top, z), y1 = lat2y(bottom, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(basemap.url.replace('{z}', z).replace('{x}', x).replace('{y}', y));
        if (urls.length > MAX_TILES) return urls; // basta per dire "troppe"
      }
    }
  }
  return urls;
}

export async function downloadTiles(urls, onProgress, signal) {
  const cache = await caches.open(TILE_CACHE);
  const queue = [...urls];
  let done = 0, failed = 0;
  async function worker() {
    while (queue.length && !signal.aborted) {
      const url = queue.shift();
      try {
        if (!(await cache.match(url, { ignoreVary: true }))) {
          const res = await fetch(url, { mode: 'cors', signal });
          if (res.ok) await cache.put(url, res);
          else failed++;
        }
      } catch {
        if (!signal.aborted) failed++;
      }
      done++;
      onProgress(done, failed, urls.length);
    }
  }
  // poche richieste in parallelo per non sovraccaricare i server delle mappe
  await Promise.all([worker(), worker(), worker()]);
  return { done, failed };
}

export async function cachedTileCount() {
  if (!('caches' in window)) return 0;
  const cache = await caches.open(TILE_CACHE);
  return (await cache.keys()).length;
}

export const clearTiles = () => caches.delete(TILE_CACHE);
