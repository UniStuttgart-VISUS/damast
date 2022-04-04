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
        'The confidence of interpretation regarding the piece of evidence',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'location_confidence',
        'The location confidence regarding the location attributed to the piece of evidence',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'place_attribution_confidence',
        'The place attribution confidence regarding the place attributed to the piece of evidence',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'religion_confidence',
        'The religion confidence regarding the piece of evidence',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'time_confidence',
        'The time confidence of \\emph{at least one} of the time instances attributed to the piece of evidence',
        cursor))

    verbs.append(_verbalize_confidence(filters['confidence'],
        'source_confidences',
        'The source confidence of \\emph{at least one} source the piece of evidence was based upon',
        cursor))

    verbs.append(_verbalize_sources(filters['sources'], cursor))
    verbs.append(_verbalize_tags(filters['tags'], cursor))

    return list(filter(lambda x: x is not None, verbs))


def _verbalize_location(location_filter, cursor):
    if location_filter is None:
        return None

    geojson_tight = json.dumps(location_filter)
    content = ''
    while len(geojson_tight) > 0:
        i = min(65, len(geojson_tight) - 1)
        while geojson_tight[i] != ' ' and i < len(geojson_tight) - 1:
            i += 1

        content += '\n'+geojson_tight[:i+1]
        geojson_tight = geojson_tight[i+1:]

    return '''The place of the piece of evidence is either \\emph{unplaced} or located within the following GeoJSON boundaries:

        {\\small\\begin{verbatim}%s\\end{verbatim}}''' % content


def _verbalize_places(place_filter, cursor):
    if place_filter is None:
        return None

    cursor.execute('SELECT name FROM place WHERE id = ANY(%(pids)s);', pids=place_filter)
    placenames = list(map(lambda x: x.name, cursor.fetchall()))
    placenames = sort_placenames(placenames)
    placenames = list(map(lambda x: '\\textbf{%s}'%x, placenames))

    if len(placenames) == 0:
        return 'The place filter does not permit any values at all. The filter will therefore not match \emph{any} evidence. This is probably an oversight.'


    if len(placenames) == 1:
        return F'The piece of evidence must be placed in {placenames[0]}.'
    elif len(placenames) == 2:
        return F'The piece of evidence must be placed in either {placenames[0]} or {placenames[1]}.'

    rs = ', '.join(placenames[:-1])
    rz = placenames[-1]

    return F'The piece of evidence must be placed in one of the following places: {rs}, or {rz}.'


def _verbalize_religion(religion_filter, cursor):
    if religion_filter == True:
        return None

    elif religion_filter['type'] == 'simple':
        rels = religion_filter['filter']
        if len(rels) == 0:
            return 'The religion filter does not permit any values at all. The filter will therefore not match \emph{any} evidence. This is probably an oversight.'

        cursor.execute('SELECT name FROM religion WHERE id = ANY(%(rids)s) ORDER BY name;', rids=rels)
        relnames = list(map(lambda x: '\\textbf{%s}'%x.name, cursor.fetchall()))

        if len(relnames) == 1:
            return F'The piece of evidence must reference the religious group {relnames[0]}.'
        elif len(relnames) == 2:
            return F'The piece of evidence must reference either of the religious groups {relnames[0]} or {relnames[1]}.'

        rs = ', '.join(relnames[:-1])
        rz = relnames[-1]

        return F'The piece of evidence must reference one of the following religious groups: {rs}, or {rz}.'


    else:
        count = 0
        for v in religion_filter['filter']:
            count += len(v)
        if count == 0:
            return 'The religion filter does not permit any values at all. The filter will therefore not match \\emph{any} evidence. This is probably an oversight.'

        ret = 'The piece of evidence must be attributed to a place where \\emph{at least} one of the following combinations of religious groups have, at some point, existed based on evidence in the database:\\begin{itemize}'
        rets = []

        for rels in religion_filter['filter']:
            cursor.execute('SELECT name FROM religion WHERE id = ANY(%(rids)s) ORDER BY name;', rids=rels)
            relnames = list(map(lambda x: '\\textbf{%s}'%x.name, cursor.fetchall()))

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
            ret += F'\\item %s. ' % rets[0]
        else:
            for r in rets[:-2]:
                ret += F'\\item %s; ' % r
            ret += F'\\item %s; or %s. ' % (rets[-2], rets[-1])
        ret += '\\end{itemize} '
        return ret


def _verbalize_sources(source_filter, cursor):
    if source_filter is None:
        return None

    if len(source_filter) == 0:
        return 'The source filter does not permit any values at all. The filter will therefore not match \\emph{any} evidence. This is probably an oversight.'

    cursor.execute('SELECT name FROM source WHERE id = ANY(%(s)s);', s=source_filter)
    source_names = ''.join(map(lambda x: F'\\item %s ' % x.name, list(cursor.fetchall())))
    return 'The piece of evidence must be based upon at least one of the following sources: \\begin{itemize} %s \\end{itemize} ' % source_names


_confs = ["certain","probable","contested","uncertain","false",None]
def _cstr(cv):
    if cv is None:
        return '\\emph{no value}'
    return '\\textbf{%s}' % cv
def _verbalize_confidence(confidence_filter, key, name, cursor):
    vals = confidence_filter[key]
    if len(vals) == 0:
        return 'The confidence aspect \\texttt{%s} does not permit any values at all. The filter will therefore not match \\emph{any} evidence. This is probably an oversight.' % key

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
    return 'The piece of evidence must have at least one time instance that intersects with the \\emph{closed interval} \\textbf{%s}--\\textbf{%s}.' % (start, end)


def _verbalize_tags(tag_filter, cursor):
    if tag_filter is True:
        return None
    elif type(tag_filter) is int or len(tag_filter) == 1:
        if type(tag_filter) is list:
            tag_filter = tag_filter[0]
        tagname = cursor.one('SELECT tagname FROM tag WHERE id = %s;', (tag_filter,))
        return 'The piece of evidence must have the tag \\textbf{%s}.' % tagname
    else:
        if len(tag_filter) == 0:
            return 'The tag filter does not permit any values at all. The filter will therefore not match \\emph{any} evidence. This is probably an oversight.'

        cursor.execute('SELECT tagname FROM tag WHERE id = ANY(%(tags)s) ORDER BY tagname;', tags=tag_filter)
        tags = list(cursor.fetchall())
        if len(tags) == 2:
            t1, t2 = tuple(tags)
            return 'The piece of evidence must have one or more of the tags \\textbf{%s} or \\textbf{%s}.' % (t1.tagname, t2.tagname)
        tx = tags[:-1]
        ty = tags[-1]
        ts = ', '.join(map(lambda t: '\\textbf{%s}' % t.tagname, tx))
        return 'The piece of evidence must have one or more of the following tags: %s, or \\textbf{%s}.' % (ts, ty.tagname)



def get_filter_description(filters, cursor):
    return {
            'implicit': [
                'The piece of evidence must be \emph{visible.}',
                'The place must be \emph{visible.}',
                'The place type must be \emph{visible.}',
                ],
            'explicit': verbalize(filters, cursor),
            }
