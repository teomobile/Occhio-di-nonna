// Server minimo (nessuna dipendenza): serve la webapp e riceve la sincronizzazione dei punti.
// Avvio:  node server.js        Variabili: PORT (default 8080), SYNC_TOKEN (facoltativo)
import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OVERLAY_SOURCES, upstreamTileUrl, legendUrl, arcgisLegendItems } from './public/ovsources.js';

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
async function fetchUpstream(url) {
  // timeout largo: SoilGrids può impiegare 15-20 secondi per una tessera
  const r = await fetch(url, { signal: AbortSignal.timeout(40000), headers: { 'User-Agent': 'OcchioDiNonna/0.1' } });
  return { ok: r.ok, type: r.headers.get('content-type') || '', body: Buffer.from(await r.arrayBuffer()) };
}

async function handleOverlay(req, res, url) {
  const m = url.pathname.match(/^\/ov\/([\w-]+)\/(?:(\d+)\/(\d+)\/(\d+)|legend)$/);
  const o = m && OVERLAY_SOURCES[m[1]];
  if (!o) { res.writeHead(404); return res.end(); }

  if (!m[2]) { // legenda
    const up = await fetchUpstream(legendUrl(o));
    if (o.type === 'wms') {
      if (!up.ok || !up.type.startsWith('image/')) return json(res, 502, { error: 'legenda non disponibile' });
      return json(res, 200, [{ label: '', img: `data:${up.type};base64,${up.body.toString('base64')}` }]);
    }
    return json(res, 200, arcgisLegendItems(o, JSON.parse(up.body.toString('utf8'))));
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
