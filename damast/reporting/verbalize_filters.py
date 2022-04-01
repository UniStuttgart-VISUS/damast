import json
import urllib.parse
from .place_sort import sort_placenames

def verbalize(filters, cursor):
    verbs = []

    verbs.append(_verbalize_location(filters['location'], cursor))
    verbs.append(_verbalize_places(filters['places'], cursor))
    verbs.append(_verbalize_religion(filters['religion'], cursor))
    verbs.append(_verbalize_time(filters['time'], cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'interpretation_confidence',
        'The interpretation confidence of the evidence',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'location_confidence',
        'The location confidence of the evidence\'s location',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'place_attribution_confidence',
        'The place attribution confidence of the evidence to its connected place',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'religion_confidence',
        'The religion confidence of the evidence',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'time_confidence',
        'The time confidence of <em>at least one</em> of the evidence\'s time instances',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'source_confidences',
        'The source confidence of <em>at least one</em> source the evidence was based upon',
        cursor))

    verbs.append(_verbalize_sources(filters['sources'], cursor))
    verbs.append(_verbalize_tags(filters['tags'], cursor))

    return list(filter(lambda x: x is not None, verbs))


def _verbalize_location(location_filter, cursor):
    if location_filter is None:
        return None

    geojson_tight = json.dumps(location_filter)
    fragment = 'data=data:application/json,' + urllib.parse.quote(geojson_tight, safe='')
    geojson_io_link = urllib.parse.urlunsplit(('https', 'geojson.io', '', '', fragment))

    return F'''The evidence's place is either <em>unplaced</em> or located within the <a class="geojson-io-link" href="{ geojson_io_link }" target="_blank">following GeoJSON boundaries</a>:
    <p class="geojson-code"><code>{ geojson_tight }</code></p>'''


def _verbalize_places(place_filter, cursor):
    if place_filter is None:
        return None

    cursor.execute('SELECT name FROM place WHERE id = ANY(%(pids)s);', pids=place_filter)
    placenames = list(map(lambda x: x.name, cursor.fetchall()))
    placenames = sort_placenames(placenames)
    placenames = list(map(lambda x: F'<strong>{x}</strong>', placenames))

    if len(placenames) == 0:
        return F'<span class="verbalization-restrictive-filter-warning">The place filter does not permit any values at all. The filter will therefore not match <em>any</em> evidence. This is probably an oversight.</span>'

    if len(placenames) == 1:
        return F'The evidence must be placed in {placenames[0]}.'
    elif len(placenames) == 2:
        return F'The evidence must be placed in either {placenames[0]} or {placenames[1]}.'

    rs = ', '.join(placenames[:-1])
    rz = placenames[-1]

    if len(placenames) < 50:
        return F'The evidence must be placed in one of the following {len(placenames)} places: {rs}, or {rz}.'

    return F'<details><summary>The evidence must be placed in one of the following {len(placenames)} places <em>(click to expand)</em>:</summary> {rs}, or {rz}.</details>'


def _verbalize_religion(religion_filter, cursor):
    if religion_filter == True:
        return None

    elif religion_filter['type'] == 'simple':
        rels = religion_filter['filter']
        if len(rels) == 0:
            return F'<span class="verbalization-restrictive-filter-warning">The religion filter does not permit any values at all. The filter will therefore not match <em>any</em> evidence. This is probably an oversight.</span>'

        cursor.execute('SELECT name FROM religion WHERE id = ANY(%(rids)s) ORDER BY name;', rids=rels)
        relnames = list(map(lambda x: F'<strong>{x.name}</strong>', cursor.fetchall()))

        if len(relnames) == 1:
            return F'The evidence must reference the religious group {relnames[0]}.'
        elif len(relnames) == 2:
            return F'The evidence must reference either of the religious groups {relnames[0]} or {relnames[1]}.'

        rs = ', '.join(relnames[:-1])
        rz = relnames[-1]

        return F'The evidence must reference one of the following religious groups: {rs}, or {rz}.'


    else:
        count = 0
        for v in religion_filter['filter']:
            count += len(v)
        if count == 0:
            return F'<span class="verbalization-restrictive-filter-warning">The religion filter does not permit any values at all. The filter will therefore not match <em>any</em> evidence. This is probably an oversight.</span>'

        ret = 'The evidence must be attributed to a place where <em>at least</em> one of the following combinations of religious groups have, at some point, existed based on evidence in the database:<ul>'
        rets = []

        for rels in religion_filter['filter']:
            cursor.execute('SELECT name FROM religion WHERE id = ANY(%(rids)s) ORDER BY name;', rids=rels)
            relnames = list(map(lambda x: F'<strong>{x.name}</strong>', cursor.fetchall()))

            if len(relnames) == 1:
                s = F'{relnames[0]}'
            elif len(relnames) == 2:
                s =  F'{relnames[0]} and {relnames[1]}'
            else:
                rs = ', '.join(relnames[:-1])
                rz = relnames[-1]

                s = F'{rs}, and {rz}'

            rets.append(s)

        if len(rets) == 1:
            ret += F'<li>{rets[0]}.</li>'
        else:
            for r in rets[:-2]:
                ret += F'<li>{r};</li>'
            ret += F'<li>{rets[-2]}; or</li><li>{rets[-1]}.</li>'
        ret += '</ul>'
        return ret


def _verbalize_sources(source_filter, cursor):
    if source_filter is None:
        return None

    if len(source_filter) == 0:
        return F'<span class="verbalization-restrictive-filter-warning">The source filter does not permit any values at all. The filter will therefore not match <em>any</em> evidence. This is probably an oversight.</span>'

    cursor.execute('SELECT name FROM source WHERE id = ANY(%(s)s);', s=source_filter)
    source_names = ''.join(map(lambda x: F'<li>{x.name}</li>', list(cursor.fetchall())))
    return F'The evidence must be based upon at least one of the following sources: <ul>{source_names}</ul>'


_confs = ["certain","probable","contested","uncertain","false",None]
def _cstr(cv):
    if cv is None:
        return '<em>no value</em>'
    return F'<strong>{cv}</strong>'
def _verbalize_confidence(confidence_filter, key, name, cursor):
    vals = confidence_filter[key]
    if len(vals) == 0:
        return F'<span class="verbalization-restrictive-filter-warning">The confidence aspect <code>{key}</code> does not permit any values at all. The filter will therefore not match <em>any</em> evidence. This is probably an oversight.</span>'

    if all(map(lambda x: x in vals, _confs)):
        return None  # no restriction

    if len(vals) == 1:
        return F'{name} must be {_cstr(vals[0])}.'

    if len(vals) == 2:
        return F'{name} must be either {_cstr(vals[0])} or {_cstr(vals[1])}.'

    vs = ', '.join(map(_cstr, vals[:-1]))
    vz = _cstr(vals[-1])
    return F'{name} must be {vs}, or {vz}.'


def _verbalize_time(time_filter, cursor):
    if time_filter is None:
        return None

    start, end = tuple(time_filter)
    return F'The evidence must have at least one time instance that intersects with the <em>closed interval</em> <strong>{start}&ndash;{end}</strong>.'


def _verbalize_tags(tag_filter, cursor):
    if tag_filter is True:
        return None
    elif type(tag_filter) is int or len(tag_filter) == 1:
        if type(tag_filter) is list:
            tag_filter = tag_filter[0]
        tagname = cursor.one('SELECT tagname FROM tag WHERE id = %s;', (tag_filter,))
        return F'The evidence must have the tag <strong>{tagname}</strong>.'
    else:
        if len(tag_filter) == 0:
            return F'<span class="verbalization-restrictive-filter-warning">The tag filter does not permit any values at all. The filter will therefore not match <em>any</em> evidence. This is probably an oversight.</span>'

        cursor.execute('SELECT tagname FROM tag WHERE id = ANY(%(tags)s) ORDER BY tagname;', tags=tag_filter)
        tags = list(cursor.fetchall())
        if len(tags) == 2:
            t1, t2 = tuple(tags)
            return F'The evidence must have one or more of the tags <strong>{t1.tagname}</strong> or <strong>{t2.tagname}</strong>.'
        tx = tags[:-1]
        ty = tags[-1]
        ts = ', '.join(map(lambda t: F'<strong>{t.tagname}</strong>', tx))
        return F'The evidence must have one or more of the following tags: {ts}, or <strong>{ty.tagname}</strong>.'



def get_filter_description(filters, cursor):
    return {
            'implicit': [
                'The evidence must be <em>visible.</em>',
                'The place must be <em>visible.</em>',
                'The place type must be <em>visible.</em>',
                ],
            'explicit': verbalize(filters, cursor),
            }
