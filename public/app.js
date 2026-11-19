import { db } from './db.js';
import { syncNow, onSyncStatus, getSyncConfig, setSyncConfig, refreshStatus } from './sync.js';
import { TYPES, DARK_TYPES, CALENDARS, typeById, inSeason, seasonLabel, monthActive, MONTH_INITIALS, calendarKey, zoneLabel, periodsFor } from './seasons.js';
import { BASEMAPS, OVERLAYS, OVERLAY_MIN_ZOOM, OVERLAY_MAX_NATIVE, overlayUrl, overlayAsBasemap, MAX_TILES, tileUrls, downloadTiles, cachedTileCount, clearTiles } from './offline.js';
import { loadZones, zoneAt } from './zones.js';

/* ================= Utilità ================= */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const fmtDateTime = iso => new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = iso => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDist = m => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);
const fmtWeight = g => (g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`);
const pref = {
  get(k, d) { try { const v = localStorage.getItem(`tartufi.${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`tartufi.${k}`, JSON.stringify(v)); } catch { /* storage non disponibile */ } },
};

const R = 6371000;
const rad = d => (d * Math.PI) / 180;
function distance(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const ICONS = {
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>',
  menu: '<path d="M12 3v11m0 0-4-4m4 4 4-4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
$('#btnLayers').innerHTML = icon('layers');
$('#btnLocate').innerHTML = icon('locate');
$('#btnMenu').innerHTML = icon('menu');

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ================= Stato ================= */
const state = {
  finds: [],          // visibili (non eliminati)
  me: null,           // { lat, lng, acc, heading, speed, time }
  compass: null,      // direzione del telefono in gradi
  navTarget: null,
  listFilter: 'all',
  listQuery: '',
  zone: null,         // { region, province } della zona che stai guardando / dove sei
};

/* ================= Zona e calendario ================= */
// Calendario da usare: scelto a mano nel calendario, altrimenti quello della zona riconosciuta.
function seasonCtx(zone = state.zone) {
  const override = pref.get('calendar', null);
  if (override && CALENDARS[override]) return { key: override, province: null, label: CALENDARS[override].name, manual: true };
  return { key: calendarKey(zone), province: zone?.province || null, label: zoneLabel(zone), manual: false };
}
const ctxAt = (lat, lng) => seasonCtx(zoneAt(lat, lng));
const typeInSeason = (typeId, ctx) => inSeason(typeId, ctx.key, ctx.province);

/* ================= Mappa ================= */
const savedView = pref.get('view', null);
const map = L.map('map', { zoomControl: false, maxZoom: 20 })
  .setView(savedView ? [savedView.lat, savedView.lng] : [43.3, 11.8], savedView ? savedView.z : 6);
map.on('moveend', () => {
  const c = map.getCenter();
  pref.set('view', { lat: c.lat, lng: c.lng, z: map.getZoom() });
});

let currentLayerId = pref.get('layer', 'sat');
if (!BASEMAPS[currentLayerId]) currentLayerId = 'sat';
const baseLayers = {};
for (const [id, b] of Object.entries(BASEMAPS)) {
  baseLayers[id] = L.tileLayer(b.url, { maxZoom: 20, maxNativeZoom: b.maxNativeZoom, attribution: b.attribution, crossOrigin: true });
}
baseLayers[currentLayerId].addTo(map);

function setLayer(id) {
  map.removeLayer(baseLayers[currentLayerId]);
  currentLayerId = id;
  baseLayers[id].addTo(map);
  pref.set('layer', id);
}

/* ----- Strati: foto aeree storiche e zone vocate ----- */
// Pannelli Leaflet: foto storiche sopra la mappa di base, carte tematiche sopra le foto.
map.createPane('photoPane').style.zIndex = 250;
map.createPane('zonePane').style.zIndex = 300;
const isPhoto = o => o.group.startsWith('Foto');
const overlayLayers = {};
const compare = { on: false, x: 0.5, el: null }; // stato del confronto a tendina
let activeOverlays = pref.get('overlays', []).filter(id => OVERLAYS.some(o => o.id === id));
const overlayOpacity = () => pref.get('overlayOpacity', null);

function overlayLayer(o) {
  if (!overlayLayers[o.id]) {
    overlayLayers[o.id] = L.tileLayer(overlayUrl(o.id), {
      minZoom: OVERLAY_MIN_ZOOM, maxZoom: 20, maxNativeZoom: OVERLAY_MAX_NATIVE,
      opacity: overlayOpacity() ?? o.opacity, attribution: o.source,
      pane: isPhoto(o) ? 'photoPane' : 'zonePane',
    });
  }
  return overlayLayers[o.id];
}
function setOverlay(id, on) {
  const o = OVERLAYS.find(x => x.id === id);
  if (on) {
    overlayLayer(o).addTo(map);
    if (compare.on && isPhoto(o)) overlayLayers[id].setOpacity(1);
    if (!activeOverlays.includes(id)) activeOverlays.push(id);
  }
  else { if (overlayLayers[id]) map.removeLayer(overlayLayers[id]); activeOverlays = activeOverlays.filter(x => x !== id); }
  pref.set('overlays', activeOverlays);
  $('#btnLayers').classList.toggle('active', activeOverlays.length > 0);
}
activeOverlays.forEach(id => setOverlay(id, true));

const GROUP_HINTS = {
  'Foto aeree storiche': 'Confronta con il satellite di oggi: i boschi nati su vecchi campi e pascoli si riconoscono bene.',
  'Vecchi campi': 'Il confronto già fatto dalla Regione sulle carte dell’uso del suolo: dove oggi c’è bosco ma un tempo si coltivava.',
  'Zone vocate ai tartufi': 'Carte ufficiali delle Regioni sulla vocazione dei terreni. Indicano dove è probabile trovare tartufi, non dove ci sono.',
};

/* ----- Confronto a tendina: foto storiche a sinistra, mappa di oggi a destra ----- */

function photoOverlayForZone() {
  const r = state.zone && zoneLabel(state.zone);
  return OVERLAYS.find(o => isPhoto(o) && o.region === r) || OVERLAYS.find(o => o.id === 'it-1988');
}
function setCompare(on) {
  compare.on = on;
  if (on) {
    if (!OVERLAYS.some(o => isPhoto(o) && activeOverlays.includes(o.id))) setOverlay(photoOverlayForZone().id, true);
    if (!compare.el) buildDivider();
    compare.el.hidden = false;
    OVERLAYS.filter(isPhoto).forEach(o => overlayLayers[o.id]?.setOpacity(1)); // nel confronto le foto sono piene
    updateClip();
  } else {
    if (compare.el) compare.el.hidden = true;
    map.getPane('photoPane').style.clip = '';
    OVERLAYS.filter(isPhoto).forEach(o => overlayLayers[o.id]?.setOpacity(overlayOpacity() ?? o.opacity));
  }
}
function updateClip() {
  if (!compare.on) return;
  const size = map.getSize();
  const nw = map.containerPointToLayerPoint([0, 0]);
  const se = map.containerPointToLayerPoint(size);
  const cut = nw.x + size.x * compare.x;
  map.getPane('photoPane').style.clip = `rect(${nw.y}px, ${cut}px, ${se.y}px, ${nw.x}px)`;
  compare.el.style.left = `${compare.x * 100}%`;
}
map.on('move zoom zoomend resize', updateClip);

function buildDivider() {
  const el = document.createElement('div');
  el.className = 'compare-divider';
  el.innerHTML = `<span class="compare-label left">Storico</span><span class="compare-label right">Oggi</span>
    <button type="button" class="compare-handle" aria-label="Trascina per confrontare">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6-6 6 6 6M15 6l6 6-6 6"/></svg>
    </button>
    <button type="button" class="compare-close" aria-label="Chiudi il confronto">${icon('close')}</button>`;
  map.getContainer().appendChild(el);
  L.DomEvent.disableClickPropagation(el);
  const handle = el.querySelector('.compare-handle');
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = map.getContainer().getBoundingClientRect();
      compare.x = Math.min(0.97, Math.max(0.03, (ev.clientX - r.left) / r.width));
      updateClip();
    };
    const up = () => ['pointermove', 'pointerup', 'pointercancel'].forEach((t, i) => handle.removeEventListener(t, i ? up : move));
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
  el.querySelector('.compare-close').addEventListener('click', () => setCompare(false));
  compare.el = el;
}

async function legendHtml(id) {
  try {
    const items = await fetch(`ov/${id}/legend`).then(r => (r.ok ? r.json() : []));
    return items.map(i => `<div class="legend-row"><img src="${i.img}" alt="">${i.label ? `<span>${esc(i.label)}</span>` : ''}</div>`).join('');
  } catch { return ''; }
}

function openLayers() {
  const regionOf = state.zone && zoneLabel(state.zone);
  const groups = [...new Set(OVERLAYS.map(o => o.group))];
  const op = overlayOpacity();
  openSheet(`
    <div class="sheet-head"><h2>Mappe e strati</h2>${closeBtn}</div>
    <h3>Mappa di base</h3>
    <div class="filters" id="lyBase">${Object.entries(BASEMAPS).map(([id, b]) =>
      `<button type="button" data-base="${id}" aria-pressed="${id === currentLayerId}">${b.name}</button>`).join('')}</div>
    ${groups.map(g => `<h3>${g}</h3>
      ${GROUP_HINTS[g] ? `<p class="muted">${GROUP_HINTS[g]}</p>` : ''}
      ${g.startsWith('Foto') ? `<label class="overlay-item compare-toggle"><input type="checkbox" id="lyCompare" ${compare.on ? 'checked' : ''}>
        <span><b>Confronto a tendina</b><br><span class="muted">Trascina la barra: a sinistra la foto storica, a destra il satellite di oggi</span></span></label>` : ''}
      <ul class="overlay-list">${OVERLAYS.filter(o => o.group === g)
        .sort((a, b) => (b.region === regionOf) - (a.region === regionOf))
        .map(o => `<li>
          <label class="overlay-item"><input type="checkbox" data-ov="${o.id}" ${activeOverlays.includes(o.id) ? 'checked' : ''}>
            <span><b>${esc(o.name)}</b>${o.region && o.region === regionOf ? ' <span class="leaf">● sei qui</span>' : ''}<br><span class="muted">${esc(o.source)}</span>
            ${o.hint ? `<br><span class="muted">${esc(o.hint)}</span>` : ''}</span></label>
          ${o.legend ? `<div class="legend" id="lg-${o.id}" ${activeOverlays.includes(o.id) ? '' : 'hidden'}></div>` : ''}
        </li>`).join('')}</ul>`).join('')}
    <label>Trasparenza strati<input id="lyOpacity" type="range" min="0.2" max="1" step="0.1" value="${op ?? 0.7}"></label>
    <p class="muted">Gli strati si vedono da zoom ${OVERLAY_MIN_ZOOM} in su e servono la rete (o una zona scaricata per l'uso offline). Alcuni geoportali possono essere lenti.</p>`);

  if (map.getZoom() < OVERLAY_MIN_ZOOM && activeOverlays.length) toast('Avvicinati con lo zoom per vedere gli strati');
  const fillLegend = async id => {
    const el = document.getElementById(`lg-${id}`);
    if (el && !el.dataset.done) { el.dataset.done = 1; el.innerHTML = (await legendHtml(id)) || '<span class="muted">Legenda non disponibile</span>'; }
  };
  activeOverlays.forEach(fillLegend);
  $('#lyBase').addEventListener('click', e => {
    const b = e.target.closest('[data-base]');
    if (!b) return;
    setLayer(b.dataset.base);
    $('#lyBase').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
  sheetBody.querySelectorAll('[data-ov]').forEach(cb => cb.addEventListener('change', () => {
    setOverlay(cb.dataset.ov, cb.checked);
    const lg = document.getElementById(`lg-${cb.dataset.ov}`);
    if (lg) { lg.hidden = !cb.checked; if (cb.checked) fillLegend(cb.dataset.ov); }
    if (cb.checked && map.getZoom() < OVERLAY_MIN_ZOOM) toast('Avvicinati con lo zoom per vedere lo strato');
  }));
  $('#lyOpacity').addEventListener('input', e => {
    const v = Number(e.target.value);
    pref.set('overlayOpacity', v);
    OVERLAYS.forEach(o => { if (overlayLayers[o.id] && !(compare.on && isPhoto(o))) overlayLayers[o.id].setOpacity(v); });
  });
  $('#lyCompare').addEventListener('change', e => {
    setCompare(e.target.checked);
    if (e.target.checked) {
      closeSheet();
      if (map.getZoom() < OVERLAY_MIN_ZOOM) toast('Avvicinati con lo zoom per vedere le foto storiche');
      else toast('Trascina la barra per confrontare');
    }
  });
}
$('#btnLayers').addEventListener('click', () => openLayers());

/* ----- Marker dei ritrovamenti ----- */
const markersLayer = L.layerGroup().addTo(map);
function pinIcon(type) {
  const t = typeById(type);
  const dark = DARK_TYPES.includes(t.id);
  return L.divIcon({ className: '', html: `<span class="pin${dark ? ' dark' : ''}" style="--c:${t.color}"></span>`, iconSize: [26, 26], iconAnchor: [13, 30] });
}
function renderMarkers() {
  markersLayer.clearLayers();
  for (const f of state.finds) {
    L.marker([f.lat, f.lng], { icon: pinIcon(f.type), title: typeById(f.type).name })
      .on('click', () => openDetail(f.id))
      .addTo(markersLayer);
  }
  $('#countBadge').textContent = state.finds.length;
}

async function loadFinds() {
  const all = await db.all();
  state.finds = all.filter(f => !f.deleted).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  renderMarkers();
}

/* ----- Tocco sulla mappa: punto temporaneo ----- */
let tempMarker = null;
function clearTemp() { if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; } }
map.on('click', e => {
  clearTemp();
  hideHint();
  const { lat, lng } = e.latlng;
  const box = document.createElement('div');
  box.innerHTML = `<div class="muted" style="margin-bottom:8px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
    <div class="popup-actions"><button class="btn btn-ghost" data-a="no">Annulla</button><button class="btn btn-primary" data-a="ok">Salva punto</button></div>`;
  box.addEventListener('click', ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a;
    if (a === 'ok') openForm({ lat, lng, accuracy: null, source: 'map' });
    if (a) { map.closePopup(); clearTemp(); }
  });
  tempMarker = L.marker(e.latlng, { icon: L.divIcon({ className: '', html: '<span class="pin pin-temp"></span>', iconSize: [26, 26], iconAnchor: [13, 30] }) })
    .addTo(map)
    .bindPopup(box, { closeButton: false, offset: [0, -24] })
    .openPopup();
  tempMarker.on('popupclose', clearTemp);
});

function hideHint() {
  const h = $('#hint');
  h.style.opacity = 0;
  pref.set('hintSeen', true);
  setTimeout(() => { h.hidden = true; }, 400);
}
if (pref.get('hintSeen', false)) $('#hint').hidden = true;

/* ================= GPS ================= */
let meMarker = null, accCircle = null, followMe = false, gpsWatch = null;

function startGps() {
  if (!('geolocation' in navigator) || gpsWatch != null) return;
  gpsWatch = navigator.geolocation.watchPosition(
    p => {
      const c = p.coords;
      state.me = { lat: c.latitude, lng: c.longitude, acc: c.accuracy, heading: c.heading, speed: c.speed, time: p.timestamp };
      const ll = [c.latitude, c.longitude];
      if (!meMarker) {
        meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
        accCircle = L.circle(ll, { radius: c.accuracy, color: '#5aa9e6', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
      } else {
        meMarker.setLatLng(ll);
        accCircle.setLatLng(ll).setRadius(c.accuracy);
      }
      if (followMe) map.panTo(ll);
      updateNav();
      updateZone();
      gpsWaiters.splice(0).forEach(fn => fn(state.me));
    },
    err => {
      if (err.code === err.PERMISSION_DENIED) toast('Permesso posizione negato: puoi comunque toccare la mappa per segnare i punti', 4500);
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 },
  );
}
const gpsWaiters = [];
function waitForFix(maxAgeMs = 20000, timeoutMs = 20000) {
  if (state.me && Date.now() - state.me.time < maxAgeMs) return Promise.resolve(state.me);
  startGps();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    gpsWaiters.push(me => { clearTimeout(t); resolve(me); });
  });
}

$('#btnLocate').addEventListener('click', async () => {
  followMe = !followMe;
  $('#btnLocate').classList.toggle('active', followMe);
  if (!followMe) return;
  try {
    const me = await waitForFix(60000, 15000);
    map.setView([me.lat, me.lng], Math.max(map.getZoom(), 17));
  } catch {
    toast('GPS non disponibile');
    followMe = false;
    $('#btnLocate').classList.remove('active');
  }
});
map.on('dragstart', () => { if (followMe) { followMe = false; $('#btnLocate').classList.remove('active'); } });

$('#btnSaveHere').addEventListener('click', async () => {
  toast('Leggo la posizione GPS…', 20000);
  try {
    const me = await waitForFix(15000, 20000);
    $('#toast').hidden = true;
    map.setView([me.lat, me.lng], Math.max(map.getZoom(), 17));
    openForm({ lat: me.lat, lng: me.lng, accuracy: me.acc, source: 'gps' });
  } catch {
    toast('GPS non disponibile: tocca la mappa nel punto giusto', 4000);
  }
});

/* ================= Bottom sheet ================= */
const sheet = $('#sheet'), sheetBody = $('#sheetBody'), backdrop = $('#sheetBackdrop');
let sheetOpen = false, hideTimer = null;

function openSheet(html) {
  clearTimeout(hideTimer);
  sheetBody.innerHTML = html;
  sheetBody.scrollTop = 0;
  sheet.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
  if (!sheetOpen) { history.pushState({ sheet: true }, ''); sheetOpen = true; }
}
function hideSheet() {
  sheet.classList.remove('open');
  backdrop.hidden = true;
  hideTimer = setTimeout(() => { sheet.hidden = true; sheetBody.innerHTML = ''; }, 230);
}
function closeSheet() {
  if (!sheetOpen) return;
  sheetOpen = false;
  hideSheet();
  if (history.state?.sheet) history.back();
}
window.addEventListener('popstate', () => { if (sheetOpen) { sheetOpen = false; hideSheet(); } });
backdrop.addEventListener('click', closeSheet);
sheetBody.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });

const closeBtn = `<button class="icon-btn" type="button" data-close aria-label="Chiudi">${icon('close')}</button>`;
function accBadge(acc) {
  if (acc == null) return '<span class="acc">punto scelto sulla mappa</span>';
  const cls = acc <= 10 ? 'good' : acc <= 30 ? 'mid' : 'bad';
  return `<span class="acc ${cls}">GPS ±${Math.round(acc)} m</span>`;
}

/* ================= Form ritrovamento ================= */
async function compressImage(file, max = 1280, quality = 0.72) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL('image/jpeg', quality);
}

function defaultType(ctx) {
  const last = pref.get('lastType', null);
  if (last && typeInSeason(last, ctx)) return last;
  return TYPES.find(t => typeInSeason(t.id, ctx))?.id || last || 'magnatum';
}

function nearbyNotice(lat, lng, excludeId) {
  const near = state.finds
    .filter(f => f.id !== excludeId && distance({ lat, lng }, f) <= 30)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!near.length) return '';
  const years = new Set(near.map(f => new Date(f.createdAt).getFullYear()));
  return `<div class="notice">Entro 30 m hai già <b>${near.length}</b> ritrovament${near.length === 1 ? 'o' : 'i'}
    (${[...years].sort().join(', ')}). Ultimo: ${esc(typeById(near[0].type).name)}, ${fmtDay(near[0].createdAt)}.</div>`;
}

function openForm(init, existing = null) {
  const ctx = existing ? ctxAt(existing.lat, existing.lng) : ctxAt(init.lat, init.lng);
  const d = existing ? { ...existing } : {
    lat: init.lat, lng: init.lng, accuracy: init.accuracy, createdAt: new Date().toISOString(),
    type: defaultType(ctx), weight: null, dog: pref.get('lastDog', ''), notes: '', photo: null,
  };
  const dogs = [...new Set(state.finds.map(f => f.dog).filter(Boolean))];
  let photo = d.photo;

  openSheet(`
    <div class="sheet-head"><h2>${existing ? 'Modifica ritrovamento' : 'Nuovo ritrovamento'}</h2>${closeBtn}</div>
    <div class="meta-row">
      <span>${icon('calendar').replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px"')} ${fmtDateTime(d.createdAt)}</span>
      <span id="fCoords">${d.lat.toFixed(6)}, ${d.lng.toFixed(6)}</span>
      <span id="fAcc">${accBadge(d.accuracy)}</span>
    </div>
    ${!existing && init.source === 'gps' ? '<button type="button" class="link" id="fRefresh">Aggiorna posizione GPS</button>' : ''}
    <div id="fNear">${nearbyNotice(d.lat, d.lng, d.id)}</div>
    <form id="findForm" autocomplete="off">
      <div class="field">Tipo di tartufo <span class="muted" style="font-size:12px">● in stagione in ${esc(ctx.label)}</span>
        <div class="type-grid">
          ${TYPES.map(t => `<label class="type-chip"><input type="radio" name="type" value="${t.id}" ${t.id === d.type ? 'checked' : ''}>
            <span><i class="swatch" style="--c:${t.color}"></i>${t.name}${typeInSeason(t.id, ctx) ? ' <i class="leaf" title="In stagione">●</i>' : ''}</span></label>`).join('')}
        </div>
      </div>
      <div class="row2">
        <label>Peso (g)<input name="weight" type="number" inputmode="decimal" min="0" step="1" placeholder="facoltativo" value="${d.weight ?? ''}"></label>
        <label>Cane<input name="dog" type="text" list="dogList" placeholder="facoltativo" value="${esc(d.dog)}"></label>
      </div>
      <datalist id="dogList">${dogs.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <label>Note<textarea name="notes" rows="3" placeholder="Facoltative: es. sotto la quercia grande, terreno calcareo, vicino al fosso…">${esc(d.notes)}</textarea></label>
      <div class="photo-row">
        <label class="btn btn-ghost" style="margin:0">Foto<input id="fPhoto" type="file" accept="image/*" capture="environment" hidden></label>
        <img id="fPhotoPrev" class="photo-prev" alt="Anteprima foto" ${photo ? `src="${photo}"` : 'hidden'}>
        <button type="button" class="link" id="fPhotoDel" ${photo ? '' : 'hidden'}>Rimuovi</button>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-ghost" data-close>Annulla</button>
        <button type="submit" class="btn btn-primary">Salva</button>
      </div>
    </form>`);

  $('#fRefresh')?.addEventListener('click', async () => {
    try {
      const me = await waitForFix(3000, 15000);
      Object.assign(d, { lat: me.lat, lng: me.lng, accuracy: me.acc });
      $('#fCoords').textContent = `${me.lat.toFixed(6)}, ${me.lng.toFixed(6)}`;
      $('#fAcc').innerHTML = accBadge(me.acc);
      $('#fNear').innerHTML = nearbyNotice(me.lat, me.lng);
    } catch { toast('GPS non disponibile'); }
  });
  $('#fPhoto').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      photo = await compressImage(file);
      $('#fPhotoPrev').src = photo;
      $('#fPhotoPrev').hidden = false;
      $('#fPhotoDel').hidden = false;
    } catch { toast('Impossibile leggere la foto'); }
  });
  $('#fPhotoDel').addEventListener('click', () => {
    photo = null;
    $('#fPhotoPrev').hidden = true;
    $('#fPhotoDel').hidden = true;
  });

  $('#findForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const now = new Date().toISOString();
    const weight = fd.get('weight') === '' ? null : Math.max(0, Number(fd.get('weight')));
    const rec = {
      ...(existing || { id: uid(), createdAt: d.createdAt, deleted: false, onServer: false }),
      lat: d.lat, lng: d.lng, accuracy: d.accuracy,
      type: fd.get('type') || 'altro',
      weight: Number.isFinite(weight) ? weight : null,
      dog: String(fd.get('dog') || '').trim(),
      notes: String(fd.get('notes') || '').trim(),
      photo,
      updatedAt: now,
      synced: false,
    };
    await db.put(rec);
    pref.set('lastType', rec.type);
    if (rec.dog) pref.set('lastDog', rec.dog);
    closeSheet();
    clearTemp();
    await loadFinds();
    toast(existing ? 'Modifiche salvate' : 'Punto salvato nei preferiti');
    afterLocalChange();
  });
}

/* ================= Dettaglio ================= */
function openDetail(id) {
  const f = state.finds.find(x => x.id === id);
  if (!f) return;
  const t = typeById(f.type);
  const dist = state.me ? fmtDist(distance(state.me, f)) : null;
  openSheet(`
    <div class="sheet-head"><h2><i class="swatch" style="--c:${t.color};display:inline-block;margin-right:6px"></i>${esc(t.name)}</h2>${closeBtn}</div>
    <div class="meta-row"><span>${fmtDateTime(f.createdAt)}</span>${dist ? `<span>a ${dist} da te</span>` : ''}${f.synced ? '' : '<span class="unsynced">● da sincronizzare</span>'}</div>
    ${f.photo ? `<img class="detail-photo" src="${f.photo}" alt="Foto del ritrovamento">` : ''}
    <dl class="kv">
      <dt>Coordinate</dt><dd><button class="link" id="dCopy" type="button">${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}</button> ${f.accuracy != null ? `<span class="muted">±${Math.round(f.accuracy)} m</span>` : ''}</dd>
      ${f.weight != null ? `<dt>Peso</dt><dd>${fmtWeight(f.weight)}</dd>` : ''}
      ${f.dog ? `<dt>Cane</dt><dd>${esc(f.dog)}</dd>` : ''}
      ${t.latin ? `<dt>Specie</dt><dd><i>${esc(t.latin)}</i></dd>` : ''}
    </dl>
    ${f.notes ? `<div class="notes">${esc(f.notes)}</div>` : ''}
    <div class="btn-row">
      <button class="btn btn-primary" id="dGo" type="button">Portami qui</button>
      <a class="btn btn-ghost" href="geo:${f.lat},${f.lng}?q=${f.lat},${f.lng}">Apri in Maps</a>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="dEdit" type="button">Modifica</button>
      <button class="btn btn-danger" id="dDel" type="button">Elimina</button>
    </div>`);
  // centra il punto nella parte di mappa visibile sopra il pannello
  map.panTo(map.unproject(map.project([f.lat, f.lng]).add([0, map.getSize().y * 0.25])));
  $('#dGo').addEventListener('click', () => { closeSheet(); startNav(f); });
  $('#dEdit').addEventListener('click', () => openForm(null, f));
  $('#dCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}`); toast('Coordinate copiate'); } catch { /* ignora */ }
  });
  $('#dDel').addEventListener('click', async () => {
    if (!confirm('Eliminare questo punto?')) return;
    if (f.onServer) await db.put({ ...f, deleted: true, photo: null, synced: false, updatedAt: new Date().toISOString() });
    else await db.deleteMany([f.id]);
    if (state.navTarget?.id === f.id) stopNav();
    closeSheet();
    await loadFinds();
    toast('Punto eliminato');
    afterLocalChange();
  });
}

/* ================= Elenco preferiti ================= */
function openList() {
  openSheet(`
    <div class="sheet-head"><h2>I miei punti</h2>${closeBtn}</div>
    <div id="lStats"></div>
    <input id="lSearch" type="search" placeholder="Cerca nelle note, cane, tipo…" value="${esc(state.listQuery)}">
    <div class="filters" id="lFilters"></div>
    <ul class="find-list" id="lItems"></ul>`);
  $('#lSearch').addEventListener('input', e => { state.listQuery = e.target.value; renderList(); });
  $('#lFilters').addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (b) { state.listFilter = b.dataset.f; renderList(); }
  });
  $('#lItems').addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if (b) openDetail(b.dataset.id);
  });
  renderList();
}

function renderList() {
  const yearAgo = Date.now() - 365 * 864e5;
  const recent = state.finds.filter(f => new Date(f.createdAt).getTime() >= yearAgo);
  const grams = recent.reduce((s, f) => s + (f.weight || 0), 0);
  const spots = state.finds.length;
  $('#lStats').innerHTML = `<div class="stats">
      <div class="stat"><b>${spots}</b><span>punti salvati</span></div>
      <div class="stat"><b>${recent.length}</b><span>ultimi 12 mesi</span></div>
      <div class="stat"><b>${grams ? fmtWeight(grams) : '—'}</b><span>raccolto 12 mesi</span></div>
    </div>`;

  const present = TYPES.filter(t => state.finds.some(f => f.type === t.id));
  if (state.listFilter !== 'all' && !present.some(t => t.id === state.listFilter)) state.listFilter = 'all';
  $('#lFilters').innerHTML = `<button type="button" data-f="all" aria-pressed="${state.listFilter === 'all'}">Tutti</button>` +
    present.map(t => `<button type="button" data-f="${t.id}" aria-pressed="${state.listFilter === t.id}"><i class="swatch" style="--c:${t.color}"></i>${t.name}</button>`).join('');

  const q = state.listQuery.trim().toLowerCase();
  const items = state.finds.filter(f => {
    if (state.listFilter !== 'all' && f.type !== state.listFilter) return false;
    if (!q) return true;
    return [f.notes, f.dog, typeById(f.type).name].join(' ').toLowerCase().includes(q);
  });

  $('#lItems').innerHTML = items.length ? items.map(f => {
    const t = typeById(f.type);
    const sub = [f.weight != null ? fmtWeight(f.weight) : '', f.dog, f.notes].filter(Boolean).join(' · ');
    return `<li><button class="find-item" type="button" data-id="${f.id}">
      <i class="swatch" style="--c:${t.color}"></i>
      <span><span class="t">${esc(t.name)}</span>${f.synced ? '' : ' <span class="unsynced">●</span>'}<br><span class="s">${esc(sub) || '<span class="muted">nessuna nota</span>'}</span></span>
      <span class="d">${fmtDay(f.createdAt)}${state.me ? `<br>${fmtDist(distance(state.me, f))}` : ''}</span>
    </button></li>`;
  }).join('') : `<li class="empty">${state.finds.length ? 'Nessun punto con questi filtri.' : 'Nessun punto salvato.<br>Usa “Salva qui” o tocca la mappa.'}</li>`;
}
$('#btnList').addEventListener('click', openList);

/* ================= Calendario ================= */
function renderSeasonChip() {
  const ctx = seasonCtx();
  const now = TYPES.filter(t => typeInSeason(t.id, ctx));
  $('#seasonChip').innerHTML = `<b>${esc(ctx.label)}</b> · ${now.length ? now.map(t => t.name).join(', ') : 'nessuna specie in stagione'}`;
}

// La zona segue il GPS (se recente) oppure il centro della mappa.
let zoneTimer = 0;
function updateZone() {
  clearTimeout(zoneTimer);
  zoneTimer = setTimeout(() => {
    // GPS recente e visibile sulla mappa; se stai guardando un'altra zona uso il centro della mappa
    const me = state.me && Date.now() - state.me.time < 120000 && map.getBounds().contains([state.me.lat, state.me.lng]) ? state.me : null;
    const c = me || map.getCenter();
    const z = zoneAt(c.lat, c.lng);
    if (z || !state.zone) state.zone = z; // fuori dai confini (mare): tengo l'ultima zona
    renderSeasonChip();
  }, 250);
}
map.on('moveend', updateZone);

function openCalendar() {
  const m = new Date().getMonth();
  const override = pref.get('calendar', null);
  const autoKey = calendarKey(state.zone);
  const ctx = seasonCtx();
  const cal = CALENDARS[ctx.key];
  const provinceNote = cal.provinces && !ctx.province
    ? `<p class="muted">Alcune province hanno date diverse (${Object.keys(cal.provinces).join(', ')}): con la zona automatica vengono applicate da sole.</p>` : '';
  const types = TYPES.filter(t => t.id !== 'altro');
  openSheet(`
    <div class="sheet-head"><h2>Calendario di raccolta</h2>${closeBtn}</div>
    <label>Zona
      <select id="calZone">
        <option value="">Automatica – ${esc(zoneLabel(state.zone))}${state.zone?.province ? ` (${esc(state.zone.province)})` : ''}</option>
        ${Object.entries(CALENDARS).map(([k, c]) => `<option value="${k}" ${override === k ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </label>
    <p class="muted" style="margin-top:10px"><b>${esc(cal.name)}${ctx.province ? ` – provincia di ${esc(ctx.province)}` : ''}</b> · ${esc(cal.source)}</p>
    ${cal.note ? `<div class="notice">${esc(cal.note)}</div>` : ''}
    ${provinceNote}
    ${!override && autoKey === 'nazionale' && state.zone ? `<p class="muted">Per ${esc(zoneLabel(state.zone))} non ho ancora il calendario regionale: sono mostrate date nazionali indicative.</p>` : ''}
    <ul class="cal">
      ${types.map(t => {
        const allowed = !!periodsFor(t.id, ctx.key, ctx.province);
        return `<li style="${allowed ? '' : 'opacity:.5'}">
        <div class="top"><span class="name"><i class="swatch" style="--c:${t.color}"></i>${t.name} <span class="latin">${t.latin}</span></span>
        ${typeInSeason(t.id, ctx) ? '<span class="now">IN STAGIONE</span>' : ''}</div>
        <div class="muted">${seasonLabel(t.id, ctx.key, ctx.province)}</div>
        ${allowed ? `<div class="months">${MONTH_INITIALS.map((l, i) => `<span class="${monthActive(t.id, ctx.key, ctx.province, i) ? 'on' : ''} ${i === m ? 'cur' : ''}">${l}</span>`).join('')}</div>` : ''}
      </li>`;
      }).join('')}
    </ul>
    <p class="muted">Le date cambiano spesso: prima di uscire controlla sempre il calendario ufficiale della tua Regione.</p>`);
  $('#calZone').addEventListener('change', e => {
    pref.set('calendar', e.target.value || null);
    renderSeasonChip();
    openCalendar();
  });
}
$('#seasonChip').addEventListener('click', openCalendar);

/* ================= Navigazione verso un punto ================= */
let navLine = null, wakeLock = null, compassOn = false, compassRaf = 0;

function onOrientation(e) {
  let h = null;
  if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
  else if (e.absolute && e.alpha != null) h = (360 - e.alpha + (screen.orientation?.angle || 0)) % 360;
  if (h == null) return;
  state.compass = h;
  if (!compassRaf) compassRaf = requestAnimationFrame(() => { compassRaf = 0; updateNav(); });
}
async function startCompass() {
  if (compassOn) return;
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return;
    }
  } catch { return; }
  compassOn = true;
  if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOrientation);
  else window.addEventListener('deviceorientation', onOrientation);
}
function stopCompass() {
  compassOn = false;
  state.compass = null;
  window.removeEventListener('deviceorientationabsolute', onOrientation);
  window.removeEventListener('deviceorientation', onOrientation);
}

async function startNav(f) {
  state.navTarget = f;
  $('#navName').textContent = `${typeById(f.type).name} · ${fmtDay(f.createdAt)}`;
  $('#navPanel').hidden = false;
  startGps();
  startCompass();
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* non supportato */ }
  if (!navLine) navLine = L.polyline([], { color: '#e0a93b', weight: 3, dashArray: '6 8', interactive: false }).addTo(map);
  if (state.me) map.fitBounds(L.latLngBounds([state.me.lat, state.me.lng], [f.lat, f.lng]).pad(0.3), { maxZoom: 18 });
  else map.setView([f.lat, f.lng], Math.max(map.getZoom(), 16));
  updateNav();
}
function stopNav() {
  state.navTarget = null;
  $('#navPanel').hidden = true;
  if (navLine) { map.removeLayer(navLine); navLine = null; }
  stopCompass();
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}
function updateNav() {
  const f = state.navTarget;
  if (!f) return;
  const panel = $('#navPanel');
  if (!state.me) { $('#navDist').textContent = 'Attendo GPS…'; $('#navNote').textContent = ''; return; }
  const d = distance(state.me, f);
  const b = bearing(state.me, f);
  const moving = state.me.speed != null && state.me.speed > 0.7 && state.me.heading != null && !Number.isNaN(state.me.heading);
  const heading = state.compass ?? (moving ? state.me.heading : null);
  const arrived = d <= Math.max(8, Math.min(state.me.acc || 0, 25));
  panel.classList.toggle('arrived', arrived);
  $('#navArrow').style.transform = `rotate(${heading == null ? b : b - heading}deg)`;
  $('#navDist').textContent = arrived ? 'Sei arrivato' : fmtDist(d);
  $('#navNote').textContent = heading == null
    ? `Freccia rispetto al Nord (${Math.round(b)}°) · GPS ±${Math.round(state.me.acc)} m`
    : `GPS ±${Math.round(state.me.acc)} m`;
  navLine?.setLatLngs([[state.me.lat, state.me.lng], [f.lat, f.lng]]);
}
$('#navStop').addEventListener('click', stopNav);
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    if (state.navTarget && !wakeLock) { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* ignora */ } }
    syncNow().then(r => r?.changed && loadFinds());
  }
});

/* ================= Menu: offline, sync, backup ================= */
let downloadCtrl = null;

async function openMenu() {
  const cfg = await getSyncConfig();
  const status = await refreshStatus();
  openSheet(`
    <div class="sheet-head"><h2>Impostazioni</h2>${closeBtn}</div>

    <h3>Mappe offline</h3>
    <p class="muted">Scarica la zona che vedi ora sullo schermo per usarla nel bosco senza rete. Anche le zone che guardi quando sei online restano salvate.</p>
    <div class="row2">
      <label>Mappa<select id="oLayer">${Object.entries(BASEMAPS).map(([id, b]) => `<option value="${id}" ${id === currentLayerId ? 'selected' : ''}>${b.name}</option>`).join('')}</select></label>
      <label>Dettaglio<select id="oDepth"><option value="2">Normale</option><option value="3" selected>Alto</option><option value="4">Massimo</option></select></label>
    </div>
    ${activeOverlays.length ? `<label class="overlay-item" style="margin-top:12px"><input type="checkbox" id="oOverlays" checked>
      <span>Scarica anche gli strati attivi (${activeOverlays.length})</span></label>` : ''}
    <p id="oEstimate" class="muted"></p>
    <div class="progress" id="oProg" hidden><div></div></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="oDownload" type="button">Scarica questa zona</button>
      <button class="btn btn-ghost" id="oCancel" type="button" hidden>Interrompi</button>
    </div>
    <p class="muted" id="oCached"></p>
    <button class="link" id="oClear" type="button">Elimina mappe offline</button>

    <h3>Sincronizzazione</h3>
    <p class="muted">I punti sono sempre salvati prima sul telefono. Quando torni online vengono inviati al server in automatico.</p>
    <p id="sStatus"></p>
    <label>Indirizzo server<input id="sUrl" type="url" inputmode="url" placeholder="vuoto = solo su questo telefono" value="${esc(cfg.url)}"></label>
    <label>Token (facoltativo)<input id="sToken" type="password" autocomplete="off" value="${esc(cfg.token)}"></label>
    <div class="btn-row">
      <button class="btn btn-ghost" id="sSave" type="button">Salva impostazioni</button>
      <button class="btn btn-primary" id="sNow" type="button">Sincronizza ora</button>
    </div>

    <h3>Backup</h3>
    <div class="btn-row">
      <button class="btn btn-ghost" id="bGpx" type="button">Esporta GPX</button>
      <button class="btn btn-ghost" id="bJson" type="button">Esporta backup</button>
      <label class="btn btn-ghost" style="margin:0">Importa backup<input id="bImport" type="file" accept="application/json,.json" hidden></label>
    </div>
    <p class="muted">GPX si apre con app GPS e Google Earth. Il backup contiene anche note e foto.</p>`);

  const estimate = () => {
    const b = BASEMAPS[$('#oLayer').value];
    const z = Math.round(map.getZoom());
    const zMax = z + Number($('#oDepth').value);
    const urls = tileUrls(b, map.getBounds(), Math.max(1, z - 2), zMax);
    if ($('#oOverlays')?.checked) {
      for (const id of activeOverlays) {
        urls.push(...tileUrls(overlayAsBasemap(id), map.getBounds(), Math.max(OVERLAY_MIN_ZOOM, z - 2), zMax));
      }
    }
    const tooMany = urls.length > MAX_TILES;
    $('#oEstimate').innerHTML = tooMany
      ? '<span style="color:var(--danger)">Zona troppo grande: avvicinati con lo zoom o scegli meno dettaglio.</span>'
      : `${urls.length} tessere · circa ${Math.max(1, Math.round((urls.length * b.kbPerTile) / 1024))} MB · zoom ${Math.max(1, z - 2)}–${Math.min(z + Number($('#oDepth').value), b.maxNativeZoom)}`;
    $('#oDownload').disabled = tooMany || !!downloadCtrl;
    return tooMany ? null : urls;
  };
  const showCached = async () => { $('#oCached').textContent = `Tessere salvate sul telefono: ${await cachedTileCount()}`; };
  $('#oLayer').addEventListener('change', estimate);
  $('#oOverlays')?.addEventListener('change', estimate);
  $('#oDepth').addEventListener('change', estimate);
  estimate();
  showCached();

  $('#oDownload').addEventListener('click', async () => {
    const urls = estimate();
    if (!urls) return;
    if (!navigator.onLine) { toast('Serve la rete per scaricare le mappe'); return; }
    downloadCtrl = new AbortController();
    $('#oDownload').disabled = true;
    $('#oCancel').hidden = false;
    $('#oProg').hidden = false;
    const bar = $('#oProg > div');
    const { done, failed } = await downloadTiles(urls, (n, fail, tot) => {
      if (bar.isConnected) bar.style.width = `${(n / tot) * 100}%`;
      const est = $('#oEstimate');
      if (est?.isConnected) est.textContent = `Scaricate ${n} di ${tot}${fail ? ` (${fail} errori)` : ''}`;
    }, downloadCtrl.signal);
    const aborted = downloadCtrl.signal.aborted;
    downloadCtrl = null;
    toast(aborted ? 'Download interrotto' : failed ? `Zona scaricata con ${failed} errori` : 'Zona disponibile offline');
    if ($('#oCancel')?.isConnected) { $('#oCancel').hidden = true; showCached(); estimate(); }
    return done;
  });
  $('#oCancel').addEventListener('click', () => downloadCtrl?.abort());
  $('#oClear').addEventListener('click', async () => {
    if (!confirm('Eliminare tutte le mappe salvate per l’uso offline?')) return;
    await clearTiles();
    showCached();
    toast('Mappe offline eliminate');
  });

  $('#sStatus').textContent = statusText(status, true);
  $('#sSave').addEventListener('click', async () => {
    await setSyncConfig({ url: $('#sUrl').value, token: $('#sToken').value });
    // i punti già inviati al vecchio server vanno reinviati al nuovo
    const all = await db.all();
    await db.putMany(all.map(f => ({ ...f, synced: false })));
    toast('Impostazioni salvate');
    afterLocalChange();
  });
  $('#sNow').addEventListener('click', async () => {
    if (!navigator.onLine) { toast('Sei offline: sincronizzo appena torna la rete'); return; }
    const r = await syncNow();
    if (r?.changed) await loadFinds();
  });

  $('#bGpx').addEventListener('click', exportGpx);
  $('#bJson').addEventListener('click', exportJson);
  $('#bImport').addEventListener('change', importJson);
}
$('#btnMenu').addEventListener('click', openMenu);

/* ================= Backup ================= */
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const stamp = () => new Date().toISOString().slice(0, 10);
const xml = s => esc(s);

function exportGpx() {
  const wpts = state.finds.map(f => {
    const t = typeById(f.type);
    const desc = [f.weight != null ? `Peso: ${fmtWeight(f.weight)}` : '', f.dog ? `Cane: ${f.dog}` : '', f.notes].filter(Boolean).join('\n');
    return `  <wpt lat="${f.lat.toFixed(7)}" lon="${f.lng.toFixed(7)}">
    <time>${f.createdAt}</time>
    <name>${xml(`${t.name} ${fmtDay(f.createdAt)}`)}</name>
    ${desc ? `<desc>${xml(desc)}</desc>` : ''}
    <type>${xml(t.name)}</type>
  </wpt>`;
  }).join('\n');
  download(`tartufi-${stamp()}.gpx`, `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Occhio di nonna" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
</gpx>
`, 'application/gpx+xml');
}

function exportJson() {
  const data = state.finds.map(({ synced, onServer, ...f }) => f);
  download(`tartufi-backup-${stamp()}.json`, JSON.stringify({ app: 'occhio-di-nonna', version: 1, exportedAt: new Date().toISOString(), finds: data }, null, 1), 'application/json');
}

async function importJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const list = Array.isArray(parsed) ? parsed : parsed.finds;
    if (!Array.isArray(list)) throw new Error('formato');
    const existing = new Map((await db.all()).map(f => [f.id, f]));
    const now = new Date().toISOString();
    const recs = list
      .filter(r => r && Number.isFinite(+r.lat) && Number.isFinite(+r.lng))
      .map(r => ({
        id: typeof r.id === 'string' && /^[\w-]{1,64}$/.test(r.id) ? r.id : uid(),
        lat: +r.lat, lng: +r.lng,
        accuracy: r.accuracy == null ? null : +r.accuracy,
        type: typeById(r.type).id,
        weight: r.weight == null || r.weight === '' ? null : +r.weight,
        dog: String(r.dog || ''), notes: String(r.notes || ''),
        photo: typeof r.photo === 'string' && r.photo.startsWith('data:image/') ? r.photo : null,
        createdAt: r.createdAt || now, updatedAt: r.updatedAt || now,
        deleted: false, synced: false, onServer: false,
      }))
      .filter(r => !existing.has(r.id) || existing.get(r.id).updatedAt < r.updatedAt);
    await db.putMany(recs);
    await loadFinds();
    toast(`Importati ${recs.length} punti`);
    afterLocalChange();
  } catch {
    toast('File di backup non valido');
  }
  e.target.value = '';
}

/* ================= Stato sincronizzazione ================= */
function statusText(s, long = false) {
  const p = s.pending;
  switch (s.state) {
    case 'syncing': return 'Sincronizzo…';
    case 'local': return long ? 'Sincronizzazione disattivata: i punti restano solo su questo telefono.' : (p ? 'Solo sul telefono' : 'Salvato sul telefono');
    case 'offline': return p ? `Offline · ${p} in attesa` : 'Offline';
    case 'error':
      if (long) return `Server non raggiungibile (${s.error}). ${p ? `${p} punti in attesa: ` : ''}riprovo da solo.`;
      return p ? `${p} in attesa` : 'Server non raggiungibile';
    case 'pending': return `${p} in attesa`;
    default: return long && s.lastSync ? `Tutto sincronizzato (ultimo: ${fmtDateTime(s.lastSync)})` : 'Sincronizzato';
  }
}
onSyncStatus(s => {
  const pill = $('#syncPill');
  pill.dataset.state = s.state;
  pill.querySelector('.txt').textContent = statusText(s);
  const el = document.getElementById('sStatus'); // pannello impostazioni, se aperto
  if (el) el.textContent = statusText(s, true);
});
$('#syncPill').addEventListener('click', async () => {
  const s = await refreshStatus();
  toast(statusText(s, true), 4000);
  if (s.state !== 'local' && navigator.onLine) syncNow().then(r => r?.changed && loadFinds());
});

function afterLocalChange() {
  refreshStatus();
  syncNow().then(r => r?.changed && loadFinds());
}
window.addEventListener('online', () => { toast('Di nuovo online: sincronizzo'); syncNow().then(r => r?.changed && loadFinds()); });
window.addEventListener('offline', () => refreshStatus());
setInterval(() => { if (navigator.onLine) syncNow().then(r => r?.changed && loadFinds()); }, 60000);

/* ================= Avvio ================= */
(async () => {
  renderSeasonChip();
  loadZones().then(updateZone);
  await loadFinds();
  if (!savedView && state.finds.length) {
    map.fitBounds(L.latLngBounds(state.finds.map(f => [f.lat, f.lng])).pad(0.2), { maxZoom: 16 });
  }
  startGps();
  await refreshStatus();
  syncNow().then(r => r?.changed && loadFinds());
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.storage?.persist?.().catch(() => {}); // evita che Android cancelli dati e mappe
  }
})();
