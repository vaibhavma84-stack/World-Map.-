"""Checks the world coastline at known places, at each stage of its build:
the land polygons, the coloured pieces (GeoJSON lines) and the map file.
Exits non-zero if a place on land is not land or a place at sea is land,
so a bad file is not published.

    python3 tools/check-world-coast.py land.geojsonl [land.pmtiles]
"""
import gzip
import json
import math
import sys

import shapely
from shapely.geometry import Point, shape

# (name, lon, lat, is land)
PLACES = [
    ('Paris', 2.35, 48.85, True), ('Kuwait City', 47.98, 29.37, True), ('Iraq, Basra', 47.78, 30.51, True),
    ('Sydney CBD', 151.21, -33.87, True), ('Houston', -95.37, 29.76, True), ('Mumbai', 72.88, 19.08, True),
    ('Rotterdam', 4.48, 51.92, True), ('Dammam', 50.10, 26.43, True),
    ('North Sea', 3.0, 53.5, False), ('Galveston Bay', -94.85, 29.5, False), ('Gulf off Kuwait', 48.5, 29.2, False),
    ('Tasman Sea', 152.0, -34.5, False), ('Arabian Sea', 65.0, 15.0, False), ('Gulf off Fao', 48.9, 29.6, False),
]


def features(path):
    if path.endswith('.shp'):
        import pyogrio
        _, _, wkb, _ = pyogrio.raw.read(path, read_geometry=True, columns=[])
        for g in shapely.from_wkb(wkb):
            yield {'properties': {}}, g
        return
    with open(path) as f:
        for line in f:
            feat = json.loads(line)
            yield feat, shape(feat['geometry'])


def check_lines(path):
    hits = {p[0]: [] for p in PLACES}
    points = [(n, Point(x, y), want) for n, x, y, want in PLACES]
    count = 0
    if True:
        for feat, g in features(path):
            count += 1
            minx, miny, maxx, maxy = g.bounds
            for n, p, _ in points:
                if minx <= p.x <= maxx and miny <= p.y <= maxy and g.contains(p):
                    hits[n].append((feat['properties'].get('c'), round(g.area, 4)))
    print(f'{path}: {count:,} pieces')
    bad = 0
    for n, _, want in points:
        ok = bool(hits[n]) == want
        bad += not ok
        print(f'  {"ok  " if ok else "BAD "} {n:16} {"land" if want else "sea "}: {len(hits[n])} pieces {hits[n][:3]}')
    return bad


def tile_of(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def check_tiles(path, z=10):
    import mapbox_vector_tile
    from pmtiles.reader import Reader, MmapSource
    bad = 0
    with open(path, 'rb') as f:
        reader = Reader(MmapSource(f))
        for n, lon, lat, want in PLACES:
            x, y = tile_of(lon, lat, z)
            data = reader.get(z, x, y)
            found = False
            if data:
                if data[:2] == b'\x1f\x8b':
                    data = gzip.decompress(data)
                layer = mapbox_vector_tile.decode(data, default_options={'y_coord_down': True}).get('land', {})
                ext = layer.get('extent', 4096)
                n_ = 2 ** z
                px = ((lon + 180) / 360 * n_ - x) * ext
                py = ((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n_ - y) * ext
                pt = Point(px, py)
                found = any(shape(ft['geometry']).contains(pt) for ft in layer.get('features', []))
            ok = found == want
            bad += not ok
            print(f'  {"ok  " if ok else "BAD "} tile {z}/{x}/{y} {n:16} {"land" if want else "sea "}: {"land" if found else "sea"}{"" if data else " (no tile)"}')
    return bad


if __name__ == '__main__':
    bad = check_lines(sys.argv[1]) if sys.argv[1].endswith(('l', '.shp')) else 0
    if len(sys.argv) > 2:
        print(sys.argv[2])
        bad += check_tiles(sys.argv[2])
    print('all places right' if not bad else f'{bad} places wrong')
    sys.exit(1 if bad else 0)
