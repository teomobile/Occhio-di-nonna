// App Android (Capacitor): non c'è il server, quindi l'app fa da sé quello che fa server.js.
// - strati /ov/...: chiamati direttamente sui geoportali con l'HTTP nativo (niente limiti CORS)
// - tessere: lette e salvate nella cache dal codice della pagina (il service worker non serve)
// - file da esportare: salvati e passati al menu "Condividi" di Android
import { OVERLAY_SOURCES, upstreamTileUrl, legendUrl, arcgisLegendItems } from './ovsources.js';
import { TILE_CACHE } from './offline.js';

const cap = window.Capacitor;
export const isNative = !!cap?.isNativePlatform?.();

const call = (plugin, method, opts) => (cap.Plugins?.[plugin]?.[method]
  ? cap.Plugins[plugin][method](opts)
  : cap.nativePromise(plugin, method, opts));

const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const header = (h, name) => Object.entries(h || {}).find(([k]) => k.toLowerCase() === name)?.[1] || '';

async function nativeGet(url, responseType = 'blob') {
  const r = await call('CapacitorHttp', 'request', {
    url, method: 'GET', responseType, headers: { 'User-Agent': 'OcchioDiNonna/0.1' },
    connectTimeout: 15000, readTimeout: 40000, // SoilGrids può impiegare 15-20 secondi
  });
  return { status: r.status, type: header(r.headers, 'content-type'), data: r.data };
}

async function ovResponse(pathname) {
  const m = pathname.match(/\/ov\/([\w-]+)\/(?:(\d+)\/(\d+)\/(\d+)|legend)$/);
  const o = m && OVERLAY_SOURCES[m[1]];
  if (!o) return new Response('', { status: 404 });
  if (!m[2]) { // legenda
    if (o.type === 'wms') {
      const up = await nativeGet(legendUrl(o));
      if (up.status !== 200 || !up.type.startsWith('image/')) return new Response('[]', { status: 502 });
      return Response.json([{ label: '', img: `data:${up.type};base64,${up.data}` }]);
    }
    const up = await nativeGet(legendUrl(o), 'json');
    const data = typeof up.data === 'string' ? JSON.parse(up.data) : up.data;
    return Response.json(arcgisLegendItems(o, data));
  }
  const url = upstreamTileUrl(o, +m[2], +m[3], +m[4]);
  let up = await nativeGet(url).catch(() => null);
  if (!up || up.status !== 200 || !up.type.startsWith('image/')) up = await nativeGet(url).catch(() => null); // secondo tentativo
  if (!up || up.status !== 200 || !up.type.startsWith('image/')) return new Response('', { status: 502 });
  return new Response(b64ToBytes(up.data), { status: 200, headers: { 'Content-Type': up.type } });
}

const isOv = u => u.origin === location.origin && u.pathname.startsWith('/ov/');

// fetch('ov/...') (download offline, legende) va ai geoportali invece che al server
if (isNative) {
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    return isOv(u) ? ovResponse(u.pathname) : origFetch(input, init);
  };
}

// Una tessera: prima la cache (zone scaricate o già viste), poi la rete salvando il risultato
export async function tileBlob(url) {
  const abs = new URL(url, location.href).href;
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(abs, { ignoreVary: true });
  if (hit) return hit.blob();
  let res;
  try { res = await fetch(abs, { mode: 'cors' }); }
  catch { // server di mappe senza CORS: via HTTP nativo
    const up = await nativeGet(abs);
    res = new Response(b64ToBytes(up.data), { status: up.status, headers: { 'Content-Type': up.type } });
  }
  if (!res.ok) throw new Error(`tessera ${res.status}`);
  cache.put(abs, res.clone()).catch(() => {});
  return res.blob();
}

// Tessere caricate da tileBlob (al posto di <img src>, che nell'app Android non passa dal service worker)
export function nativeTileLayerClass(L) {
  return L.TileLayer.extend({
    createTile(coords, done) {
      const img = document.createElement('img');
      img.alt = '';
      img.setAttribute('role', 'presentation');
      tileBlob(this.getTileUrl(coords)).then(blob => {
        img.onload = () => { URL.revokeObjectURL(img.src); done(null, img); };
        img.onerror = () => done(new Error('tessera non leggibile'), img);
        img.src = URL.createObjectURL(blob);
      }).catch(err => done(err, img));
      return img;
    },
  });
}

// Esporta un file: salvato nella cache dell'app e aperto nel menu Condividi (Drive, email, WhatsApp…)
export async function shareFile(name, content, type) {
  const { uri } = await call('Filesystem', 'writeFile', { path: name, data: content, directory: 'CACHE', encoding: 'utf8' });
  await call('Share', 'share', { title: name, files: [uri], dialogTitle: 'Salva o invia il file' }).catch(e => {
    if (!/cancel/i.test(String(e?.message || e))) throw e;
  });
}
