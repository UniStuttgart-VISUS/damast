import jinja2
import flask
import re
import operator
from psycopg2.extras import NumericRange
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

blueprint = AuthenticatedBlueprintPreparator('filters', __name__, static_folder=None, template_folder=None)

range_match = re.compile('(?P<open>[([])(?P<start>\d*),(?P<end>\d*)(?P<close>[\])])')

@jinja2.pass_context
def render_int4range(context, value):
    if value is None or value == 'empty':
        return '<em>empty range</em>'

    r = range_match.fullmatch(value)
    bounds = F'{r.group("open")}{r.group("close")}'
    start = None if r.group('start') == '' else int(r.group('start'))
    end = None if r.group('end') == '' else int(r.group('end'))

    span = NumericRange(start, end, bounds)

    if span.isempty:
        return '<em>empty range</em>'

    a = span.lower if span.lower_inc or span.lower_inf else span.lower + 1
    b = span.upper if span.upper_inc or span.upper_inf else span.upper - 1

    if a is None and b is None:
        return F'<em>empty range</em>'
    elif a == b:
        return F'in <strong>{a}</strong>'
    elif span.upper_inf:
        return F'from <strong>{a}</strong> on'
    elif span.lower_inf:
        return F'until <strong>{b}</strong>'
    else:
        return F'from <strong>{a}</strong> until <strong>{b}</strong>'


@jinja2.pass_context
def sort_int4range(context, value):
    empties = []
    vals = []
    for v in value:
        s = v['span']

        if s is None or s == 'empty':
            empties.append(v)
            continue

        r = range_match.fullmatch(s)
        bounds = F'{r.group("open")}{r.group("close")}'
        start = None if r.group('start') == '' else int(r.group('start'))
        end = None if r.group('end') == '' else int(r.group('end'))

        span = NumericRange(start, end, bounds)

        if span.isempty:
            empties.append(v)
        else:
            a = span.lower if span.lower_inc or span.lower_inf else span.lower + 1
            b = span.upper if span.upper_inc or span.upper_inf else span.upper - 1

            vals.append((v, a, b))

    vals = sorted(vals, key=operator.itemgetter(1,2))
    return [ *empties, *map(operator.itemgetter(0), vals) ]


geoloc_regex = re.compile('\((?P<lng>-?\d+\.?\d*),(?P<lat>-?\d+\.?\d*)\)')

@jinja2.pass_context
def render_geoloc(context, value):
    if value is None:
        return '<em>an unknown location</em>'

    r = geoloc_regex.fullmatch(value)
    if not r:
        raise ValueError(F'Value "{value}" is not a valid geolocation for rendering.')

    lat = float(r.group('lat'))
    lng = float(r.group('lng'))

    ns_hemi = 'N' if lat >= 0 else 'S'
    ew_hemi = 'E' if lng >= 0 else 'W'
    lat = abs(lat)
    lng = abs(lng)

    return F'<strong>{ns_hemi}&thinsp;{lat:g}° {ew_hemi}&thinsp;{lng:g}°</strong>'


@jinja2.pass_context
def bytesize(context, value):
    if value is None:
        return '0&thinsp;B'

    l = len(value)
    prefixes = ['', 'k', 'M', 'G', 'T']
    log = 0
    while l >= 1000:
        l /= 1000
        log += 1

    prefix = prefixes[log]

    return F'{l: .3g}&thinsp;{prefix}B'



# pass like this so we can reuse the filters from jinja2

blueprint.app_template_filter()(render_int4range)
blueprint.app_template_filter()(sort_int4range)
blueprint.app_template_filter()(render_geoloc)
blueprint.app_template_filter()(bytesize)

