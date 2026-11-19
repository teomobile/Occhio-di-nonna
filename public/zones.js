// Riconosce Regione e Provincia di un punto, anche offline, dai confini semplificati (province.json, fonte ISTAT via openpolis).
let data = null;
let loading = null;

export function loadZones() {
  if (!loading) {
    loading = fetch('province.json')
      .then(r => r.json())
      .then(d => { data = d; return d; })
      .catch(() => { loading = null; return null; });
  }
  return loading;
}

export function zoneAt(lat, lng) {
  if (!data) return null;
  for (const f of data) {
    const [minX, minY, maxX, maxY] = f.b;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    let inside = false;
    for (const r of f.g) { // anelli piatti [x0,y0,x1,y1,...], regola pari-dispari
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
        if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    if (inside) return { region: f.r, province: f.p };
  }
  return null;
}
