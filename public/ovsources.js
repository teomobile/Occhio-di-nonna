// Sorgenti degli strati (geoportali ufficiali): usate dal server (proxy /ov/...) e, nell'app Android, dall'app stessa.
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

export const OVERLAY_SOURCES = {
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

export function upstreamTileUrl(o, z, x, y) {
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


// Legenda: WMS → immagine GetLegendGraphic; ArcGIS → JSON con le voci
export function legendUrl(o) {
  if (o.type === 'wms') return `${o.url}${o.url.includes('?') ? '&' : '?'}SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${encodeURIComponent(o.layers.split(',')[0])}`;
  return `${o.url}/legend?f=json`;
}
// Voci della legenda ArcGIS (solo i sottostrati mostrati)
export function arcgisLegendItems(o, data) {
  const shown = o.show ? o.show.split(',').map(Number) : null;
  return (data.layers || [])
    .filter(l => !shown || shown.includes(l.layerId))
    .flatMap(l => l.legend.map(g => ({ label: g.label || l.layerName, img: `data:${g.contentType};base64,${g.imageData}` })));
}
