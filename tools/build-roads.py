"""Major roads and cities for the whole world, into data/roads.json and
data/cities.json, for use offline:

  * roads: Natural Earth 10m roads (motorways and main highways, with lesser
    roads in thinly-roaded countries), kind and the zoom they appear at;
  * cities: Natural Earth populated places of 100,000 people or more, and
    every capital, with population and the zoom they appear at.

    python3 tools/build-roads.py

Reads tools/.cache/ne_10m_roads.geojson and ne_10m_populated_places_simple.geojson
(Natural Earth, public domain; downloaded if missing).
"""
import json
import os
import urllib.request

import shapely
from shapely.geometry import mapping, shape

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'tools', '.cache')
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'


def load(name):
    path = os.path.join(CACHE, f'{name}.geojson')
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        urllib.request.urlretrieve(NE + f'{name}.geojson', path)
    return json.load(open(path))['features']


def rounded(geom, places=3):
    m = mapping(geom)
    r = lambda cs: [[round(x, places), round(y, places)] for x, y in cs]  # noqa: E731
    if m['type'] == 'LineString':
        m['coordinates'] = r(m['coordinates'])
    else:
        m['coordinates'] = [r(c) for c in m['coordinates']]
    return m


# Kinds: 1 motorway / major highway (incl. beltways and bypasses), 2 secondary
# highway, 3 other main road. Ferries and tracks are left out.
KIND = {'Major Highway': 1, 'Beltway': 1, 'Bypass': 1, 'Secondary Highway': 2, 'Road': 3, 'Unknown': 3}
roads = []
for f in load('ne_10m_roads'):
    p = f['properties']
    kind = KIND.get(p.get('type'))
    if not kind or not f['geometry']:
        continue
    g = shapely.simplify(shape(f['geometry']), {1: 0.004, 2: 0.006, 3: 0.01}[kind], preserve_topology=False)
    if g.is_empty or g.length == 0:
        continue
    props = {'k': kind, 'z': round(min(p.get('min_zoom') or 5, 9), 1)}
    if p.get('label') or p.get('name'):
        props['n'] = p.get('label') or p.get('name')
    roads.append({'type': 'Feature', 'properties': props, 'geometry': rounded(g)})

cities = []
for f in load('ne_10m_populated_places_simple'):
    p = f['properties']
    pop = p.get('pop_max') or 0
    capital = (p.get('adm0cap') or 0) >= 1
    if pop < 100000 and not capital:
        continue
    props = {'n': p['name'], 'p': int(pop), 'z': round(p.get('min_zoom') or 6, 1), 'cap': 1 if capital else 0}
    cities.append({'type': 'Feature', 'properties': props,
                   'geometry': {'type': 'Point', 'coordinates': [round(p['longitude'], 4), round(p['latitude'], 4)]}})
cities.sort(key=lambda c: -c['properties']['p'])

for name, feats in (('roads', roads), ('cities', cities)):
    path = os.path.join(ROOT, 'data', f'{name}.json')
    with open(path, 'w') as out:
        json.dump({'type': 'FeatureCollection', 'features': feats}, out, separators=(',', ':'))
    print(f'data/{name}.json: {len(feats):,} features, {os.path.getsize(path) / 1e6:.1f} MB')
