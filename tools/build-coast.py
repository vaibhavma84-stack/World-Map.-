"""Detailed coastlines around every port, cut from OpenStreetMap's land polygons.

    python3 tools/build-coast.py [land-polygons.shp]

Natural Earth's world coastline is good to about a kilometre: fine for the
world, blocky in a harbour. OpenStreetMap's land polygons (osmdata.openstreetmap.de,
ODbL) are good to a few metres but come to about 800 MB for the world, so only
the water round each port is kept: 10 km round World Port Index ports, 4 km
round the rest.

Written to data/coast/, one file per 1° square that holds any of it:
  {lat}_{lon}.json  features with kind "mask" (the area this file covers in
                    detail), "land" (the land in it, with the colour of the
                    port's country, c) and "shore" (the shoreline, as lines)
  index.json        which squares exist, their sizes, and the build date

Runs on GitHub (see .github/workflows/coast.yml), which can download the source.
"""
import collections
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

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'tools', '.cache')
OUT = os.path.join(ROOT, 'data', 'coast')
SOURCE = 'https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip'

RADIUS_KM = {0: 10, 1: 10, 2: 10, 3: 10, 4: 4}  # by port rank; 4 = UN/LOCODE only
TOLERANCE = 0.00004  # degrees, about 4 m: under a pixel at harbour zoom
GRID = 1e-5          # coordinates kept to about 1 m


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

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    index = {}
    total = 0
    for n, ((y, x), by_colour) in enumerate(sorted(pieces.items())):
        mask = shapely.union_all([p for parts in by_colour.values() for p in parts])
        hits = tree.query(mask, predicate='intersects')
        here = shapely.union_all(shapely.intersection(land[hits], mask)) if len(hits) else shapely.Polygon()
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
