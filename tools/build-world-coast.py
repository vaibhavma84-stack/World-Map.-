"""The whole world's coastline in detail (every coast, port or not): OpenStreetMap's land polygons, each
piece coloured like its country, for tippecanoe to turn into one map file.

    python3 tools/build-world-coast.py > land.geojsonl

Runs on GitHub (see .github/workflows/world-coast.yml), which downloads the
source (osmdata.openstreetmap.de, ODbL, about 800 MB), writes the pieces as
GeoJSON lines with their colour (c, as in data/countries.json), and has
tippecanoe build tools/.cache/land.pmtiles from them.

Each piece of land takes the colour of the Natural Earth country it falls in.
Where a piece crosses a border it is cut there; where it lies outside every
country (Natural Earth's coast is coarser), it takes the nearest country's.
"""
import contextlib
import json
import os
import sys

import pyogrio
import shapely

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def source_path():
    """The land polygons: $LAND if set, else the harbour job's download."""
    if os.environ.get('LAND'):
        return os.environ['LAND']
    import importlib.util
    spec = importlib.util.spec_from_file_location('bc', os.path.join(ROOT, 'tools', 'build-coast.py'))
    bc = importlib.util.module_from_spec(spec)
    sys.argv = sys.argv[:1]
    # Its progress messages go to stdout, which here is the output: send them
    # to stderr, or they land in the GeoJSON lines and spoil the map file.
    with contextlib.redirect_stdout(sys.stderr):
        spec.loader.exec_module(bc)
        return bc.source_path()


def cells(shape, size):
    """The shape cut into squares of `size` degrees: small pieces are quick
    to test and cut against, where a whole country (Canada, Russia) is not.
    Cut in two stages, 10° then `size`, so each cut works on little."""
    out = []
    x0, y0, x1, y1 = shape.bounds
    for big in grid(shape, (x0, y0, x1, y1), 10):
        out.extend(grid(big, big.bounds, size))
    return out


def grid(shape, bounds, size):
    import math
    x0, y0, x1, y1 = bounds
    out = []
    for i in range(math.floor(x0 / size), math.ceil(x1 / size)):
        for j in range(math.floor(y0 / size), math.ceil(y1 / size)):
            part = shapely.clip_by_rect(shape, i * size, j * size, (i + 1) * size, (j + 1) * size)
            if not part.is_empty and part.area > 0:
                out.append(shapely.make_valid(part))
    return out


def overlay(op, a, b):
    """An overlay that survives GEOS's occasional robustness failures: retry
    on a fine grid, and give up on the piece (None) if that fails too."""
    try:
        return op(a, b)
    except shapely.errors.GEOSException:
        try:
            return op(shapely.make_valid(a), shapely.make_valid(b), grid_size=1e-7)
        except shapely.errors.GEOSException:
            return None


def main():
    countries = json.load(open(os.path.join(ROOT, 'data', 'countries.json')))
    shapes, colours = [], []
    for f in countries['features']:
        for part in cells(shapely.make_valid(shapely.geometry.shape(f['geometry'])), 1):
            shapes.append(part)
            colours.append(f['properties']['c'])
    print(f'{len(shapes):,} country squares', file=sys.stderr, flush=True)
    tree = shapely.STRtree(shapes)
    for s in shapes:
        shapely.prepare(s)

    _, _, wkb, _ = pyogrio.raw.read(source_path(), read_geometry=True, columns=[])
    land = shapely.from_wkb(wkb)
    print(f'{len(land):,} land pieces', file=sys.stderr, flush=True)

    out = sys.stdout
    grid = 1e-6

    def emit(geom, c):
        geom = shapely.set_precision(geom, grid)
        if geom.is_empty:
            return
        out.write(json.dumps({'type': 'Feature', 'properties': {'c': int(c)},
                              'geometry': json.loads(shapely.to_geojson(geom))}, separators=(',', ':')))
        out.write('\n')

    for n, piece in enumerate(land):
        hits = tree.query(piece, predicate='intersects')
        if len(hits) == 1 and shapely.contains(shapes[hits[0]], piece):
            emit(piece, colours[hits[0]])
            continue
        # One area per colour (the squares of a colour joined first), so the
        # land is not cut along the squares' edges.
        by_colour = {}
        for i in hits:
            by_colour.setdefault(colours[i], []).append(shapes[i])
        joined = {c: shapely.union_all(parts) if len(parts) > 1 else parts[0] for c, parts in by_colour.items()}
        if len(joined) == 1:
            (c, area), = joined.items()
            if shapely.covers(area, piece):
                emit(piece, c)
                continue
        rest = piece
        for c, area in joined.items():
            part = overlay(shapely.intersection, piece, area)
            if part is not None and not part.is_empty:
                emit(part, c)
                rest = overlay(shapely.difference, rest, area) if rest is not None else None
        if rest is not None and not rest.is_empty and rest.area > 0:
            emit(rest, colours[tree.nearest(rest)])
        if n % 50000 == 0:
            print(f'  {n:,}', file=sys.stderr, flush=True)


if __name__ == '__main__':
    main()
