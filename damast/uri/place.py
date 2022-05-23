import flask
import os
import re
import subprocess
import werkzeug.exceptions
from datetime import date
from functools import lru_cache
from psycopg2.extras import NumericRange
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..postgres_rest_api.decorators import rest_endpoint
from ..postgres_rest_api.util import parse_geoloc
from ..map_styles import app as map_styles
from ..reporting.place_sort import sort_alternative_placenames, sort_placenames

app = AuthenticatedBlueprintPreparator('place', __name__, template_folder='templates')
app.register_blueprint(map_styles)


@app.route('/', role=['user', 'visitor'])
@rest_endpoint  # used to ensure the user has `readdb` role
def root(cursor):
    return flask.render_template('uri/place-search.html')

_place_id_list_pattern = re.compile('^(\d+(,\d+)*)?$')

@app.route('/uri/link-list', role='user')
@rest_endpoint
def get_link_list(cursor):
    pids = flask.request.args.get('place_ids', '')
    if not _place_id_list_pattern.fullmatch(pids):
        raise werkzeug.exceptions.BadRequest('place_ids argument must be comma-separated list of integers')

    place_ids = list(map(int, pids.split(',')))
    query = cursor.mogrify('''
        SELECT
            P.id,
            P.name,
            PT.type
        FROM place P
        JOIN place_type PT ON P.place_type_id = PT.id
        WHERE P.id = ANY(%s);
    ''', (place_ids,))
    cursor.execute(query)
    places = list(map(lambda x: x._asdict(), cursor.fetchall()))
    places = sort_placenames(places, keyfn=lambda p: p['name'])

    return flask.render_template('uri/place-link-list.html', places=places)


@app.route('/<int:place_id>', role=['user', 'visitor'])
@rest_endpoint
def get_place(cursor, place_id):
    acceptable = [
            ('text/html', render_html),
            #('application/json', render_json),
            ]

    if not any(map(lambda i: flask.request.accept_mimetypes[i[0]] > 0, acceptable)):
        mimes = ', '.join(map(lambda x: x[0], acceptable))
        raise werkzeug.exceptions.NotAcceptable(F'Requested mimetype not available, only {mimes} supported at the moment.')

    acceptable.sort(key=lambda x: flask.request.accept_mimetypes[x[0]], reverse=True)
    mime, render_fn = acceptable[0]

    if 0 == cursor.one('SELECT COUNT(*) FROM place_overview WHERE id = %s;', (place_id,)):
        raise werkzeug.exceptions.NotFound(F'No place with ID {place_id}.')

    # PLACE
    place = cursor.one('SELECT * FROM place WHERE id = %s;', (place_id,))._asdict()
    place['geoloc'] = parse_geoloc(place['geoloc'])
    if place['geoloc'] is not None:
        ns = 'N' if place['geoloc']['lat'] > 0 else 'S'
        ew = 'E' if place['geoloc']['lng'] > 0 else 'W'
        lat = abs(place['geoloc']['lat'])
        lng = abs(place['geoloc']['lng'])
        place['geoloc_str'] = F'{ns}&thinsp;{lat:.6f}&deg; {ew}&thinsp;{lng:.6f}&deg;'

    # PLACE_TYPE
    place_type = cursor.one('SELECT * FROM place_type WHERE id = %s;', (place['place_type_id'],))._asdict()

    # NAME_VAR
    query = cursor.mogrify('''SELECT
        N.name,
        N.transcription,
        L.name AS language
    FROM name_var N
    JOIN language L ON L.id = N.language_id
    WHERE N.place_id = %s
    ORDER BY L.id ASC;''', (place_id,))
    cursor.execute(query)
    alternative_names = sort_alternative_placenames(cursor.fetchall())

    # EXTERNAL_URI
    query = cursor.mogrify('''SELECT
        format(UN.short_name, EPU.uri_fragment) AS short,
        format(UN.uri_pattern, EPU.uri_fragment) AS uri,
        EPU.comment,
        ED.name
    FROM external_place_uri EPU
    JOIN uri_namespace UN ON EPU.uri_namespace_id = UN.id
    JOIN external_database ED ON UN.external_database_id = ED.id
    WHERE EPU.place_id = %s
    ORDER BY (ED.name, EPU.uri_fragment);''', (place_id,))
    cursor.execute(query)
    external_uris = list(cursor.fetchall())

    # RELIGIONS
    query = cursor.mogrify('''SELECT DISTINCT R.id
    FROM evidence E
    LEFT JOIN religion_instance RI
      ON E.religion_instance_id = RI.id
    LEFT JOIN religion R
      ON RI.religion_id = R.id
    LEFT JOIN place_instance PI
      ON E.place_instance_id = PI.id
    LEFT JOIN place P
      ON P.id = PI.place_id
    WHERE P.id = %s;''', (place_id,))
    cursor.execute(query)
    religion_ids = list(map(lambda x: x.id, cursor.fetchall()))

    # RELIGION ORDER
    cursor.execute('SELECT * FROM religion')
    rels = list(map(lambda x: x._asdict(), cursor.fetchall()))

    def append_children(parent, lst):
        children = list(filter(lambda x: x['parent_id'] == parent['id'], lst))
        parent['children'] = children
        for child in children:
            append_children(child, lst)
        return parent

    toplevel = list(map(lambda x: append_children(x, rels), filter(lambda x: x['parent_id'] is None, rels)))
    rel_order = []

    def traverse(node):
        rel_order.append(node['id'])
        if node['children'] is not None:
            for child in node['children']:
                traverse(child)

    for t in toplevel:
        traverse(t)

    religion_ids.sort(key=lambda rid: rel_order.index(rid))

    # EVIDENCES
    by_religion = []
    all_source_ids = set()
    for rid in religion_ids:
        religion = cursor.one('SELECT id, name FROM religion WHERE id = %s;', (rid,))._asdict()

        query = cursor.mogrify('''SELECT TI.span,
            (
                SELECT array_agg(SI.source_id)
                FROM source_instance SI
                WHERE SI.evidence_id = E.id
                GROUP BY evidence_id
            ) AS source_ids
        FROM evidence E
        LEFT JOIN religion_instance RI
          ON E.religion_instance_id = RI.id
        LEFT JOIN religion R
          ON R.id = RI.religion_id
        LEFT JOIN place_instance PI
          ON E.place_instance_id = PI.id
        LEFT JOIN place P
          ON P.id = PI.place_id
        LEFT JOIN place_type PT
          ON P.place_type_id = PT.id
        LEFT JOIN time_instance TI
          ON E.time_group_id = TI.time_group_id
        WHERE P.id = %s
          AND E.visible
          AND P.visible
          AND PT.visible
          AND R.id = %s
        ORDER BY E.id ASC;''', (place_id, rid,))

        cursor.execute(query)
        evidences = cursor.fetchall()
        time_spans = None

        if all(map(lambda e: e.span is None and e.source_ids is None, evidences)):
            time_spans = [ (None, None), ]
        elif all(map(lambda e: e.span is None, evidences)):
            sids = set()
            for e in evidences:
                if e.source_ids is not None:
                    sids.update(e.source_ids)

            all_source_ids.update(sids)
            time_spans = [ (None, list(sids)) ]

        else:
            time_spans = []

            without_time = list(filter(lambda x: x.span is None or ( x.span.lower_inf and x.span.upper_inf ), evidences))
            with_time = list(filter(lambda x: x.span is not None and not ( x.span.lower_inf and x.span.upper_inf ), evidences))

            if len(without_time) > 0:
                without_time_sources = set()
                for w in without_time:
                    if w.source_ids is not None:
                        without_time_sources.update(w.source_ids)

                all_source_ids.update(without_time_sources)
                without_time_sources = None if len(without_time_sources) == 0 else list(without_time_sources)

                time_spans.append((None, without_time_sources))

            with_time.sort(key = lambda x: 0 if x.span.lower_inf else x.span.lower if x.span.lower_inc else x.span.lower+1)
            with_time = list(map(lambda x: x._asdict(), with_time))

            for w in with_time:
                if w['source_ids'] is not None:
                    all_source_ids.update(w['source_ids'])

            while len(with_time) > 1:
                first = with_time[0]
                second = with_time[1]
                with_time = with_time[2:]

                overlapping = cursor.one('SELECT %(first)s::int4range && %(second)s::int4range;', first=first['span'], second=second['span'])
                if overlapping:
                    total_timespan = cursor.one('SELECT %(first)s::int4range + %(second)s::int4range;', first=first['span'], second=second['span'])
                    total_sources = list(set([*first['source_ids'], *second['source_ids']]))

                    total = dict(span=total_timespan, source_ids=total_sources)
                else:
                    time_spans.append((first['span'], first['source_ids']))
                    total = second

                with_time = [ total, *with_time ]

            if len(with_time) == 1:
                time_spans.append((with_time[0]['span'], with_time[0]['source_ids']))

        ts2 = []
        for t,s in time_spans:
            if isinstance(t, NumericRange):
                a = t.lower if t.lower_inc else t.lower+1
                b = t.upper if t.upper_inc else t.upper-1
                ts2.append((dict(start=a, end=b), s))
            else:
                ts2.append((t,s))

        by_religion.append(dict(religion=religion, time_spans=ts2))


    # PERSONS
    cursor.execute('''SELECT PE.id AS person_id,
        PE.name AS person_name,
        PE.time_range AS person_time_range,
        PEI.id AS person_instance_id,
        ( SELECT array_agg(span) FROM time_instance TI WHERE TI.time_group_id = E.time_group_id GROUP BY TI.time_group_id ) AS time_ranges,
        ( SELECT array_agg(S.id) FROM source S JOIN source_instance SI ON S.id = SI.source_id WHERE SI.evidence_id = E.id GROUP BY E.id ) AS source_ids
    FROM evidence E
    JOIN place_instance PI ON E.place_instance_id = PI.id
    JOIN place P ON PI.place_id = P.id
    JOIN place_type PT ON P.place_type_id = PT.id
    JOIN person_instance PEI ON E.person_instance_id = PEI.id
    JOIN person PE ON PEI.person_id = PE.id
    WHERE P.id = %(place_id)s
      AND E.visible
      AND P.visible
      AND PT.visible;''', place_id=place_id)
    person_ids = list(cursor.fetchall())

    persons = set(map(lambda x: x.person_id, person_ids))
    person_data = []
    for pid in persons:
        data = list(filter(lambda x: x.person_id == pid, person_ids))
        person = {
            "id": pid,
            "name": data[0].person_name,
            "time_range": data[0].person_time_range,
                }

        times = []
        person_has_unknowns = False
        for datum in data:
            startpoint = None

            # only one entry with neither time nor source
            if datum.time_ranges is None and datum.source_ids is None:
                if person_has_unknowns:
                    continue
                else:
                    person_has_unknowns = True

            if datum.time_ranges is None:
                timestr = '<em>with no time information</em>'
            else:
                datum.time_ranges.sort(key = lambda x: x.lower if x.lower_inc else x.lower+1)
                timestr_ = []
                for t in datum.time_ranges:
                    a = t.lower if t.lower_inc else t.lower+1
                    b = t.upper if t.upper_inc else t.upper-1

                    if startpoint is None or a < startpoint:
                        startpoint = a

                    if a==b:
                        timestr_.append(str(a))
                    else:
                        timestr_.append(F'{a}&ndash;{b}')

                timestr = ', '.join(timestr_)

            times.append(dict(timestr=timestr, source_ids=datum.source_ids, startpoint=startpoint))

            times.sort(key=lambda x: x['startpoint'] or -20000)
            person['times'] = times
        person_data.append(person)

    # SOURCES
    cursor.execute('SELECT S.*, ST.name AS source_type FROM source S JOIN source_type ST ON S.source_type_id = ST.id WHERE S.id = ANY(%(sids)s);', sids=list(all_source_ids))
    sources = { s.id: s._asdict() for s in cursor.fetchall() }

    # SOURCE INSTANCES
    query = cursor.mogrify('''SELECT S.id AS source_id,
       array_agg(SI.source_page) AS source_pages
    FROM evidence E
    LEFT JOIN place_instance PI
      ON E.place_instance_id = PI.id
    LEFT JOIN place P
      ON P.id = PI.place_id
    LEFT JOIN place_type PT
      ON P.place_type_id = PT.id
    LEFT JOIN source_instance SI
      ON E.id = SI.evidence_id
    LEFT JOIN source S
      ON SI.source_id = S.id
    WHERE P.id = %s
      AND E.visible
      AND P.visible
      AND PT.visible
    GROUP BY S.id;''', (place_id,))
    cursor.execute(query)
    source_pages = dict()
    for p in cursor.fetchall():
        if p.source_id is not None:
            pagelist = sorted(list(filter(lambda x: x is not None, set(p.source_pages))))
            if len(pagelist) > 0:
                source_pages[p.source_id] = ', '.join(pagelist)
            else:
                source_pages[p.source_id] = None

    now_ = date.today()
    now = now_.strftime('%Y-%m-%d')
    now_fmt = now_.strftime('%B %-d, %Y')

    data = {
            "now": now,
            "now_fmt": now_fmt,
            "url_root": flask.request.url_root,
            "place": place,
            "place_type": place_type,
            "alternative_names": alternative_names,
            "external_uris": external_uris,
            "by_religion": by_religion,
            "sources": sources,
            "source_pages": source_pages,
            "persons": person_data,
            }

    response = flask.make_response(render_fn(**data))
    response.vary.add('Accept')

    return response


def render_html(**kwargs):
    return flask.render_template('uri/place.html', **kwargs)


def render_json(**kwargs):
    return flask.jsonify(kwargs)

