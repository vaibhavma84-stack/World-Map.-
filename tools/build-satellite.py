"""The world from space, for the map's satellite view offline: Sentinel-2
cloudless by EOX (https://s2maps.eu), zoom 0 to 7, into satellite.pmtiles
for the Android app (closer in, the app fetches the same imagery online and
keeps what it has seen).

    python3 tools/build-satellite.py out.pmtiles [max_zoom]

Credit: "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH
(Contains modified Copernicus Sentinel data)".
"""
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer

LAYERS = ['s2cloudless_3857', 's2cloudless-2020_3857', 's2cloudless-2021_3857']
URL = 'https://tiles.maps.eox.at/wmts/1.0.0/{layer}/default/g/{z}/{y}/{x}.jpg'
UA = {'User-Agent': 'WorldMapSatellite/1.0 (personal map; https://github.com/vaibhavma84-stack/World-Map.-)'}


def get(layer, z, x, y):
    for attempt in range(5):
        try:
            req = urllib.request.Request(URL.format(layer=layer, z=z, x=x, y=y), headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if getattr(e, 'code', None) == 404:
                return None
            time.sleep(2 * (attempt + 1))
    return None


out, max_zoom = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 7
layer = next((l for l in LAYERS if get(l, 0, 0, 0)), None)
if not layer:
    sys.exit('No EOX layer answered')
print('layer', layer)
jobs = [(z, x, y) for z in range(max_zoom + 1) for x in range(2 ** z) for y in range(2 ** z)]
tiles = {}
with ThreadPoolExecutor(8) as pool:
    for n, ((z, x, y), data) in enumerate(zip(jobs, pool.map(lambda j: get(layer, *j), jobs))):
        if data:
            tiles[zxy_to_tileid(z, x, y)] = data
        if n % 2000 == 0:
            print(f'{n}/{len(jobs)}', flush=True)
missing = len(jobs) - len(tiles)
print(f'{len(tiles)} tiles, {missing} missing')
if missing > len(jobs) * 0.02:
    sys.exit('Too many tiles missing')
with open(out, 'wb') as f:
    w = Writer(f)
    for tid in sorted(tiles):
        w.write_tile(tid, tiles[tid])
    w.finalize(
        {'tile_type': TileType.JPEG, 'tile_compression': Compression.NONE, 'min_zoom': 0, 'max_zoom': max_zoom,
         'min_lon_e7': -1800000000, 'min_lat_e7': -850000000, 'max_lon_e7': 1800000000, 'max_lat_e7': 850000000,
         'center_zoom': 2, 'center_lon_e7': 0, 'center_lat_e7': 0},
        {'name': 'Sentinel-2 cloudless', 'attribution': 'Sentinel-2 cloudless by EOX (Copernicus Sentinel data)', 'layer': layer},
    )
print('done', out)
