// Sincronizzazione: ogni punto è salvato subito sul telefono con synced=false.
// Appena c'è rete, i punti in attesa vengono inviati al server (vince la modifica più recente).
import { db } from './db.js';

// Spenta di base: i punti restano solo sul telefono finché non la si accende nelle impostazioni
const DEFAULT_CONFIG = { enabled: false, url: 'api', token: '' };
const listeners = new Set();
let syncing = false;
let lastError = null;

export const onSyncStatus = fn => listeners.add(fn);

export async function getSyncConfig() {
  return { ...DEFAULT_CONFIG, ...((await db.getMeta('sync')) || {}) };
}

export async function setSyncConfig(cfg) {
  await db.setMeta('sync', { enabled: !!cfg.enabled, url: (cfg.url || '').trim(), token: (cfg.token || '').trim() });
  await db.setMeta('cursor', 0); // nuovo server: riscarica tutto
  lastError = null;
}

async function pendingCount() {
  return (await db.all()).filter(f => !f.synced).length;
}

export async function refreshStatus() {
  const cfg = await getSyncConfig();
  const pending = await pendingCount();
  const lastSync = await db.getMeta('lastSync');
  let state;
  if (syncing) state = 'syncing';
  else if (!cfg.enabled || !cfg.url) state = 'local';
  else if (!navigator.onLine) state = 'offline';
  else if (lastError) state = 'error';
  else state = pending ? 'pending' : 'ok';
  const status = { state, pending, lastSync, error: lastError };
  listeners.forEach(fn => fn(status));
  return status;
}

const strip = ({ synced, onServer, ...rest }) => rest;

export async function syncNow() {
  if (syncing) return;
  const cfg = await getSyncConfig();
  if (!cfg.enabled || !cfg.url || !navigator.onLine) return refreshStatus();

  syncing = true;
  await refreshStatus();
  try {
    const pending = (await db.all()).filter(f => !f.synced);
    const cursor = (await db.getMeta('cursor')) || 0;
    const endpoint = new URL(cfg.url.replace(/\/$/, '') + '/sync', location.href);
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ since: cursor, changes: pending.map(strip) }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    if (res.status === 401) throw new Error('Token non valido');
    if (!res.ok) throw new Error(`Errore server ${res.status}`);
    const data = await res.json();

    // Stato attuale (l'utente può aver modificato qualcosa nel frattempo)
    const current = new Map((await db.all()).map(f => [f.id, f]));
    const writes = new Map();
    const deletes = new Set();

    for (const sent of pending) {
      const c = current.get(sent.id);
      if (!c || c.updatedAt !== sent.updatedAt) continue; // modificato durante l'invio: resta in attesa
      if (c.deleted) deletes.add(c.id);
      else writes.set(c.id, { ...c, synced: true, onServer: true });
    }
    for (const r of data.changes || []) {
      const c = current.get(r.id);
      if (c && !c.synced && c.updatedAt > r.updatedAt && !writes.has(r.id)) continue; // la mia versione è più nuova
      if (r.deleted) { deletes.add(r.id); writes.delete(r.id); }
      else writes.set(r.id, { ...r, synced: true, onServer: true });
    }

    if (writes.size) await db.putMany([...writes.values()]);
    if (deletes.size) await db.deleteMany([...deletes]);
    await db.setMeta('cursor', data.cursor || 0);
    await db.setMeta('lastSync', new Date().toISOString());
    lastError = null;
    return { changed: writes.size + deletes.size > 0 };
  } catch (err) {
    lastError = err.name === 'AbortError' ? 'Rete troppo lenta' : err.message;
    return { changed: false };
  } finally {
    syncing = false;
    await refreshStatus();
  }
}
