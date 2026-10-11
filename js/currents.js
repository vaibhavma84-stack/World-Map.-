// The great ocean currents, as drawn on pilot charts: rough centre lines and
// their usual rate. They move with the seasons and wander; for the actual
// set and drift on the day, turn on the live current layer.
// [name, warm?, usual rate, note, [[lon, lat], ...] in the direction of flow]

export const CURRENTS = [
  // North Atlantic
  ['Gulf Stream', true, '2–4 kn, up to 5', '', [[-81, 24.5], [-80, 25.5], [-79.8, 28], [-79.4, 31], [-77.5, 33], [-75, 35], [-72, 37], [-67, 39], [-60, 40], [-50, 41]]],
  ['Florida Current / Loop Current', true, '1.5–3 kn', '', [[-86, 21], [-87, 24], [-85, 25], [-83, 24.2], [-81, 24.3]]],
  ['North Atlantic Drift', true, '0.5–1 kn', '', [[-50, 41.5], [-40, 45], [-30, 50], [-20, 54], [-12, 58], [-5, 62], [2, 66]]],
  ['Canary Current', false, '0.5–1 kn', '', [[-12, 42], [-12, 36], [-14, 30], [-18, 24], [-20, 18]]],
  ['North Equatorial Current (Atlantic)', true, '0.5–1 kn', '', [[-22, 15], [-35, 15], [-50, 15], [-60, 16]]],
  ['Caribbean Current', true, '1–2 kn', '', [[-60, 12.5], [-70, 14], [-80, 15.5], [-85, 19]]],
  ['North Brazil Current', true, '1.5–2.5 kn', '', [[-34, -5], [-44, -1], [-50, 4], [-55, 7.5], [-59, 10.5]]],
  ['Labrador Current', false, '0.5–1 kn', '', [[-62, 62], [-58, 57], [-53, 52], [-50, 47], [-50, 43]]],
  ['East Greenland Current', false, '0.5–1 kn', '', [[-12, 75], [-20, 70], [-32, 66], [-42, 61]]],
  // South Atlantic
  ['South Equatorial Current (Atlantic)', true, '0.5–1.5 kn', '', [[8, 0], [-10, -1], [-25, -2], [-33, -4]]],
  ['Guinea Current', true, '0.5–1.5 kn', '', [[-15, 5], [-5, 4.5], [3, 4], [8, 3]]],
  ['Brazil Current', true, '0.5–1 kn', '', [[-34, -8.5], [-37.5, -15], [-40, -22], [-47, -30], [-54, -38]]],
  ['Falkland (Malvinas) Current', false, '0.5–1 kn', '', [[-64, -55], [-60, -50], [-58, -45], [-56, -40]]],
  ['Benguela Current', false, '0.5–1 kn', '', [[17, -34], [14, -28], [12, -22], [10, -16]]],
  // Indian Ocean
  ['Agulhas Current', true, '2–4 kn, up to 5', 'Freak waves where it meets a south-westerly gale.', [[34, -26], [32.5, -30], [28.5, -33], [25, -35], [21, -37]]],
  ['Mozambique Current', true, '1–2 kn', '', [[42, -12], [40, -18], [36, -24], [34, -26]]],
  ['South Equatorial Current (Indian)', true, '0.5–1 kn', '', [[110, -10], [90, -12], [70, -14], [55, -15], [49, -14]]],
  ['Somali Current', true, '2–5 kn in the SW monsoon', 'Runs north June–September; weak and reversed in the NE monsoon.', [[41, -2], [45, 2], [49, 6], [51.5, 10]]],
  ['Leeuwin Current', true, '0.5–1.5 kn', '', [[113.5, -22], [113, -28], [114.5, -33], [117, -35], [122, -35]]],
  ['West Australian Current', false, '0.3–0.7 kn', '', [[110, -35], [109, -28], [108, -20]]],
  // Pacific
  ['Kuroshio', true, '2–4 kn', '', [[122, 22], [123, 25], [127, 28], [131, 31], [135, 33], [139.5, 34.5], [142, 36], [146, 37]]],
  ['Oyashio', false, '0.5–1 kn', '', [[150, 45], [146, 42], [144, 40]]],
  ['North Pacific Current', true, '0.3–0.5 kn', '', [[146, 37.5], [160, 40], [180, 41], [200, 42], [220, 45]]],
  ['Alaska Current', true, '0.5–1 kn', '', [[220, 46], [225, 50], [223, 55], [215, 58], [205, 57]]],
  ['California Current', false, '0.5–1 kn', '', [[-127, 48], [-126, 42], [-123, 36], [-118, 30], [-113, 24]]],
  ['North Equatorial Current (Pacific)', true, '0.5–1.5 kn', '', [[-110, 20], [-140, 15], [-170, 14], [170 - 360, 14], [140 - 360, 13], [125 - 360, 13]]],
  ['Equatorial Counter Current (Pacific)', true, '0.5–1.5 kn', 'Runs east between the westward equatorial currents.', [[130, 6], [160, 6], [180, 6], [240, 6], [270, 6]]],
  ['South Equatorial Current (Pacific)', true, '0.5–1.5 kn', '', [[-85, -2], [-120, -3], [-160, -5], [-180, -8], [-200, -12], [-210, -14]]],
  ['East Australian Current', true, '1–3 kn', '', [[154, -15], [154.5, -24], [154, -28], [153.6, -32], [151.5, -36]]],
  ['Humboldt (Peru) Current', false, '0.5–1 kn', '', [[-76, -45], [-74, -35], [-72, -25], [-77, -15], [-82, -5]]],
  // Southern Ocean
  ['Antarctic Circumpolar Current', false, '0.5–1 kn', 'The West Wind Drift: eastward all the way round.', [[-180, -56], [-150, -57], [-120, -57], [-90, -57], [-70, -58], [-50, -52], [-20, -50], [0, -50], [30, -49], [60, -49], [90, -50], [120, -51], [150, -54], [180, -56]]],
];

export function currentFeatures() {
  return {
    type: 'FeatureCollection',
    features: CURRENTS.map(([name, warm, rate, note, line]) => ({
      type: 'Feature',
      properties: { name, warm, rate, note, label: `${name} · ${rate}` },
      geometry: { type: 'LineString', coordinates: line },
    })),
  };
}
