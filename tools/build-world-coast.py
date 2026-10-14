"""The whole world's coastline in detail: OpenStreetMap's land polygons, each
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
    spec.loader.exec_module(bc)
    sys.argv = sys.argv[:1]
    return bc.source_path()


def main():
    countries = json.load(open(os.path.join(ROOT, 'data', 'countries.json')))
    shapes = [shapely.make_valid(shapely.geometry.shape(f['geometry'])) for f in countries['features']]
    colours = [f['properties']['c'] for f in countries['features']]
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
        else:
            rest = piece
            for i in hits:
                part = shapely.intersection(piece, shapes[i])
                if not part.is_empty:
                    emit(part, colours[i])
                    rest = shapely.difference(rest, shapes[i])
            if not rest.is_empty:
                nearest = tree.nearest(rest)
                emit(rest, colours[nearest])
        if n % 50000 == 0:
            print(f'  {n:,}', file=sys.stderr, flush=True)


if __name__ == '__main__':
    main()
