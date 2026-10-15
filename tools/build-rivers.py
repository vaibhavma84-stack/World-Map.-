"""Rivers and their tributaries for the whole world, from HydroRIVERS
(HydroSHEDS, WWF / USGS; free with attribution), as GeoJSON lines for
tippecanoe:

    python3 tools/build-rivers.py HydroRIVERS_v10.shp MIN_KM2 > rivers.geojsonl

Keeps river reaches whose catchment upstream is at least MIN_KM2 square
kilometres, with that area (u, km²) and mean flow (q, m³/s), and the zoom
each starts to show at, by size, so the map fills in the smaller tributaries
as you zoom in. HydroRIVERS carries no names; the named rivers come from
Natural Earth (offline) and OpenStreetMap (closer in, online).
"""
import json
import sys

import pyogrio
import shapely


def minzoom(upland):
    for z, area in ((2, 500000), (3, 150000), (4, 50000), (5, 20000), (6, 8000), (7, 3000), (8, 1000)):
        if upland >= area:
            return z
    return 9


def main():
    path, least = sys.argv[1], float(sys.argv[2])
    meta, _, geom, fields = pyogrio.raw.read(path, columns=['UPLAND_SKM', 'DIS_AV_CMS'], where=f'UPLAND_SKM >= {least}')
    upland, flow = fields
    lines = shapely.from_wkb(geom)
    print(f'{len(lines):,} reaches of {least:g} km² and more', file=sys.stderr, flush=True)
    out = sys.stdout
    for g, u, q in zip(lines, upland, flow):
        g = shapely.simplify(g, 0.002)
        if g.is_empty:
            continue
        out.write(json.dumps({
            'type': 'Feature', 'tippecanoe': {'minzoom': minzoom(u)},
            'properties': {'u': int(u), 'q': round(float(q), 1)},
            'geometry': json.loads(shapely.to_geojson(shapely.set_precision(g, 1e-4))),
        }, separators=(',', ':')))
        out.write('\n')


if __name__ == '__main__':
    main()
