// Tipi di tartufo e calendari di raccolta per zona.
// Periodo: [meseInizio, giornoInizio, meseFine, giornoFine]; una specie può avere più periodi.
// Le date regionali sono prese dai testi ufficiali (vedi `source`). Vanno ricontrollate ogni stagione.
export const TYPES = [
  { id: 'magnatum',     name: 'Bianco pregiato', latin: 'Tuber magnatum',              color: '#f4ead2' },
  { id: 'melanosporum', name: 'Nero pregiato',   latin: 'Tuber melanosporum',          color: '#1f1b19' },
  { id: 'aestivum',     name: 'Scorzone estivo', latin: 'Tuber aestivum',              color: '#a0582f' },
  { id: 'uncinatum',    name: 'Uncinato',        latin: 'Tuber aestivum var. uncinatum', color: '#d7922e' },
  { id: 'borchii',      name: 'Bianchetto',      latin: 'Tuber borchii',               color: '#e6c84f' },
  { id: 'macrosporum',  name: 'Nero liscio',     latin: 'Tuber macrosporum',           color: '#6a5a8c' },
  { id: 'brumale',      name: 'Nero invernale',  latin: 'Tuber brumale',               color: '#3f6275' },
  { id: 'moschatum',    name: 'Nero moscato',    latin: 'Tuber brumale var. moschatum', color: '#7d4b5f' },
  { id: 'mesentericum', name: 'Nero ordinario',  latin: 'Tuber mesentericum',          color: '#5d6b3c' },
  { id: 'altro',        name: 'Altro / non so',  latin: '',                            color: '#9aa39a' },
];
export const DARK_TYPES = ['melanosporum', 'brumale', 'macrosporum', 'mesentericum', 'moschatum'];

const BY_ID = Object.fromEntries(TYPES.map(t => [t.id, t]));
export const typeById = id => BY_ID[id] || BY_ID.altro;

export const CALENDARS = {
  Piemonte: {
    name: 'Piemonte',
    source: 'D.G.R. 15-8506 del 29/04/2024 (valido dal 1/9/2024)',
    note: 'Raccolta vietata per tutte le specie dal 1 al 31 maggio e dal 1 al 30 settembre.',
    periods: {
      magnatum: [[10, 1, 1, 31]],
      melanosporum: [[12, 15, 3, 15]],
      moschatum: [[12, 15, 3, 15]],
      aestivum: [[6, 1, 8, 31], [10, 1, 11, 30]],
      uncinatum: [[10, 1, 12, 31]],
      brumale: [[12, 15, 3, 15]],
      borchii: [[1, 15, 4, 30]],
      macrosporum: [[10, 1, 12, 31]],
      mesentericum: [[10, 1, 1, 31]],
    },
  },
  Toscana: {
    name: 'Toscana',
    source: 'L.R. 36/2023, art. 8',
    note: 'Fermo ecologico a maggio e settembre per tutte le specie. Dal 1 al 30 giugno vietata in oasi di protezione e zone di ripopolamento della fauna.',
    periods: {
      magnatum: [[10, 1, 1, 15]],
      melanosporum: [[11, 15, 3, 15]],
      moschatum: [[1, 15, 4, 15]],
      aestivum: [[6, 1, 8, 31], [10, 1, 11, 30]],
      uncinatum: [[10, 1, 1, 15]],
      brumale: [[1, 15, 4, 15]],
      borchii: [[1, 15, 4, 15]],
      macrosporum: [[10, 1, 12, 31]],
      mesentericum: [[10, 1, 12, 31]],
    },
  },
  Lombardia: {
    name: 'Lombardia',
    source: 'D.d.s. 18/03/2026 n. 3516 (stagione 2026–2027)',
    note: 'Massimo 1 kg al giorno a persona. Nelle tartufaie controllate la raccolta è riservata.',
    periods: {
      borchii: [[1, 15, 4, 30]],
      aestivum: [[6, 1, 11, 30]],
      uncinatum: [[10, 1, 1, 31]],
      brumale: [[1, 1, 3, 15]],
      moschatum: [[11, 15, 3, 15]],
      macrosporum: [[9, 1, 12, 31]],
      magnatum: [[9, 15, 12, 31]],
      melanosporum: [[12, 1, 3, 15]],
      mesentericum: [[9, 1, 1, 31]],
    },
    // date diverse per alcune province
    provinces: {
      Pavia: {
        aestivum: [[6, 1, 9, 15], [10, 1, 11, 30]],
        macrosporum: [[10, 1, 12, 31]],
        magnatum: [[10, 1, 1, 15]],
        mesentericum: [[10, 1, 1, 31]],
      },
      Mantova: { magnatum: [[10, 1, 1, 15]] },
    },
  },
  Veneto: {
    name: 'Veneto',
    source: 'L.R. 30/1988, art. 8 (aggiornato settembre 2024)',
    note: 'Vietata fuori periodo e nelle ore notturne.',
    periods: {
      magnatum: [[10, 1, 12, 31]],
      melanosporum: [[11, 15, 3, 15]],
      moschatum: [[11, 15, 3, 15]],
      aestivum: [[6, 1, 11, 30]],
      uncinatum: [[9, 15, 1, 31]],
      brumale: [[1, 1, 3, 15]],
      borchii: [[1, 15, 4, 15]],
      macrosporum: [[9, 1, 12, 31]],
      mesentericum: [[9, 1, 1, 31]],
    },
  },
  Trento: {
    name: 'Trentino',
    source: 'L.P. 11/2007 – Servizio Foreste della Provincia di Trento',
    note: 'Ammesse solo queste 5 specie. Serve il tesserino; massimo 1 kg al giorno, dalle 7 alle 19.',
    periods: {
      melanosporum: [[12, 1, 2, 29]],
      aestivum: [[7, 1, 11, 30]],
      uncinatum: [[12, 1, 12, 31]],
      brumale: [[1, 1, 2, 29]],
      mesentericum: [[12, 1, 2, 29]],
    },
  },
  nazionale: {
    name: 'Italia (indicativo)',
    source: 'L. 752/1985 – date indicative: la tua Regione può averle cambiate',
    note: 'Calendario regionale non inserito per questa zona: verifica le date della tua Regione.',
    periods: {
      magnatum: [[10, 1, 12, 31]],
      melanosporum: [[12, 1, 3, 15]],
      moschatum: [[11, 15, 3, 15]],
      aestivum: [[5, 1, 11, 30]],
      uncinatum: [[10, 1, 12, 31]],
      borchii: [[1, 15, 4, 30]],
      macrosporum: [[9, 1, 12, 31]],
      brumale: [[1, 1, 3, 15]],
      mesentericum: [[9, 1, 1, 31]],
    },
  },
};

// Da {region, province} (vedi zones.js) alla chiave del calendario.
export function calendarKey(zone) {
  if (!zone) return 'nazionale';
  if (zone.region.startsWith('Trentino')) return zone.province === 'Trento' ? 'Trento' : 'nazionale';
  return CALENDARS[zone.region] ? zone.region : 'nazionale';
}

export function zoneLabel(zone) {
  if (!zone) return 'Zona sconosciuta';
  if (zone.region.startsWith('Trentino')) return zone.province === 'Trento' ? 'Trentino' : 'Alto Adige';
  return zone.region;
}

// Periodi validi per una specie in una zona (null = specie non ammessa)
export function periodsFor(typeId, key, province) {
  const cal = CALENDARS[key] || CALENDARS.nazionale;
  const override = cal.provinces?.[province]?.[typeId];
  return override || cal.periods[typeId] || null;
}

const md = (m, d) => m * 100 + d;
function inPeriod([sm, sd, em, ed], date) {
  const t = md(date.getMonth() + 1, date.getDate());
  const s = md(sm, sd), e = md(em, ed);
  return s <= e ? t >= s && t <= e : t >= s || t <= e;
}

export function inSeason(typeId, key, province, date = new Date()) {
  const p = periodsFor(typeId, key, province);
  return !!p && p.some(per => inPeriod(per, date));
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const MONTH_INITIALS = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];

export function seasonLabel(typeId, key, province) {
  const p = periodsFor(typeId, key, province);
  if (!p) return 'non ammesso';
  return p.map(([sm, sd, em, ed]) => {
    const end = em === 2 && ed >= 28 ? 'fine feb' : `${ed} ${MONTHS[em - 1]}`;
    return `${sd} ${MONTHS[sm - 1]} – ${end}`;
  }).join(' e ');
}

export function monthActive(typeId, key, province, monthIndex) {
  const p = periodsFor(typeId, key, province);
  if (!p) return false;
  const y = 2024; // anno bisestile: include il 29 febbraio
  const last = new Date(y, monthIndex + 1, 0).getDate();
  return [1, 8, 15, 22, last].some(d => p.some(per => inPeriod(per, new Date(y, monthIndex, d))));
}
