import geopandas as gpd
import geoplot as gplt
import geoplot.crs as gcrs
import matplotlib.pyplot as plt
from matplotlib.transforms import Affine2D
from matplotlib.lines import Line2D
from shapely.geometry import Point, Polygon, LineString, box
from shapely.errors import ShapelyDeprecationWarning
from io import StringIO, BytesIO
import flask
import os.path
import gzip
import warnings
import logging
import math
import os
from functools import namedtuple
from itertools import cycle
from colorsys import hls_to_rgb
import re

from ..postgres_rest_api.util import parse_geoloc

warnings.simplefilter('ignore', category=ShapelyDeprecationWarning)

_min_dx_mercator = 1113194.908  # 10° at equator
crs = 'EPSG:4326'

with gzip.open(os.path.join(os.getcwd(), 'dhimmis', 'reporting/map-data', 'features.geo.json.gz')) as f:
    features = gpd.GeoSeries.from_file(f, crs=crs, driver='GeoJSON')
    waterbodies_full = features[features.apply(lambda x: x.type in ('Polygon', 'MultiPolygon'))]
    rivers_full = features[features.apply(lambda x: x.type in ('Line', 'LineString', 'MultiLineString'))]

    logging.getLogger('flask.error').info(F'Loaded map data from {f.name}.')


def _parse(p):
    geoloc = p.place.geoloc
    return parse_geoloc(geoloc)


def optimal_extent(extent):
    # go into image space
    gdf = gpd.GeoSeries([Point(*extent[:2]), Point(*extent[2:])])
    gdf.set_crs(epsg=4326, inplace=True)
    gdf = gdf.to_crs(epsg=3857)  # to WebMercator
    extent = [ gdf[0].x, gdf[0].y, gdf[1].x, gdf[1].y ]

    # grow by at least a 5% boundary
    dx = extent[2] - extent[0]
    dy = extent[3] - extent[1]
    extent = [
            extent[0] - 0.05*dx,
            extent[1] - 0.05*dy,
            extent[2] + 0.05*dx,
            extent[3] + 0.05*dy,
            ]

    dx = extent[2] - extent[0]
    dy = extent[3] - extent[1]
    aspect = dx / dy

    if aspect > 2:
        # too wide
        y = extent[1] + dy/2
        extent[1] = y - dx * 1/4
        extent[3] = y + dx * 1/4
    elif aspect < 4/3:
        # too narrow
        x = extent[0] + dx/2
        extent[0] = x - dy * 2/3
        extent[2] = x + dy * 2/3

    dx = extent[2] - extent[0]
    dy = extent[3] - extent[1]

    if dx < _min_dx_mercator:
        factor = _min_dx_mercator/dx

        x = extent[0] + dx/2
        y = extent[1] + dy/2

        extent = [
            x - dx/2 * factor,
            y - dy/2 * factor,
            x + dx/2 * factor,
            y + dy/2 * factor,
            ]

    gdf = gpd.GeoSeries([Point(*extent[:2]), Point(*extent[2:])])
    gdf.set_crs(epsg=3857, inplace=True)
    gdf = gdf.to_crs(epsg=4326)
    return [ gdf[0].x, gdf[0].y, gdf[1].x, gdf[1].y ]


PlaceSymbol = namedtuple('PlaceSymbol', ['geoloc', 'religions'])
Religion = namedtuple('Religion', ['offset', 'color', 'marker'])

_hexagon_positions = [
  ( 0, 0 ),

  ( -1, 0 ),
  ( 1, 0 ),
  ( -1, 1 ),
  ( 0, 1 ),
  ( 0, -1 ),
  ( 1, -1 ),

  ( -2, 0 ),
  ( 2, 0 ),
  ( -2, 1 ),
  ( 1, 1 ),
  ( -1, -1 ),
  ( 2, -1 ),
  ( -2, 2 ),
  ( -1, 2 ),
  ( 0, 2 ),
  ( 0, -2 ),
  ( 1, -2 ),
  ( 2, -2 ),

  ( -3, 0 ),
  ( 3, 0 ),
  ( -3, 1 ),
  ( 2, 1 ),
  ( -2, -1 ),
  ( 3, -1 ),
  ( -3, 2 ),
  ( 1, 2 ),
  ( -1, -2 ),
  ( 3, -2 ),
  ( -3, 3 ),
  ( -2, 3 ),
  ( -1, 3 ),
  ( 0, 3 ),
  ( 0, -3 ),
  ( 1, -3 ),
  ( 2, -3 ),
  ( 3, -3 ),
]
_hex2 = [ (-0.5, 0), (0.5, 0) ]

_symbol_radius = 3
_sqrt8 = math.sqrt(0.8)
_hsl = re.compile(r'hsl\((?P<h>\d+(\.\d+)?),\s?(?P<s>\d+)%,\s?(?P<l>\d+)%\)')

_symbols = [
    ('o', 1),
    ('s', 0.8),
    ('H', 1),
    ('D', 1 / math.sqrt(2)),
    ('h', 1),
    ('X', 0.9),
    ('p', 1),
        ]

def _place_symbols(places, evidences, religions, graticulecolor):
    relmap = { r['id']: r for r in religions }
    relidx = { r['id']: i for i, r in enumerate(religions) }
    rids = set()
    relcolors = dict()
    relsyms = { r['id']: sym for r, sym in zip(religions, cycle(_symbols)) }

    places_out = []
    for place in places:
        geoloc = _parse(place)
        if geoloc is None:
            continue

        ev = filter(lambda e: e.evidence.place_id == place.place.id, evidences)
        relids = sorted(set(map(lambda e: e.evidence.religion_id, ev)), key=lambda rid: relidx[rid])

        place_religions = []

        for i, rid in enumerate(relids):
            rids.add(rid)

            a, b = _hexagon_positions[i] if len(relids) != 2 else _hex2[i]
            dx = ( a + _sqrt8 / 2 * b ) * 2 * _symbol_radius
            dy = ( _sqrt8 * b ) * 2 * _symbol_radius

            color = relmap[rid]['color']
            m = _hsl.fullmatch(color)
            if m:
                h = float(m['h']) / 360
                s = float(m['s']) / 100
                l = float(m['l']) / 100

                rgb = hls_to_rgb(h, l, s)

                color = '#' + ''.join(map(lambda v: '%02x'%int(255*v), rgb))

            if rid not in relcolors:
                relcolors[rid] = color

            place_religions.append(Religion((dx, dy), color, relsyms[rid]))

        places_out.append(PlaceSymbol(geoloc, place_religions))

    places_out.sort(key=lambda x: len(x.religions), reverse=True)

    legend_elements = [ Line2D([0], [0], color='none',
        label=relmap[rid]['name'],
        markerfacecolor=relcolors[rid],
        markeredgewidth=0.5,
        markeredgecolor=graticulecolor,
        markersize=2 * _symbol_radius * relsyms[rid][1],
        marker=relsyms[rid][0])
        for rid in sorted(rids, key=lambda rid: relidx[rid])
        ]

    return places_out, legend_elements


def create_map(places, evidences, religions, all_religions):
    global waterbodies_full, rivers_full

    geolocs = list(filter(lambda x: x is not None, map(_parse, places)))

    points = gpd.GeoSeries([Point(g['lng'], g['lat']) for g in geolocs])
    if len(geolocs) == 1:
        extent = [ geolocs[0]['lng'] - 10, geolocs[0]['lat'] - 7.5, geolocs[0]['lng'] + 10, geolocs[0]['lat'] + 7.5 ]
    else:
        extent = points.total_bounds

    extent = optimal_extent(extent)

    bbox = box(*extent)

    waterbodies = gpd.clip(waterbodies_full, bbox, keep_geom_type=True)
    rivers = gpd.clip(rivers_full, bbox, keep_geom_type=True)

    svg = StringIO()
    pdf = BytesIO()
    plotformats = [
        (svg, 'svg', '#888', '#444', '#888', '#fff', '#999'),
        (pdf, 'pdf', '#444', '#aaa', '#aaa', '#000', '#888'),
            ]

    for outfile, fmt, water_edgecolor, water_facecolor, rivercolor, pointcolor, graticulecolor in plotformats:
        markers, legend_elements = _place_symbols(places, evidences, all_religions, graticulecolor)

        plt.clf()
        ax = gplt.polyplot(
                waterbodies,
                projection=gcrs.WebMercator(),
                extent=extent,
                linewidth=0.5,
                edgecolor=water_edgecolor,
                facecolor=water_facecolor,
                zorder=-5)

        gplt.polyplot(
                rivers,
                ax=ax,
                projection=gcrs.WebMercator(),
                extent=extent,
                linewidth=0.5,
                edgecolor=rivercolor,
                facecolor='none',
                zorder=-4)

        for i, place in enumerate(markers):
            pt = gpd.GeoSeries([Point(place.geoloc['lng'], place.geoloc['lat'])])
            pt.set_crs(epsg=4326, inplace=True)
            pt2 = pt.to_crs(epsg=3857)  # to WebMercator
            px, py = pt2[0].x, pt2[0].y

            for rel in place.religions:
                marker, scale = rel.marker

                ax.scatter([px], [py],
                        color=rel.color,
                        linewidths=0.5,
                        edgecolor=graticulecolor,
                        transform=ax.transData + Affine2D.from_values(1, 0, 0, 1, *rel.offset),
                        s=(2*_symbol_radius*scale)**2,
                        marker=marker,
                        zorder=10+i)


        _textstyle = dict(color=graticulecolor, fontsize='xx-small', va='bottom')
        lat_extent = abs(extent[1] - extent[3])
        lng_extent = abs(extent[0] - extent[2])

        lat_ticks = _numticks(lat_extent)
        lng_ticks = _numticks(lng_extent)
        minlat_round = math.ceil(min(extent[1], extent[3]) / lat_ticks) * lat_ticks
        maxlat_round = math.floor(max(extent[1], extent[3]) / lat_ticks) * lat_ticks
        minlng_round = math.ceil(min(extent[0], extent[2]) / lng_ticks) * lng_ticks
        maxlng_round = math.floor(max(extent[0], extent[2]) / lng_ticks) * lng_ticks

        for lat in range(minlat_round, maxlat_round+1, lat_ticks):
            line = gpd.GeoSeries([LineString([
                Point(extent[0], lat),
                Point(extent[2], lat),
                ])])
            gplt.polyplot(line,
                    ax=ax,
                    projection=gcrs.WebMercator(),
                    extent=extent,
                    linewidth=0.5,
                    edgecolor=graticulecolor,
                    facecolor='none',
                    zorder=-3)

            ns = 'N' if lat >= 0 else 'S'
            lbl = F'{ns} {abs(lat):g}°'

            # go into image space
            gdf = gpd.GeoSeries([Point(extent[2], lat)])
            gdf.set_crs(epsg=4326, inplace=True)
            gdf = gdf.to_crs(epsg=3857)  # to WebMercator
            ax.text(gdf[0].x - 3, gdf[0].y + 3, lbl, ha='right', in_layout=False, **_textstyle)

        for lng in range(minlng_round, maxlng_round+1, lng_ticks):
            line = gpd.GeoSeries([LineString([
                Point(lng, extent[1]),
                Point(lng, extent[3]),
                ])])
            gplt.polyplot(line,
                    ax=ax,
                    projection=gcrs.WebMercator(),
                    extent=extent,
                    linewidth=0.5,
                    edgecolor=graticulecolor,
                    facecolor='none',
                    zorder=-3)

            ew = 'E' if lng >= 0 else 'W'
            lbl = F'{ew} {abs(lng):g}°'

            # go into image space
            gdf = gpd.GeoSeries([Point(lng, extent[1])])
            gdf.set_crs(epsg=4326, inplace=True)
            gdf = gdf.to_crs(epsg=3857)  # to WebMercator
            ax.text(gdf[0].x - 3, gdf[0].y + 3, lbl, ha='right', rotation='vertical', in_layout=False, **_textstyle)

        plt.gcf().set_size_inches(1.5 * plt.gcf().get_size_inches())

        legend = ax.legend(handles=legend_elements,
                loc=(1.005, 0),
                prop=dict(size=8),
                labelcolor=graticulecolor,
                facecolor='none',
                edgecolor=graticulecolor,
                fancybox=False,
                )
        ax.patch.set_edgecolor(graticulecolor)
        ax.patch.set_facecolor('none')
        ax.patch.set_linewidth(0.5)
        legend.get_frame().set_linewidth(0.5)

        plt.gcf().patch.set_edgecolor('none')
        plt.gcf().patch.set_facecolor('none')

        plt.savefig(outfile,
                format=fmt,

                transparent=False,
                bbox_inches='tight',
                pad_inches=0,
                )

    return svg.getvalue(), pdf.getvalue()


def _numticks(extent):
    if extent > 120:
        return 30
    elif extent > 60:
        return 15
    elif extent > 40:
        return 10
    elif extent > 20:
        return 5
    elif extent > 8:
        return 2

    return 1
