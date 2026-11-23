// uso: node dl.mjs start | status
import fs from 'node:fs';
const mode = process.argv[2];
const urls = JSON.parse(fs.readFileSync(new URL('./tn-urls.json', import.meta.url)));
const expr = mode === 'start'
  ? `(async()=>{ if (window.__prog && !window.__prog.end) return 'già in corso';
      const m = await import('/offline.js'); const urls = ${JSON.stringify(urls)};
      window.__prog = { d: 0, f: 0, t: urls.length }; window.__ctl = new AbortController();
      m.downloadTiles(urls, (d, f, t) => Object.assign(window.__prog, { d, f, t }), window.__ctl.signal).then(r => window.__prog.end = r);
      return 'avviato: ' + urls.length; })()`
  : `(async()=>{ const c = await caches.open('tartufi-tiles'); const ks = await c.keys(); const n = {};
      for (const r of ks) { const p = new URL(r.url).pathname.split('/'); if (p[1]==='ov') n[p[2]] = (n[p[2]]||0)+1; }
      return { prog: window.__prog ?? null, cached: n }; })()`;
const list = await (await fetch('http://localhost:9222/json')).json();
const page = list.find(p => p.type === 'page' && p.url.includes('localhost:8090'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) { console.log(JSON.stringify(d.result.result.value ?? d.result)); ws.close(); } };
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
