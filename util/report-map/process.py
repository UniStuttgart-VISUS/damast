#!/usr/bin/env python3

import pandas as pd
import geopandas as gpd
import sys
import json

if len(sys.argv) != 2:
    sys.stderr.write(F'Usage: {sys.argv[0]} <resolution>\n')
    sys.exit(1)

res = sys.argv[1]


lakes = gpd.GeoSeries.from_file(F'ne_{res}_lakes.json', driver='GeoJSON')
ocean = gpd.GeoSeries.from_file(F'ne_{res}_ocean.json', driver='GeoJSON')

with open(F'ne_{res}_rivers_lake_centerlines.json') as f:
    geojson = json.load(f)

    # filter out lake centerlines
    features = list(filter(lambda x: x['properties']['featurecla'] == 'River', geojson['features']))
    geojson['features'] = features

    geofile = StringIO()
    json.dump(geojson, geofile)
    geofile.seek(0)
    rivers = gpd.GeoSeries.from_file(geofile, driver='GeoJSON')


merged = lakes.append(ocean).append(rivers)
merged = merged[merged.apply(lambda x: x is not None)]
merged.index = [ i for i in range(len(merged.index)) ]

merged.to_file('features.geo.json', driver='GeoJSON')
