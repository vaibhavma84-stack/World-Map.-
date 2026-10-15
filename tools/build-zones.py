"""Regulatory sea areas into data/zones.json:

  * Emission control areas (MARPOL Annex VI): the North American, US
    Caribbean, Baltic and North Sea ECAs from Marine Regions (CC BY 4.0,
    tools/sources/mr-eca_*.geojson), and the Mediterranean SOx ECA (in force
    1 May 2025), drawn here from its definition.
  * MARPOL special areas (Annexes I, II, IV and V), drawn from the
    definitions in the Annexes.
  * Load line zones, areas and seasonal periods: Annex II of the Load Lines
    Convention 1966, as reproduced in 46 CFR 42.30
    (tools/sources/cfr-42.30-2024.xml).

    python3 tools/build-zones.py

Boundaries that follow a coast are drawn across the land and the land cut
away (Natural Earth, as on the map), so they follow the map's coast. Rhumb
lines are drawn as rhumb lines. Positions named only by a place (a cape, a
port) are taken to the nearest minute or so: approximate, not for
navigation. Check against the official charts (e.g. BA D6083 for load line
zones) and the current Convention texts.
"""
import json
import math
import os

import shapely
from shapely.geometry import Polygon, MultiPolygon, box, mapping, shape

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'tools', 'sources')


def dm(d, m=0.0):
    """Degrees and minutes to decimal degrees (sign from the degrees)."""
    return math.copysign(abs(d) + m / 60, d if d != 0 else 1)


def merc(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(max(min(lat, 89.5), -89.5)) / 2))


def unmerc(y):
    return math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)


def rhumb(a, b, step=0.5):
    """Points along the rhumb line a→b (a straight line on a Mercator chart)."""
    (x0, y0), (x1, y1) = a, b
    n = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) / step))
    m0, m1 = merc(y0), merc(y1)
    return [(x0 + (x1 - x0) * i / n, unmerc(m0 + (m1 - m0) * i / n)) for i in range(n)]


def ring(*legs):
    """A ring from legs: each leg is a point (joined to the next by a rhumb
    line, which along a parallel or meridian is that parallel or meridian)."""
    pts = []
    for i, p in enumerate(legs):
        q = legs[(i + 1) % len(legs)]
        pts.extend(rhumb(p, q))
    return pts


def wrap(geom):
    """Bring longitudes outside ±180 back into range, cutting at the line."""
    parts = []
    for k in range(-2, 3):
        piece = shapely.clip_by_rect(geom, -180 + 360 * k, -90, 180 + 360 * k, 90)
        if not piece.is_empty:
            parts.append(shapely.affinity.translate(piece, -360 * k, 0))
    return shapely.make_valid(shapely.union_all(parts))


def poly(*legs):
    return wrap(shapely.make_valid(Polygon(ring(*legs))))


# ------------------------------------------------------------------- land
countries = json.load(open(os.path.join(ROOT, 'data', 'countries.json')))
lakes = json.load(open(os.path.join(ROOT, 'data', 'lakes.json')))
LAND = shapely.union_all([shapely.make_valid(shape(f['geometry'])) for f in countries['features']]
                         + [shapely.make_valid(shape(f['geometry'])) for f in lakes['features']])
shapely.prepare(LAND)


def sea(geom):
    return shapely.make_valid(geom.difference(LAND))


# ===================================================== MARPOL special areas
SKAW = dm(57, 44.8)
BALTIC = poly((10.6, SKAW), (11.9, SKAW), (12.6, 58.5), (14.5, 61), (18, 64.5), (21, 66.5), (26.5, 66.5),
              (30.4, 64), (30.4, 53.0), (9.4, 53.0), (9.2, 54.5), (9.6, 56.4), (10.3, 57.4))
NORTH_SEA = poly((-4, 62), (5.0, 62), (8, 59), (10.6, SKAW), (10.3, 57.4), (9.6, 56.4), (9.2, 54.5), (9.4, 53.0),
                 (3, 50.5), (0, 49.0), (-1.5, 48.5), (-5, 48.5), (-5, 50.2), (-3.5, 51.8), (-5, 54.8), (-4.8, 57.5), (-4, 58.6))
MED = poly((dm(-5, 36), 36.5), (dm(-5, 36), 35.5), (-2, 34.5), (10, 32.5), (20, 30.0), (30, 30.5), (36.5, 35),
           (36.5, 37.0), (28, 40.4), (26.5, 41.0), (29.5, 41.0), (26.0, 41.5), (20, 42.5), (10, 44.6), (3, 43.0), (-4, 37.3))
BLACK = poly((27.0, 41.0), (29.5, 41.0), (42.0, 41.0), (42.0, 47.5), (27.0, 47.5))
RAS_SI_ANE, HUSN_MURAD = (dm(43, 19.6), dm(12, 28.5)), (dm(43, 30.2), dm(12, 40.4))
RED = poly(RAS_SI_ANE, HUSN_MURAD, (43.9, 14), (40.5, 20), (37.5, 25), (35.5, 28.5), (35.2, 30.5), (34.5, 31.0),
           (33.0, 30.5), (32.4, 31.2), (32.0, 29.8), (33.5, 26.5), (36.0, 21.0), (39.0, 15.5), (42.4, 12.6))
RAS_ASIR, RAS_FARTAK = (dm(51, 16.9), dm(11, 50)), (dm(52, 13.8), dm(15, 35))
ADEN = poly(HUSN_MURAD, RAS_SI_ANE, (42.6, 11.3), (44.0, 10.2), (47.0, 10.6), RAS_ASIR, RAS_FARTAK, (50.0, 15.6), (46.0, 13.5))
RAS_AL_HADD, RAS_AL_FASTEH = (dm(59, 48), dm(22, 30)), (dm(61, 25), dm(25, 4))
GULFS = poly(RAS_AL_HADD, RAS_AL_FASTEH, (61.5, 26.5), (56, 28.5), (50, 31.5), (47.3, 30.5), (47.5, 28.0),
             (50.5, 24.0), (54, 23.5), (56.5, 23.0))
OMAN = poly(RAS_AL_HADD, (63.0, dm(23, 47.27)), (63.0, 22.0), (dm(57, 13.88), dm(16, 3.98)), (dm(53, 14.32), dm(16, 53.5)),
            (53.0, 17.5), (56.5, 19.5), (58.5, 21.5))
NWEU = poly((-4.2, dm(48, 27)), (dm(-6, 25), dm(48, 27)), (dm(-7, 44), dm(49, 52)), (-12, 50.5), (-12, 56.5), (-3, 62),
            (5.0, 62), (8, 59), (10.6, SKAW), (10.3, 57.4), (9.6, 56.4), (9.2, 54.5), (9.4, 53.0), (3, 50.5), (0, 49.0), (-1.5, 48.3))
SSA = poly((dm(17, 27), dm(-31, 14)), (dm(17, 12), dm(-31, 30)), (dm(17, 6), dm(-32, 0)), (dm(16, 52), dm(-32, 32)),
           (dm(17, 24), dm(-34, 6)), (dm(20, 54), dm(-36, 58)), (dm(22, 30), dm(-36, 0)), (dm(22, 54), dm(-35, 14)),
           (dm(26, 0), dm(-34, 30)), (dm(27, 25), dm(-33, 48)), (27.0, -33.0), (20.0, -33.0), (18.5, -31.0))
ANTARCTIC = shapely.box(-180, -90, 180, -60)
CARIB = poly((-81.2, 30.0), (dm(-77, 30), 30.0), (-59.0, 20.0), (-50.0, dm(7, 20)), (-54.0, 5.0), (-62, 7.0), (-75, 8.5),
             (-80, 8.0), (-83, 9.5), (-85, 13), (-90, 15.5), (-91, 18.5), (-97, 22), (-97, 28), (-94, 30.2), (-89, 30.6),
             (-84, 30.4), (-81.3, 31.0))

MARPOL = [
    ('Mediterranean Sea', MED, 'I, V', ''),
    ('Baltic Sea', BALTIC, 'I, IV, V', 'Annex IV: no sewage from passenger ships unless treated by an approved plant (nutrient removal).'),
    ('Black Sea', BLACK, 'I, V', ''),
    ('Red Sea', RED, 'I, V', ''),
    ('Gulfs area', GULFS, 'I, V', 'North-west of the line Ras al Hadd – Ras al Fasteh.'),
    ('Gulf of Aden', ADEN, 'I', ''),
    ('Oman area of the Arabian Sea', OMAN, 'I', ''),
    ('North West European waters', NWEU, 'I', ''),
    ('Southern South African waters', SSA, 'I', ''),
    ('North Sea', NORTH_SEA, 'V', ''),
    ('Wider Caribbean Region', CARIB, 'V', 'Gulf of Mexico, Caribbean Sea and the Atlantic within the boundary.'),
    ('Antarctic area', ANTARCTIC, 'I, II, V', 'South of 60°S. No oil, noxious liquid or (almost any) garbage discharge; heavy fuel oil banned.'),
]
RULES = {
    'I': 'Annex I (oil): no discharge of oil or oily mixtures from the cargo area of oil tankers; machinery-space bilge only through approved 15 ppm equipment with alarm and automatic stop, en route.',
    'II': 'Annex II (noxious liquids): no discharge of noxious liquid substances or mixtures.',
    'IV': 'Annex IV (sewage).',
    'V': 'Annex V (garbage): food waste only, en route, at least 12 nm from nearest land (comminuted ≤25 mm; Wider Caribbean: 3 nm if comminuted); all other garbage prohibited, cargo residues only under strict conditions.',
}

# ========================================================== emission control
ECA = []


def mr(name):
    path = os.path.join(SRC, f'mr-eca_{name}.geojson')
    return json.load(open(path))['features'] if os.path.exists(path) else []


nox = {f['properties']['area']: shapely.make_valid(shape(f['geometry'])) for f in mr('reg13_nox')}
for f in mr('reg14_sox_pm'):
    area = f['properties']['area']
    g = shapely.make_valid(shape(f['geometry']))
    name = area.replace(' sea area', '').replace(' area', '')
    if name.startswith('North American'):
        x = g.centroid.x  # the three parts, told apart by where they lie
        name = 'North American ECA (' + ('Hawaii' if x < -140 else 'Pacific' if x < -100 else 'Atlantic and Gulf') + ')'
    else:
        name = {'United States Caribbean': 'US Caribbean ECA', 'Baltic Sea': 'Baltic Sea ECA',
                'North Sea': 'North Sea ECA'}.get(name, f'{name} ECA')
    tier3 = '2016-01-01' if 'American' in name or 'Caribbean' in name else '2021-01-01'
    has_nox = area in nox or 'Baltic' in area or 'North Sea' in area
    ECA.append((name, g, 'SOx, PM' + (', NOx' if has_nox else ''), tier3 if has_nox else ''))
ECA.append(('Mediterranean Sea ECA', MED, 'SOx, PM', ''))

# ================================================================ load lines
def coastless(*legs):
    return poly(*legs)


TORINANA = (-9.30, 43.06)
ZONE_I = poly((-50, 89.9), (-50, 45), (-15, 45), (-15, 60), (0, 60), (0, 89.9))
NA_AREA = poly((-68.5, 46.5), (-68.5, 40), (-61.0, 45.55), (-61.6, 45.4), (-63.3, 45.3), (-64.6, 45.9), (-66.5, 46.4))
US_SMALL = poly((-68.5, 46.5), (-68.5, 40), (-73, 36), (-75.9, 36), (-78, 37.5), (-76, 43), (-71, 45.5))
ZONE_II = shapely.make_valid(poly((-68.5, 46.5), (-68.5, 40), (-73, 36), (-25, 36), TORINANA, (-3, 42.5), (10, 46),
                                  (25, 52), (45, 58), (60, 66), (60, 89.9), (-100, 89.9), (-100, 60), (-85, 50), (-74, 45.5))
                             .difference(ZONE_I).difference(NA_AREA).difference(BALTIC))
NP_WINTER = poly((140.4, 50), (142.0, 50), (dm(142, 5), 45.9), (141.67, 45.41), (142.5, 44.0), (143.8, 43.3), (145, 43.05),
                 (145, 35), (210, 35), (227.31, 54.66), (226, 56), (219, 60), (191, 66.5), (180, 66.5), (170, 66),
                 (160, 62), (140, 58), (135, 55), (138.5, 51))
SOUTHERN = poly((-65.87, -47.1), (-50, -34), (17, -34), (20, dm(-35, 10)), (28, -34), (118, dm(-35, 30)), (144.68, -40.68),
                (146.5, -41.8), (147.3, -43.5), (167.6, -46.95), (170, -47), (190, -33), (288.4, -33), (290, -38),
                (291, -46), (294.13, -47.1), (294.13, -89.9), (-65.87, -89.9))
# The Tropical Zone: south of its northern boundary, less what lies south of
# its southern boundary (each a ring right round the world, joined across land).
T_NORTH = [(-83.5, 13), (-60, 13), (-58, 10), (-20, 10), (-20, 30), (-9.7, 30), (10, 28), (30, 15), (40, 9), (49.8, 8),
           (70, 8), (70, 13), (74.7, 13), (77.5, 11.2), (79.85, 10.5), (82, 9), (82, 8), (98.3, 8), (99.5, 12),
           (101, 14), (104, 12), (106.3, 10.6), (106.75, 10), (145, 10), (145, 13), (272.35, 13), (272.6, 13.3),
           (276, 13.3), (276.5, 13)]
T_SOUTH = [(-46.33, -23.96), (-40, -23.44), (14.5, -23.44), (25, -22), (34.8, -20), (44.3, -20), (46, -17), (48.8, -14.2),
           (50, -15), (50, -10), (98, -10), (130.85, -12.46), (133, -12.5), (135.5, -12), (136.75, -10.98),
           (142.45, -11), (142.6, -11), (210, -11), (285, -26), (288.5, -30), (298, -27), (305, -25.5), (313.67, -23.96)]
south_of_north = poly(*T_NORTH, (276.5, -89.9), (-83.5, -89.9))
south_of_south = poly(*T_SOUTH, (313.67, -89.9), (-46.33, -89.9))
TROP_RED = poly((32.3, 31.3), (33.0, 30.5), (35.5, 29.0), (37, 26), (40, 21), (44, 15), (45, 13.0), (45, 10.3),
                (44, 10), (42.5, 11.0), (38, 15), (35, 22), (33, 27), (32.0, 29.9))
TROP_GULF = poly((47, 31), (59, 27), (59, 22.3), (55, 22), (47, 26))
GBR_REEF = [(143.6, -11.0), (144.0, -12.5), (144.0, -14.0), (145.8, -16.0), (146.8, -17.5), (147.6, -18.5), (149.0, -19.5),
            (150.5, -20.5), (151.8, -21.5), (152.6, -22.0)]
TROP_GBR = poly((142.6, -11), *GBR_REEF, (149.6, -22.0), (147, -20), (145, -16), (143, -12))
TROPICAL = shapely.union_all([south_of_north.difference(south_of_south), TROP_RED, TROP_GULF, TROP_GBR])


def lat_on(a, b, lat):
    """Longitude where the rhumb line a→b reaches latitude lat."""
    t = (merc(lat) - merc(a[1])) / (merc(b[1]) - merc(a[1]))
    return a[0] + (b[0] - a[0]) * t


x20 = lat_on((210, -11), (285, -26), -20)
SEASONAL = [
    ('North Atlantic', poly((-86.8, 21.6), (-84.95, 21.87), (-80, 22.4), (-77, 21.2), (-74.15, 20.0), (-20, 20), (-20, 10),
                            (-58, 10), (-60, 13), (-83.5, 13), (-84, 15), (-88.6, 17.5), (-88.5, 20.5)),
     [('T', '11-01', '07-15'), ('S', '07-16', '10-31')]),
    ('Arabian Sea', poly((49.8, 8), (70, 8), (70, 13), (74.7, 13), (76, 21), (70.5, 25), (66, 27), (59, 25.8), (59, 22.0),
                         (52, 18), (45, 14), (45, 10.4), (45, 9)),
     [('T', '09-01', '05-31'), ('S', '06-01', '08-31')]),
    ('Bay of Bengal', poly((79.85, 10.5), (82, 9), (82, 8), (98.3, 8), (98.6, 10), (99, 15), (95, 25), (85, 24), (79.5, 16)),
     [('T', '12-01', '04-30'), ('S', '05-01', '11-30')]),
    ('South Indian Ocean (Madagascar)', poly((50, -10), (51.5, -10), (51.5, -15), (50, -20), (47.5, -20), (49.5, -15.5), (50, -15)),
     [('T', '04-01', '11-30'), ('S', '12-01', '03-31')]),
    ('South Indian Ocean (east)', poly((51.5, -10), (98, -10), (130.85, -12.46), (130, -14), (125, -17), (120, -20.5),
                                       (120, -15), (51.5, -15)),
     [('T', '05-01', '11-30'), ('S', '12-01', '04-30')]),
    ('China Sea', poly((106.75, 10), (124.9, 10), (125.0, 11.5), (124.4, 12.5), (123.0, 13.6), (122.2, 13.9), (121.3, 15.0),
                       (120.5, 16.0), (120.1, 16.07), (114.17, 22.28), (110, 23), (105.5, 21), (105.5, 15), (105, 12)),
     [('T', '01-21', '04-30'), ('S', '05-01', '01-20')]),
    ('North Pacific (central)', poly((160, 25), (230, 25), (230, 13), (160, 13)),
     [('T', '04-01', '10-31'), ('S', '11-01', '03-31')]),
    ('North Pacific (Mexico)', poly((-123, 38.3), (-123, 33), (-105, 13), (-87.65, 13), (-90, 16), (-100, 20), (-106, 27),
                                    (-112, 32.5), (-116, 34), (-121, 38.5)),
     [('T', '03-01', '06-30'), ('S', '07-01', '10-31'), ('T', '11-01', '11-30'), ('S', '12-01', '02-29')]),
    ('Gulf of Carpentaria', poly((136.75, -11), (142.45, -11), (142, -18.5), (141, -18.5), (138, -17.5), (134, -14)),
     [('T', '04-01', '11-30'), ('S', '12-01', '03-31')]),
    ('South Pacific (Coral Sea)', poly((143.6, -11.0), (210, -11), *rhumb((210, -11), (x20, -20))[1:], (x20, -20), (210, -20),
                                       (210, -23.44), (150.8, -23.44), (149.6, -22.0), (152.6, -22.0), *reversed(GBR_REEF[:-1])),
     [('T', '04-01', '11-30'), ('S', '12-01', '03-31')]),
]
for i, (name, g, periods) in enumerate(SEASONAL):
    SEASONAL[i] = (name, shapely.make_valid(g.difference(TROPICAL)), periods)

LOAD = [
    ('Tropical Zone', TROPICAL, 'tropical', [('T', '01-01', '12-31')], False,
     'Includes the Suez Canal, Red Sea and Gulf of Aden to 45°E, the Persian Gulf to 59°E, and the Great Barrier Reef area.'),
    *[(f'Seasonal Tropical Area: {n}', g, 'seasonal', p, False, '') for n, g, p in SEASONAL],
    ('North Atlantic Winter Seasonal Zone I', ZONE_I, 'winter', [('W', '10-16', '04-15'), ('S', '04-16', '10-15')], False,
     'Winter North Atlantic (WNA) load line applies here to ships of 100 m and under.'),
    ('North Atlantic Winter Seasonal Zone II', ZONE_II, 'winter', [('W', '11-01', '03-31'), ('S', '04-01', '10-31')], False,
     'WNA load line (ships of 100 m and under) applies between 15°W and 50°W.'),
    ('North Atlantic Winter Seasonal Area', NA_AREA, 'winter',
     [('W', '12-16', '02-15'), ('S', '02-16', '12-15')], False,
     'Ships of 100 m and under: Winter 1 Nov – 31 Mar, Summer 1 Apr – 31 Oct.'),
    ('North Pacific Winter Seasonal Zone', NP_WINTER, 'winter', [('W', '10-16', '04-15'), ('S', '04-16', '10-15')], False, ''),
    ('Southern Winter Seasonal Zone', SOUTHERN, 'winter', [('W', '04-16', '10-15'), ('S', '10-16', '04-15')], False,
     'Boundary as in the 1966 Convention text; the part off Australia was amended (2014): check the current chart.'),
    ('Summer Zone: Winter Seasonal Area (US east coast)', US_SMALL, 'small', [('W', '11-01', '03-31'), ('S', '04-01', '10-31')], True, ''),
    ('Baltic Sea (Summer Zone)', BALTIC, 'small', [('W', '11-01', '03-31'), ('S', '04-01', '10-31')], True, ''),
    ('Black Sea north of 44°N (Summer Zone)', poly((27, 44), (42, 44), (42, 48), (27, 48)), 'small',
     [('W', '12-01', '02-29'), ('S', '03-01', '11-30')], True, ''),
    ('Mediterranean: Gulf of Lion area (Summer Zone)', poly((3.0, 41.8), (3.0, 40.0), (8.4, 40.0), (8.6, 40.5), (9.0, 41.1),
                                                           (9.0, 41.4), (8.9, 42.0), (9.0, 42.7), (5.86, 43.05), (4, 44), (2.5, 42.5)),
     'small', [('W', '12-16', '03-15'), ('S', '03-16', '12-15')], True, ''),
    ('Sea of Japan (Summer Zone)', poly((128.6, 38), (140.35, 43.2), (142.2, 44.5), (142.0, 45.5), (142.3, 47), (142.2, 50),
                                       (140.4, 50), (135, 45), (129.5, 42), (128.0, 38.5)),
     'small', [('W', '12-01', '02-29'), ('S', '03-01', '11-30')], True, ''),
]


# ================================================================== output
def simple(g, tol):
    g = shapely.make_valid(shapely.simplify(g, tol, preserve_topology=True))
    polys = [p for p in getattr(g, 'geoms', [g]) if isinstance(p, (Polygon, MultiPolygon)) and p.area > tol * tol * 4]
    return shapely.union_all(polys) if polys else None


def rounded(geom):
    def r(c):
        return [[round(x, 4), round(y, 4)] for x, y in c]
    m = mapping(geom)
    if m['type'] == 'Polygon':
        m['coordinates'] = [r(c) for c in m['coordinates']]
    elif m['type'] == 'MultiPolygon':
        m['coordinates'] = [[r(c) for c in p] for p in m['coordinates']]
    return m


features = []


def add(kind, name, geom, tol, **props):
    g = simple(sea(geom), tol)
    if g is None or g.is_empty:
        print(f'  (empty) {name}')
        return
    features.append({'type': 'Feature', 'properties': {'k': kind, 'name': name, **props}, 'geometry': rounded(g)})


for name, g, which, tier3 in ECA:
    add('eca', name, g, 0.02, controls=which, tier3=tier3)
for name, g, annexes, note in MARPOL:
    add('marpol', name, g, 0.02, annexes=annexes, rules=[RULES[a.strip()] for a in annexes.split(',')], note=note)
for name, g, kind, periods, small, note in LOAD:
    add('ll', name, g, 0.02, zone=kind, periods=[list(p) for p in periods], small=small, note=note)

out = {'type': 'FeatureCollection', 'features': features}
path = os.path.join(ROOT, 'data', 'zones.json')
with open(path, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print(f'data/zones.json: {len(features)} areas, {os.path.getsize(path) / 1e6:.1f} MB')
