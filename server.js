// Server minimo (nessuna dipendenza): serve la webapp e riceve la sincronizzazione dei punti.
// Avvio:  node server.js        Variabili: PORT (default 8080), SYNC_TOKEN (facoltativo)
import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.SYNC_TOKEN || '';
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'finds.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.geojson': 'application/geo+json',
};

/* ---------- Archivio (file JSON) ---------- */
const store = new Map();
let clock = 0; // contatore modifiche: il client chiede "tutto ciò che è cambiato dopo X"

async function load() {
  try {
    for (const r of JSON.parse(await readFile(DATA_FILE, 'utf8'))) {
      store.set(r.id, r);
      clock = Math.max(clock, r._srv || 0);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

let saving = Promise.resolve();
function persist() {
  saving = saving.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify([...store.values()]));
    await rename(tmp, DATA_FILE);
  });
  return saving;
}

const validId = id => typeof id === 'string' && /^[\w-]{1,64}$/.test(id);
const num = v => (v == null || v === '' ? null : Number.isFinite(+v) ? +v : null);
function clean(r) {
  return {
    id: r.id,
    lat: +r.lat,
    lng: +r.lng,
    accuracy: num(r.accuracy),
    type: String(r.type || 'altro').slice(0, 40),
    weight: num(r.weight),
    dog: String(r.dog || '').slice(0, 80),
    notes: String(r.notes || '').slice(0, 5000),
    photo: typeof r.photo === 'string' && r.photo.startsWith('data:image/') ? r.photo : null,
    createdAt: String(r.createdAt || ''),
    updatedAt: String(r.updatedAt || ''),
    deleted: !!r.deleted,
  };
}
const publicRec = ({ _srv, ...r }) => r;

/* ---------- HTTP ---------- */
function readBody(req, limit = 40e6) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload troppo grande'), { status: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS });
  res.end(JSON.stringify(body));
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { error: 'unauthorized' });

  if (req.method === 'POST' && url.pathname === '/api/sync') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) { return json(res, e.status || 400, { error: e.message }); }
    const since = Number(body.since) || 0;
    let changed = false;
    for (const raw of Array.isArray(body.changes) ? body.changes : []) {
      if (!validId(raw?.id)) continue;
      const r = clean(raw);
      if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
      const cur = store.get(r.id);
      if (!cur || r.updatedAt >= cur.updatedAt) {
        r._srv = ++clock;
        store.set(r.id, r);
        changed = true;
      }
    }
    if (changed) await persist();
    const changes = [...store.values()].filter(r => r._srv > since).map(publicRec);
    return json(res, 200, { changes, cursor: clock });
  }

  if (req.method === 'GET' && url.pathname === '/api/finds') {
    return json(res, 200, [...store.values()].filter(r => !r.deleted).map(publicRec));
  }
  return json(res, 404, { error: 'not found' });
}

/* ---------- Strati dai geoportali (proxy con elenco chiuso di sorgenti) ---------- */
const TOSCANA_OFC = 'https://www502.regione.toscana.it/wmsraster/com.rt.wms.RTmap/wms?map=wmsofc';
const TOSCANA_UCS = 'https://www502.regione.toscana.it/wmsraster/com.rt.wms.RTmap/wms?map=wmsucs';
const LOMB ='https://www.cartografia.servizirl.it/arcgis2/rest/services';
const PIEMONTE = 'https://geoservices.csi.it/ms/wms/idf/rp-01/idfwms/wms_vocazione_tartufigena_2025';
const VENETO = 'https://idt2-geoserver.regione.veneto.it/geoserver/ows';
const venetoLayer = sp => ({ type: 'wms', url: VENETO, layers: `rv:${sp}_vocazionalita`, format: 'image/png' });
const LOMB_OPEN = 'https://www.cartografia.servizirl.it/arcgis/rest/services/opendata';
const CORINE = 'https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine';
const ISPRA_LITO = 'https://sgi2.isprambiente.it/geoserver/ge-core8/wms';
const SOILGRIDS_PH = 'https://maps.isric.org/mapserv?map=/map/phh2o.map';

// Stile per la carta litologica ISPRA: blu = calcari e dolomie, viola = marne (il resto trasparente)
const like = (prop, text) => `<ogc:PropertyIsLike wildCard="*" singleChar="." escape="!"><ogc:PropertyName>${prop}</ogc:PropertyName><ogc:Literal>*${text}*</ogc:Literal></ogc:PropertyIsLike>`;
const fillRule = (filter, color) => `<Rule><ogc:Filter>${filter}</ogc:Filter><PolygonSymbolizer><Fill><CssParameter name="fill">${color}</CssParameter></Fill></PolygonSymbolizer></Rule>`;
const LITO_SLD = '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">'
  + '<NamedLayer><Name>litologia100k</Name><UserStyle><FeatureTypeStyle>'
  + fillRule(`<ogc:Or>${like('litologia', 'calcar')}${like('litologia', 'dolom')}</ogc:Or>`, '#2f7de1')
  + fillRule(like('nome_ulf', 'marn'), '#9b59d0')
  + '</FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';

const OVERLAYS = {
  'tos-1954': { type: 'wms', url: TOSCANA_OFC, layers: 'rt_ofc.10k54', format: 'image/png' },
  // boschi del 2019 colorati secondo l'uso del suolo nel 1954 (arancione = era agricolo)
  'tos-boschi-ex-campi': { type: 'wms', url: TOSCANA_UCS, layers: 'rt_ucs.iducs.10k.2019-1954.rt', format: 'image/png' },
  'lom-1954': { type: 'arcgis', url: `${LOMB}/BaseMap/Lombardia_GAI_UTM32N/MapServer`, format: 'png32' },
  'pie-bianco': { type: 'wms', url: PIEMONTE, layers: 'tartufoTB', format: 'image/png' },
  'pie-nero': { type: 'wms', url: PIEMONTE, layers: 'tartufoTN', format: 'image/png' },
  'pie-scorzone': { type: 'wms', url: PIEMONTE, layers: 'tartufoS', format: 'image/png' },
  'lom-vocazione': { type: 'arcgis', url: `${LOMB}/agricoltura/agr_tartufi/MapServer`, format: 'png32' },
  'lom-riservate': { type: 'arcgis', url: `${LOMB}/agricoltura/aree_funghi_tartufi/MapServer`, format: 'png32', show: '1,2' },
  ...Object.fromEntries(['magnatum', 'melanosporum', 'aestivum', 'uncinatum', 'borchii', 'brumale', 'moschatum', 'macrosporum', 'mesentericum']
    .map(sp => [`ven-${sp}`, venetoLayer(sp)])),

  // Sorgenti per i "vecchi campi" calcolati nell'app (incrocio di due carte, vedi IntersectLayer in app.js)
  'lom-agri1980': { type: 'arcgis', url: `${LOMB_OPEN}/suolo1980/MapServer`, format: 'png32', show: '2', defs: { 2: "CODICE LIKE '2%'" } },
  'lom-dusaf2015': { type: 'arcgis', url: `${LOMB}/BaseMap/DUSAF2015/MapServer`, format: 'png32' }, // non accetta filtri: i boschi si riconoscono dal colore
  'corine-agri1990': { type: 'arcgis', url: `${CORINE}/CLC1990_WM/MapServer`, format: 'png32', show: '0', defs: { 0: "code_90 LIKE '2%'" } },
  'corine-bosco2018': { type: 'arcgis', url: `${CORINE}/CLC2018_WM/MapServer`, format: 'png32', show: '0', defs: { 0: "Code_18 LIKE '31%' OR Code_18 LIKE '32%'" } },

  // Suolo e geologia
  'geo-litologia': { type: 'wms', url: ISPRA_LITO, layers: 'litologia100k', format: 'image/png', sld: LITO_SLD },
  'soil-ph': { type: 'wms', url: SOILGRIDS_PH, layers: 'phh2o_0-5cm_mean', format: 'image/png' },
};

const E = 20037508.342789244;
function tileBbox(z, x, y) {
  const size = (2 * E) / 2 ** z;
  const minx = -E + x * size, maxy = E - y * size;
  return [minx, maxy - size, minx + size, maxy].map(v => v.toFixed(2)).join(',');
}

function upstreamTileUrl(o, z, x, y) {
  const bbox = tileBbox(z, x, y);
  if (o.type === 'arcgis') {
    const p = new URLSearchParams({ bbox, bboxSR: '3857', imageSR: '3857', size: '256,256', format: o.format, transparent: 'true', f: 'image' });
    if (o.show) p.set('layers', `show:${o.show}`);
    if (o.defs) p.set('layerDefs', JSON.stringify(o.defs));
    return `${o.url}/export?${p}`;
  }
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap', LAYERS: o.layers, STYLES: '', SRS: 'EPSG:3857',
    BBOX: bbox, WIDTH: '256', HEIGHT: '256', FORMAT: o.format, TRANSPARENT: o.format === 'image/png' ? 'TRUE' : 'FALSE',
  });
  if (o.sld) p.set('SLD_BODY', o.sld);
  return `${o.url}${o.url.includes('?') ? '&' : '?'}${p}`;
}

async function fetchUpstream(url) {
  // timeout largo: SoilGrids può impiegare 15-20 secondi per una tessera
  const r = await fetch(url, { signal: AbortSignal.timeout(40000), headers: { 'User-Agent': 'OcchioDiNonna/0.1' } });
  return { ok: r.ok, type: r.headers.get('content-type') || '', body: Buffer.from(await r.arrayBuffer()) };
}

async function handleOverlay(req, res, url) {
  const m = url.pathname.match(/^\/ov\/([\w-]+)\/(?:(\d+)\/(\d+)\/(\d+)|legend)$/);
  const o = m && OVERLAYS[m[1]];
  if (!o) { res.writeHead(404); return res.end(); }

  if (!m[2]) { // legenda
    if (o.type === 'wms') {
      const u = `${o.url}${o.url.includes('?') ? '&' : '?'}SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${encodeURIComponent(o.layers.split(',')[0])}`;
      const up = await fetchUpstream(u);
      if (!up.ok || !up.type.startsWith('image/')) return json(res, 502, { error: 'legenda non disponibile' });
      return json(res, 200, [{ label: '', img: `data:${up.type};base64,${up.body.toString('base64')}` }]);
    }
    const up = await fetchUpstream(`${o.url}/legend?f=json`);
    const data = JSON.parse(up.body.toString('utf8'));
    const shown = o.show ? o.show.split(',').map(Number) : null;
    const items = (data.layers || [])
      .filter(l => !shown || shown.includes(l.layerId))
      .flatMap(l => l.legend.map(g => ({ label: g.label || l.layerName, img: `data:${g.contentType};base64,${g.imageData}` })));
    return json(res, 200, items);
  }

  const [z, x, y] = [m[2], m[3], m[4]].map(Number);
  if (z < 5 || z > 19 || x >= 2 ** z || y >= 2 ** z) { res.writeHead(400); return res.end(); }
  const tileUrl = upstreamTileUrl(o, z, x, y);
  let up = await fetchUpstream(tileUrl);
  if (!up.ok || !up.type.startsWith('image/')) up = await fetchUpstream(tileUrl); // alcuni geoportali falliscono a caso: un secondo tentativo
  if (!up.ok || !up.type.startsWith('image/')) { res.writeHead(502); return res.end(); } // il geoportale ha risposto con un errore
  res.writeHead(200, { 'Content-Type': up.type, 'Cache-Control': 'public, max-age=2592000', 'Access-Control-Allow-Origin': '*' });
  res.end(up.body);
}

async function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(PUBLIC, path.normalize(p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Non trovato');
  }
}

await load();
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else if (url.pathname.startsWith('/ov/')) await handleOverlay(req, res, url).catch(e => {
      console.warn('strato non disponibile:', url.pathname, e.message);
      if (!res.headersSent) { res.writeHead(504); res.end(); }
    });
    else await serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'errore interno' });
  }
}).listen(PORT, () => {
  console.log(`Occhio di nonna in ascolto su http://localhost:${PORT}${TOKEN ? ' (token attivo)' : ''}`);
});
