"""Detailed coastlines around every port, cut from OpenStreetMap's land polygons.

    python3 tools/build-coast.py [land-polygons.shp]

Natural Earth's world coastline is good to about a kilometre: fine for the
world, blocky in a harbour. OpenStreetMap's land polygons (osmdata.openstreetmap.de,
ODbL) are good to a few metres but come to about 800 MB for the world, so only
the area round each port is kept: 10 km round World Port Index ports, 8 km
round the rest.

Land polygons only part land from open sea; rivers, ship channels, docks and
lakes are mapped in OpenStreetMap as inland water. Those are taken from the
OpenFreeMap vector tiles (OpenMapTiles "water" layer, zoom 11, about 5 m) over the same
areas and cut out of the land.

Written to data/coast/, one file per 1° square that holds any of it:
  {lat}_{lon}.json  features with kind "mask" (the area this file covers in
                    detail), "land" (the land in it, with the colour of the
                    port's country, c) and "shore" (the shoreline, as lines)
  index.json        which squares exist, their sizes, and the build date

Runs on GitHub (see .github/workflows/coast.yml), which can download the source.
"""
import collections
import concurrent.futures
import gzip
import datetime
import json
import math
import os
import shutil
import sys
import urllib.request
import zipfile

import pyogrio
import shapely
from shapely import affinity
import mapbox_vector_tile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'tools', '.cache')
OUT = os.path.join(ROOT, 'data', 'coast')
SOURCE = 'https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip'

RADIUS_KM = {0: 10, 1: 10, 2: 10, 3: 10, 4: 8}  # by port rank; 4 = UN/LOCODE only
TOLERANCE = 0.00004  # degrees, about 4 m: under a pixel at harbour zoom
GRID = 1e-5          # coordinates kept to about 1 m


TILEJSON = 'https://tiles.openfreemap.org/planet'
WATER_Z = 11
UA = {'User-Agent': 'world-map-coast/1 (github.com/vaibhavma84-stack/World-Map.-)'}


def tiles_over(geom, z=WATER_Z):
    """The z/x/y tiles whose square meets the geometry."""
    n = 2 ** z
    x0, y0, x1, y1 = geom.bounds
    tx = lambda lon: int((lon + 180) / 360 * n)
    ty = lambda lat: int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    out = []
    for x in range(tx(x0), tx(x1) + 1):
        for y in range(ty(y1), ty(y0) + 1):
            if geom.intersects(tile_box(x, y, z)):
                out.append((x % n, y))
    return out


def tile_lonlat(x, y, z):
    n = 2 ** z
    return x / n * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))


def tile_box(x, y, z=WATER_Z):
    w, n_ = tile_lonlat(x, y, z)
    e, s = tile_lonlat(x + 1, y + 1, z)
    return shapely.box(w, s, e, n_)


def water_from_tile(data, x, y, z=WATER_Z):
    """Inland and sea water polygons in one vector tile, in degrees."""
    if data[:2] == b'\x1f\x8b':
        data = gzip.decompress(data)
    layers = mapbox_vector_tile.decode(data, default_options={'y_coord_down': True})
    layer = layers.get('water')
    if not layer:
        return None
    extent = layer.get('extent', 4096)
    n = 2 ** z
    geoms = []
    for f in layer['features']:
        g = f['geometry']
        if g['type'] not in ('Polygon', 'MultiPolygon'):
            continue
        shp = shapely.geometry.shape(g)
        shp = shapely.transform(shp, lambda c: _tile_to_degrees(c, x, y, n, extent))
        geoms.append(shapely.make_valid(shp))
    return shapely.union_all(geoms) if geoms else None


def _tile_to_degrees(c, x, y, n, extent):
    import numpy as np
    lon = (x + c[:, 0] / extent) / n * 360 - 180
    t = math.pi * (1 - 2 * (y + c[:, 1] / extent) / n)
    lat = np.degrees(np.arctan(np.sinh(t)))
    return np.column_stack([lon, lat])


def fetch_water(tiles):
    """Water for each tile, fetched from OpenFreeMap (kept in tools/.cache)."""
    try:
        with urllib.request.urlopen(urllib.request.Request(TILEJSON, headers=UA), timeout=60) as r:
            template = json.load(r)['tiles'][0]
    except Exception as e:  # no inland water rather than no coastlines
        print(f'  inland water unavailable: {e}', flush=True)
        return {}
    folder = os.path.join(CACHE, 'water')
    os.makedirs(folder, exist_ok=True)

    def one(t):
        x, y = t
        path = os.path.join(folder, f'{WATER_Z}_{x}_{y}.pbf')
        if not os.path.exists(path):
            url = template.replace('{z}', str(WATER_Z)).replace('{x}', str(x)).replace('{y}', str(y))
            for attempt in range(4):
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                        data = r.read()
                    break
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        data = b''
                        break
                    if attempt == 3:
                        return t, None
                except Exception:
                    if attempt == 3:
                        return t, None
            with open(path, 'wb') as f:
                f.write(data)
        data = open(path, 'rb').read()
        try:
            return t, water_from_tile(data, x, y) if data else None
        except Exception as e:
            print(f'  tile {t}: {e}', flush=True)
            return t, None

    out = {}
    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        for i, (t, g) in enumerate(pool.map(one, tiles)):
            if g is not None and not g.is_empty:
                out[t] = g
            if i % 2000 == 0:
                print(f'  water tiles {i:,}/{len(tiles):,}', flush=True)
    return out


def source_path():
    if len(sys.argv) > 1:
        return sys.argv[1]
    os.makedirs(CACHE, exist_ok=True)
    shp = os.path.join(CACHE, 'land-polygons-split-4326', 'land_polygons.shp')
    if not os.path.exists(shp):
        zpath = os.path.join(CACHE, 'land-polygons.zip')
        if not os.path.exists(zpath):
            print(f'Downloading {SOURCE}', flush=True)
            with urllib.request.urlopen(SOURCE) as r, open(zpath, 'wb') as f:
                shutil.copyfileobj(r, f, 1 << 20)
        with zipfile.ZipFile(zpath) as z:
            z.extractall(CACHE)
    return shp


def circle(lon, lat, km):
    """A circle of `km` round the point, drawn in degrees (wider in longitude)."""
    r = km / 111.32
    c = shapely.Point(lon, lat).buffer(r, quad_segs=12)
    return affinity.scale(c, xfact=1 / max(math.cos(math.radians(lat)), 0.05), yfact=1, origin=(lon, lat))


def main():
    ports = json.load(open(os.path.join(ROOT, 'data', 'ports.json')))
    countries = json.load(open(os.path.join(ROOT, 'data', 'countries.json')))
    colour = {f['properties']['iso']: f['properties']['c'] for f in countries['features']}

    print('Reading land polygons', flush=True)
    _, _, wkb, _ = pyogrio.raw.read(source_path(), read_geometry=True, columns=[])
    land = shapely.from_wkb(wkb)
    tree = shapely.STRtree(land)
    print(f'  {len(land):,} polygons', flush=True)

    # Each port's circle, split between the 1° squares it touches, by colour.
    pieces = collections.defaultdict(lambda: collections.defaultdict(list))
    for name, lon, lat, cc, _, rank, _, _ in ports:
        if abs(lon) > 179.8 or abs(lat) > 84:
            continue
        c = circle(lon, lat, RADIUS_KM[rank])
        x0, y0, x1, y1 = c.bounds
        for y in range(math.floor(y0), math.floor(y1) + 1):
            for x in range(math.floor(x0), math.floor(x1) + 1):
                part = c.intersection(shapely.box(x, y, x + 1, y + 1))
                if not part.is_empty:
                    pieces[(y, x)][colour.get(cc, 0)].append(part)

    print('Fetching inland water (rivers, channels, docks, lakes)', flush=True)
    masks = {k: shapely.union_all([p for parts in v.values() for p in parts]) for k, v in pieces.items()}
    wanted = sorted({t for m in masks.values() for t in tiles_over(m)})
    water = fetch_water(wanted)
    print(f'  {len(water):,} of {len(wanted):,} tiles have water', flush=True)

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    index = {}
    total = 0
    for n, ((y, x), by_colour) in enumerate(sorted(pieces.items())):
        mask = masks[(y, x)]
        hits = tree.query(mask, predicate='intersects')
        here = shapely.union_all(shapely.intersection(land[hits], mask)) if len(hits) else shapely.Polygon()
        wet = [water[t] for t in tiles_over(mask) if t in water]
        if wet and not here.is_empty:
            here = shapely.difference(here, shapely.make_valid(shapely.union_all(wet)))
        features = [feature(mask, {'kind': 'mask'})]
        # The shoreline: the edge of the land, less where it was cut off at
        # the edge of the circle or the square, which is not shore.
        shore = shapely.difference(here.boundary, shapely.buffer(mask.boundary, 1e-6))
        lines = [g for g in shapely.get_parts(shore) if g.geom_type == 'LineString' and not g.is_empty]
        if lines:
            shore = shapely.line_merge(shapely.MultiLineString(lines))
            shore = shapely.simplify(shore, TOLERANCE)
            if shore is not None and not shore.is_empty:
                features.append(feature(shore, {'kind': 'shore'}))
        taken = shapely.Polygon()
        # Where ports of different countries overlap, the larger group colours it.
        for c, parts in sorted(by_colour.items(), key=lambda kv: -len(kv[1])):
            area = shapely.difference(shapely.union_all(parts), taken)
            taken = shapely.union_all([taken, area])
            piece = shapely.intersection(here, area)
            piece = shapely.simplify(piece, TOLERANCE, preserve_topology=True)
            piece = shapely.set_precision(piece, GRID)
            if not piece.is_empty:
                features.append(feature(piece, {'kind': 'land', 'c': c}))
        text = json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':'))
        key = f'{y}_{x}'
        with open(os.path.join(OUT, f'{key}.json'), 'w') as f:
            f.write(text)
        index[key] = len(text)
        total += len(text)
        if n % 250 == 0:
            print(f'  {n:,}/{len(pieces):,} squares, {total / 1e6:.1f} MB', flush=True)

    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump({'built': datetime.date.today().isoformat(), 'cells': index}, f, separators=(',', ':'))
    print(f'data/coast: {len(index):,} squares, {total / 1e6:.1f} MB', flush=True)


def feature(geom, props):
    g = shapely.set_precision(geom, GRID)
    return {'type': 'Feature', 'properties': props, 'geometry': json.loads(shapely.to_geojson(g))}


if __name__ == '__main__':
    main()
