// City detail from OpenStreetMap (OpenFreeMap's tiles, read through the app's
// own store, so a saved area works at sea): every street with its name,
// railways, metro and stations, buildings (raised in 3D), parks and land use,
// places, airports and points of interest. Each group has its own switch.
// And a 3D view: tilt and turn, buildings raised to their height, hills from
// a terrain model.

const SRC = 'osm-detail';
export const CITY_GROUPS = {
  citygreen: ['city-landcover', 'city-landuse', 'city-park'],
  cityroads: ['city-road-case', 'city-road', 'city-path', 'city-road-names', 'city-road-refs', 'city-runway'],
  cityrail: ['city-rail', 'city-rail-dash', 'city-metro', 'city-tram', 'city-stations', 'city-station-names'],
  citybuildings: ['city-buildings', 'city-buildings-3d'],
  cityplaces: ['city-places', 'city-poi', 'city-poi-names', 'city-airports', 'city-housenumbers'],
};

const W = (stops) => ['interpolate', ['exponential', 1.6], ['zoom'], ...stops.flat()];
const cls = (...c) => ['match', ['get', 'class'], c, true, false];
const halo = { 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.5 };

const ROAD_COLOUR = ['match', ['get', 'class'],
  ['motorway', 'trunk'], '#e46c3a', 'primary', '#f0a14a', 'secondary', '#f6cf6b', '#ffffff'];
const ROAD_WIDTH = ['interpolate', ['exponential', 1.6], ['zoom'],
  10, ['match', ['get', 'class'], ['motorway', 'trunk'], 1.6, 'primary', 1.2, 'secondary', 0.9, 0.5],
  14, ['match', ['get', 'class'], ['motorway', 'trunk'], 5, 'primary', 4.2, 'secondary', 3.6, 'tertiary', 3, 2],
  17, ['match', ['get', 'class'], ['motorway', 'trunk'], 16, 'primary', 14, 'secondary', 12, 'tertiary', 10, 7]];
// The casing: the same widths, 1.2 px wider (the addition goes inside each
// stop, as zoom expressions must stay at the top).
const ROAD_CASE_WIDTH = ROAD_WIDTH.map((v, i) => (i > 3 && i % 2 === 0 ? ['+', v, 1.2] : v));
const ROADS = cls('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'busway');

export function addCityDetail(map, { before, labelsBefore }) {
  map.addSource(SRC, { type: 'vector', tiles: ['ofm://{z}/{x}/{y}'], minzoom: 10, maxzoom: 14, attribution: '© OpenStreetMap · OpenFreeMap' });
  const add = (layer, at = before) => map.addLayer({ source: SRC, ...layer }, at);

  // Land use and green: under the water and the roads.
  add({
    id: 'city-landcover', type: 'fill', 'source-layer': 'landcover', minzoom: 10,
    paint: {
      'fill-color': ['match', ['get', 'class'], 'wood', '#bcdcae', 'grass', '#d4ecc6', 'farmland', '#e9efc9',
        'sand', '#f1e7c6', 'wetland', '#cfe3e0', 'ice', '#f4f8fb', '#d9ebcf'],
      'fill-opacity': 0.75,
    },
  }, 'osm-water');
  add({
    id: 'city-landuse', type: 'fill', 'source-layer': 'landuse', minzoom: 11,
    filter: ['!=', ['get', 'class'], 'residential'],
    paint: {
      'fill-color': ['match', ['get', 'class'], 'industrial', '#e5dce8', 'commercial', '#f3e0d8', 'retail', '#f3dcd8',
        'railway', '#e6e0d6', 'hospital', '#f6dede', ['school', 'university', 'college', 'kindergarten'], '#f3ead0',
        'cemetery', '#d9e8d9', 'stadium', '#d8ead2', 'pitch', '#cfe6c0', 'military', '#eadcd6', '#ebe6dc'],
      'fill-opacity': 0.8,
    },
  }, 'osm-water');
  add({
    id: 'city-park', type: 'fill', 'source-layer': 'park', minzoom: 10,
    paint: { 'fill-color': '#c6e5b5', 'fill-opacity': 0.8, 'fill-outline-color': '#a9d295' },
  }, 'osm-water');

  // Airports.
  add({
    id: 'city-runway', type: 'line', 'source-layer': 'aeroway', minzoom: 10,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], cls('runway', 'taxiway')],
    paint: { 'line-color': '#c9c9d6', 'line-width': W([[10, ['match', ['get', 'class'], 'runway', 1.5, 0.5]], [16, ['match', ['get', 'class'], 'runway', 40, 8]]]) },
  });

  // Streets: casing then fill, every class, with paths dashed.
  add({
    id: 'city-road-case', type: 'line', 'source-layer': 'transportation', minzoom: 11, filter: ROADS,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#b9a68f', 'line-width': ROAD_CASE_WIDTH, 'line-opacity': ['match', ['get', 'brunnel'], 'tunnel', 0.4, 1] },
  });
  add({
    id: 'city-road', type: 'line', 'source-layer': 'transportation', minzoom: 10, filter: ROADS,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ROAD_COLOUR, 'line-width': ROAD_WIDTH, 'line-opacity': ['match', ['get', 'brunnel'], 'tunnel', 0.55, 1] },
  });
  add({
    id: 'city-path', type: 'line', 'source-layer': 'transportation', minzoom: 14, filter: cls('path', 'track'),
    paint: { 'line-color': '#a08a70', 'line-width': W([[14, 0.6], [17, 1.6]]), 'line-dasharray': [2, 1.5] },
  });

  // Railways (grey and white), metro (purple), tram (thin).
  const rail = ['all', ['==', ['get', 'class'], 'rail']];
  const metro = ['all', ['==', ['get', 'class'], 'transit'], ['match', ['get', 'subclass'], ['subway', 'light_rail', 'monorail', 'funicular'], true, false]];
  add({
    id: 'city-rail', type: 'line', 'source-layer': 'transportation', minzoom: 10, filter: rail,
    paint: { 'line-color': '#7a7a7a', 'line-width': W([[10, 1.2], [14, 2.6], [17, 5]]) },
  });
  add({
    id: 'city-rail-dash', type: 'line', 'source-layer': 'transportation', minzoom: 12, filter: rail,
    paint: { 'line-color': '#ffffff', 'line-width': W([[12, 0.6], [14, 1.4], [17, 3]]), 'line-dasharray': [3, 3] },
  });
  add({
    id: 'city-metro', type: 'line', 'source-layer': 'transportation', minzoom: 10, filter: metro,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#8b3fb5', 'line-width': W([[10, 1.4], [14, 3], [17, 6]]), 'line-opacity': ['match', ['get', 'brunnel'], 'tunnel', 0.6, 1] },
  });
  add({
    id: 'city-tram', type: 'line', 'source-layer': 'transportation', minzoom: 12,
    filter: ['all', ['==', ['get', 'class'], 'transit'], ['==', ['get', 'subclass'], 'tram']],
    paint: { 'line-color': '#b5487f', 'line-width': W([[12, 0.8], [17, 2.5]]) },
  });

  // Buildings: flat, or raised to their height in 3D.
  add({
    id: 'city-buildings', type: 'fill', 'source-layer': 'building', minzoom: 13,
    paint: { 'fill-color': '#ddd3c8', 'fill-outline-color': '#c4b7a8', 'fill-opacity': W([[13, 0.5], [15, 0.9]]) },
  });
  add({
    id: 'city-buildings-3d', type: 'fill-extrusion', 'source-layer': 'building', minzoom: 13,
    filter: ['!=', ['get', 'hide_3d'], true],
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#e2d8cc', 40, '#cfc2b2', 150, '#b3a28f'],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.92,
    },
  });

  // Labels: street names and numbers, stations, places, points of interest.
  add({
    id: 'city-road-names', type: 'symbol', 'source-layer': 'transportation_name', minzoom: 13,
    filter: ['has', 'name'],
    layout: {
      'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': ['OpenSans-Regular'],
      'text-size': W([[13, 10], [17, 13]]), 'text-max-angle': 30, 'text-padding': 4,
    },
    paint: { 'text-color': '#4a3d2e', ...halo },
  }, labelsBefore);
  add({
    id: 'city-road-refs', type: 'symbol', 'source-layer': 'transportation_name', minzoom: 11,
    filter: ['all', ['has', 'ref'], cls('motorway', 'trunk', 'primary')],
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 300, 'text-field': ['get', 'ref'], 'text-font': ['OpenSans-Bold'],
      'text-size': 10.5, 'text-rotation-alignment': 'viewport',
    },
    paint: { 'text-color': '#7a2e0b', 'text-halo-color': '#fff6e0', 'text-halo-width': 2.2 },
  }, labelsBefore);
  const station = ['all', ['==', ['get', 'class'], 'railway']];
  add({
    id: 'city-stations', type: 'circle', 'source-layer': 'poi', minzoom: 11, filter: station,
    paint: {
      'circle-radius': W([[11, 2.5], [15, 5]]), 'circle-color': '#ffffff', 'circle-stroke-width': 2,
      'circle-stroke-color': ['match', ['get', 'subclass'], ['subway', 'light_rail', 'monorail'], '#8b3fb5', 'tram_stop', '#b5487f', '#555555'],
    },
  }, labelsBefore);
  add({
    id: 'city-station-names', type: 'symbol', 'source-layer': 'poi', minzoom: 12.5, filter: station,
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': ['OpenSans-Semibold'], 'text-size': 11,
      'text-anchor': 'top', 'text-offset': [0, 0.6], 'text-max-width': 8, 'text-optional': true,
    },
    paint: { 'text-color': '#3c2a4d', ...halo },
  }, labelsBefore);
  add({
    id: 'city-places', type: 'symbol', 'source-layer': 'place', minzoom: 11,
    filter: cls('suburb', 'quarter', 'neighbourhood', 'town', 'village', 'hamlet', 'island'),
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': ['OpenSans-Semibold'],
      'text-size': ['match', ['get', 'class'], ['suburb', 'town'], 13, 11], 'text-transform': 'uppercase',
      'text-letter-spacing': 0.06, 'text-max-width': 8, 'text-padding': 8,
    },
    paint: { 'text-color': '#5b5146', ...halo },
  }, labelsBefore);
  const POI_COLOUR = ['match', ['get', 'class'], 'hospital', '#d64545', ['school', 'college', 'library'], '#9a7a1f',
    'place_of_worship', '#7a5c99', ['bus', 'ferry_terminal', 'harbor', 'aerialway'], '#2b6cb0', ['park', 'garden', 'campsite'], '#3f8f3f',
    ['shop', 'grocery', 'clothing_store', 'alcohol_shop'], '#c06a2b', ['restaurant', 'fast_food', 'cafe', 'bar', 'beer'], '#c0392b',
    ['lodging'], '#2c7a7b', ['fuel', 'parking', 'car'], '#555555', ['police', 'fire_station', 'town_hall', 'post'], '#34495e', '#6b7280'];
  const poi = ['all', ['!=', ['get', 'class'], 'railway'], ['has', 'name']];
  add({
    id: 'city-poi', type: 'circle', 'source-layer': 'poi', minzoom: 14, filter: poi,
    paint: { 'circle-radius': 3.2, 'circle-color': POI_COLOUR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
  }, labelsBefore);
  add({
    id: 'city-poi-names', type: 'symbol', 'source-layer': 'poi', minzoom: 15, filter: poi,
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': ['OpenSans-Regular'], 'text-size': 10.5,
      'text-anchor': 'top', 'text-offset': [0, 0.5], 'text-max-width': 8, 'text-optional': true,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
    },
    paint: { 'text-color': POI_COLOUR, ...halo },
  }, labelsBefore);
  add({
    id: 'city-airports', type: 'symbol', 'source-layer': 'aerodrome_label', minzoom: 9,
    layout: {
      'text-field': ['concat', '✈ ', ['coalesce', ['get', 'name_en'], ['get', 'name']], ['case', ['has', 'iata'], ['concat', ' (', ['get', 'iata'], ')'], '']],
      'text-font': ['OpenSans-Semibold'], 'text-size': 12, 'text-max-width': 10,
    },
    paint: { 'text-color': '#3d4a7a', ...halo },
  }, labelsBefore);
  add({
    id: 'city-housenumbers', type: 'symbol', 'source-layer': 'housenumber', minzoom: 17,
    layout: { 'text-field': ['get', 'housenumber'], 'text-font': ['OpenSans-Regular'], 'text-size': 9.5 },
    paint: { 'text-color': '#8a7b6a', ...halo },
  }, labelsBefore);
}

// 3D: tilt and turn the map, raise the buildings, add hills. Terrain from the
// open terrain tiles on AWS (Mapzen/Tilezen), online only.
export function setup3D(map, button, onChange) {
  let on = false;
  let demAdded = false;
  const set = (value) => {
    on = value;
    button.setAttribute('aria-pressed', String(on));
    button.classList.toggle('active', on);
    if (on) {
      if (!demAdded) {
        map.addSource('dem', {
          type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14,
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          attribution: 'Terrain: Mapzen / AWS Open Data',
        });
        demAdded = true;
      }
      if (navigator.onLine !== false) map.setTerrain({ source: 'dem', exaggeration: 1.5 });
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
      map.easeTo({ pitch: 60, bearing: map.getBearing() || -15, zoom: Math.max(map.getZoom(), 14.5), duration: 1200 });
    } else {
      map.setTerrain(null);
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.touchPitch.disable();
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    }
    onChange(on);
  };
  button.onclick = () => set(!on);
  return { isOn: () => on };
}
