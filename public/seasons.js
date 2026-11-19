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

// Altre Regioni (fonti verificate il 19/11/2026). `check: 'da verificare'` = fonte non ufficiale o testo forse superato.
Object.assign(CALENDARS, {
  'Emilia-Romagna': {
    name: 'Emilia-Romagna',
    source: 'Calendario 2026–2030, DGR n. 137 del 02/02/2026 (L.R. 24/1991, art. 13)',
    note: 'Sospensione totale dal 1 al 31 maggio e dal 16 agosto al 30 settembre. Scorzone: in pianura solo fino al 31 luglio (qui è mostrata la collina, fino al 15 agosto).',
    periods: {
      magnatum: [[10, 1, 1, 20]], melanosporum: [[11, 1, 3, 31]], aestivum: [[6, 1, 8, 15]], uncinatum: [[10, 1, 1, 31]],
      brumale: [[12, 1, 4, 30]], moschatum: [[12, 1, 4, 30]], borchii: [[12, 1, 4, 30]], macrosporum: [[10, 1, 1, 20]], mesentericum: [[10, 1, 1, 20]],
    },
  },
  Marche: {
    name: 'Marche',
    source: 'L.R. 5/2013, allegato A (sostituito dalla L.R. 17/2024)',
    note: 'Nei comuni confinanti con l’Abruzzo il nero pregiato si raccoglie dal 15 novembre. Raccolta non consentita a maggio e settembre.',
    periods: {
      magnatum: [[10, 1, 1, 15]], melanosporum: [[12, 1, 3, 15]], moschatum: [[1, 1, 3, 15]], aestivum: [[6, 1, 8, 31], [10, 1, 12, 31]],
      uncinatum: [[10, 1, 12, 31]], brumale: [[1, 1, 3, 15]], borchii: [[1, 15, 4, 15]], macrosporum: [[10, 1, 12, 31]], mesentericum: [[10, 1, 1, 31]],
    },
  },
  Umbria: {
    name: 'Umbria',
    source: 'L.R. 12/2015 (Testo unico agricoltura), art. 110',
    note: 'Bianco dall’ultima domenica di settembre, scorzone dall’ultima domenica di maggio. La Giunta può variare il calendario in base all’andamento stagionale.',
    periods: {
      magnatum: [[9, -1, 12, 31]], melanosporum: [[12, 1, 3, 15]], moschatum: [[12, 1, 3, 15]], aestivum: [[5, -1, 8, 31]],
      uncinatum: [[10, 1, 1, 31]], brumale: [[1, 1, 3, 15]], borchii: [[1, 15, 4, 15]], macrosporum: [[10, 1, 12, 31]], mesentericum: [[11, 1, 3, 15]],
    },
  },
  Abruzzo: {
    name: 'Abruzzo',
    source: 'L.R. 66/2012, art. 2 (testo aggiornato n. 8 del Consiglio regionale)',
    note: 'Nei comuni dell’art. 17 c. 3: nero pregiato con date proprie, bianchetto fino al 15 marzo, scorzone dal 1 giugno. Possibili modifiche dopo il testo n. 8.',
    periods: {
      magnatum: [[10, 1, 1, 31]], melanosporum: [[11, 15, 3, 15]], macrosporum: [[10, 15, 12, 31]], borchii: [[1, 15, 4, 15]],
      brumale: [[11, 15, 3, 15]], moschatum: [[11, 15, 3, 15]], aestivum: [[5, 15, 9, 15], [10, 15, 12, 31]], uncinatum: [[10, 1, 3, 15]], mesentericum: [[10, 1, 1, 31]],
    },
  },
  'Friuli-Venezia Giulia': {
    name: 'Friuli Venezia Giulia',
    source: 'L.R. 23/1999, art. 11 (testo vigente dal 27/10/2024)',
    note: 'L’ERSA può disporre variazioni del calendario. Vietata di notte.',
    periods: {
      magnatum: [[10, 1, 12, 31]], melanosporum: [[11, 15, 3, 15]], moschatum: [[11, 15, 3, 15]], aestivum: [[5, 1, 11, 30]], uncinatum: [[10, 1, 12, 31]],
      brumale: [[1, 1, 3, 15]], borchii: [[1, 15, 4, 30]], macrosporum: [[9, 1, 1, 31]], mesentericum: [[9, 1, 1, 31]],
    },
  },
  Lazio: {
    name: 'Lazio',
    source: 'L.R. 82/1988, art. 4',
    note: 'Massimo 2 kg al giorno. Il Presidente della Giunta può variare il calendario con ordinanza.',
    periods: {
      melanosporum: [[11, 15, 3, 15]], magnatum: [[10, 1, 12, 31]], aestivum: [[5, 1, 11, 30]], borchii: [[1, 15, 4, 30]], brumale: [[1, 1, 3, 15]],
      moschatum: [[11, 15, 3, 15]], uncinatum: [[10, 1, 12, 31]], macrosporum: [[9, 1, 12, 31]], mesentericum: [[9, 1, 1, 31]],
    },
  },
  Campania: {
    name: 'Campania',
    source: 'Regolamento regionale 3/2007, art. 8 (testo vigente)',
    note: 'Raccolta da un’ora prima dell’alba a un’ora dopo il tramonto.',
    periods: {
      mesentericum: [[9, 1, 4, 15]], magnatum: [[10, 1, 12, 31]], aestivum: [[5, 1, 11, 30]], uncinatum: [[10, 1, 12, 31]], borchii: [[1, 1, 4, 30]],
      melanosporum: [[11, 15, 3, 15]], macrosporum: [[9, 1, 12, 31]], brumale: [[1, 1, 3, 15]], moschatum: [[11, 1, 3, 15]],
    },
  },
  Puglia: {
    name: 'Puglia',
    source: 'L.R. 8/2015, art. 15',
    note: 'La Giunta può variare i periodi in condizioni climatiche eccezionali, ma non anticipare l’apertura.',
    periods: {
      magnatum: [[10, 1, 12, 31]], melanosporum: [[11, 15, 3, 15]], moschatum: [[11, 15, 3, 15]], aestivum: [[5, 1, 11, 30]], uncinatum: [[10, 1, 12, 31]],
      brumale: [[1, 1, 3, 15]], borchii: [[1, 15, 4, 30]], macrosporum: [[9, 1, 12, 31]], mesentericum: [[9, 1, 1, 31]],
    },
  },
  Basilicata: {
    name: 'Basilicata',
    source: 'L.R. 35/1995, allegato A (pagina ufficiale della Regione)',
    note: 'Le date cambiano spesso con delibere annuali: nel 2025 la DGR 540 ha anticipato bianco e uncinato al 23 settembre; in passato la chiusura è stata prorogata al 15 gennaio.',
    periods: {
      magnatum: [[10, 1, 12, 31]], uncinatum: [[10, 1, 12, 31]], melanosporum: [[11, 15, 3, 15]], moschatum: [[11, 15, 3, 15]], aestivum: [[5, 1, 11, 30]],
      brumale: [[1, 1, 3, 15]], borchii: [[1, 15, 4, 30]], macrosporum: [[9, 1, 12, 31]], mesentericum: [[9, 1, 1, 31]],
    },
  },
  Liguria: {
    name: 'Liguria',
    check: 'da verificare',
    source: 'L.R. 2/2022 – date del decreto regionale per la stagione 2024–2025',
    note: 'Calendario cambiato più volte per decreto (fermo dal 1 al 25 settembre e a maggio nel 2024; nuovo decreto nel 2025 non verificato). Controlla il calendario in vigore su agriligurianet.it.',
    periods: {
      magnatum: [[9, 25, 1, 25]], melanosporum: [[12, 1, 3, 31]], aestivum: [[6, 1, 8, 31], [9, 25, 11, 30]], uncinatum: [[10, 1, 12, 31]],
      mesentericum: [[9, 25, 1, 31]], macrosporum: [[9, 25, 12, 31]], brumale: [[1, 1, 3, 15]], moschatum: [[11, 15, 3, 15]], borchii: [[1, 15, 4, 30]],
    },
  },
  Molise: {
    name: 'Molise',
    check: 'da verificare',
    source: 'L.R. 24/2005, art. 8 (testo del 2006 in Gazzetta Ufficiale, con la modifica 2011 per il bianco)',
    note: 'Vietata ad aprile, maggio e settembre, e il sabato fuori dalle tartufaie controllate. Una modifica del 2011 potrebbe aver cambiato anche lo scorzone (dal 10 maggio): da verificare.',
    periods: {
      melanosporum: [[11, 15, 3, 15]], magnatum: [[10, 1, 1, 15]], aestivum: [[6, 1, 8, 30]], borchii: [[1, 15, 3, 31]], brumale: [[1, 1, 3, 15]],
      moschatum: [[12, 10, 3, 15]], uncinatum: [[10, 15, 12, 31]], macrosporum: [[10, 15, 12, 31]], mesentericum: [[10, 15, 1, 31]],
    },
  },
  Sicilia: {
    name: 'Sicilia',
    check: 'da verificare',
    source: 'L.R. 35/2020 – calendario pubblicato dalla Regione Siciliana (2022); bianco da fonte giornalistica',
    note: 'L’Assessore all’Agricoltura può modificare il calendario. Nero pregiato non indicato nelle fonti trovate.',
    periods: {
      aestivum: [[5, 15, 8, 15]], uncinatum: [[10, 1, 1, 31]], borchii: [[12, 15, 4, 15]], brumale: [[11, 1, 4, 15]],
      moschatum: [[1, 1, 3, 31]], mesentericum: [[11, 1, 3, 31]], magnatum: [[10, 1, 1, 20]],
    },
  },
});

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
// giorno -1 = ultima domenica del mese (es. Umbria: "dall'ultima domenica di settembre")
function lastSunday(year, month) {
  const d = new Date(year, month, 0); // ultimo giorno del mese (month è 1-12)
  return d.getDate() - d.getDay();
}
function inPeriod([sm, sd, em, ed], date) {
  if (sd < 0) sd = lastSunday(date.getFullYear(), sm);
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
    const start = sd < 0 ? `ultima dom. di ${MONTHS[sm - 1]}` : `${sd} ${MONTHS[sm - 1]}`;
    return `${start} – ${end}`;
  }).join(' e ');
}

export function monthActive(typeId, key, province, monthIndex) {
  const p = periodsFor(typeId, key, province);
  if (!p) return false;
  const y = 2024; // anno bisestile: include il 29 febbraio
  const last = new Date(y, monthIndex + 1, 0).getDate();
  return [1, 8, 15, 22, last].some(d => p.some(per => inPeriod(per, new Date(y, monthIndex, d))));
}
