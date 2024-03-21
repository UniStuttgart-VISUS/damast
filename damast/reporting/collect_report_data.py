import math
import json

import psycopg2.extras

from .datatypes import Evidence, Place

from .place_sort import sort_placenames, sort_alternative_placenames, sort_evidence


def create_filter_list(cursor, filters):
    q_filters = [
        # visibility settings of evidence, place, and place type
        cursor.mogrify('E.visible', tuple()),
        cursor.mogrify('P.visible', tuple()),
        cursor.mogrify('PT.visible', tuple()),
            ]

    if filters['religion'] != True:
        if filters['religion']['type'] == 'complex':
            # pre-select evidences with any of the contained religions
            all_religion_ids = set()
            for arr in filters['religion']['filter']:
                all_religion_ids.update(arr)
            all_religion_ids = list(all_religion_ids)
            q_filters.append(cursor.mogrify('RI.religion_id = ANY(%s)', (all_religion_ids,)))

        else:
            # simple religion filter
            q_filters.append(cursor.mogrify('RI.religion_id = ANY(%s)', (filters['religion']['filter'],)))

    for table, key, key2 in [
        ('RI', 'religion_confidence', 'confidence'),
        ('P', 'location_confidence', 'confidence'),
        ('PI', 'place_attribution_confidence', 'confidence'),
        ('TI', 'time_confidence', 'confidence'),
        ('SI', 'source_confidences', 'source_confidence'),
        ('E', 'interpretation_confidence', 'interpretation_confidence'),
            ]:
        f = filters['confidence'][key]
        if None in f:
            f2 = list(filter(lambda x: x is not None, f))
            q_filters.append(cursor.mogrify(F'({table}.{key2} IS NULL OR {table}.{key2} = ANY(%s::confidence_value[]))', (f2,)))
        else:
            q_filters.append(cursor.mogrify(F'{table}.{key2} = ANY(%s::confidence_value[])', (f,)))

    if filters['tags'] != True:
        if type(filters['tags']) is int:
            q_filters.append(cursor.mogrify('%s = ANY(tag_ids)', (filters['tags'],)))
        else:
            q_filters.append(cursor.mogrify('%s && tag_ids', (filters['tags'],)))

    if filters['sources'] != None:
        q_filters.append(cursor.mogrify('SI.source_id = ANY(%s)', (filters['sources'],)))

    if filters['time'] != None:
        q_filters.append(cursor.mogrify('(TI.span IS NOT NULL AND NOT (upper_inf(TI.span) OR lower_inf(TI.span)) AND TI.span && %s)',
            (psycopg2.extras.NumericRange(lower=filters['time'][0], upper=filters['time'][1], bounds='[]'), )))

    if filters['location'] != None:
        q_filters.append(cursor.mogrify("""( P.geoloc IS NULL
            OR ST_Contains(
                ST_SetSRID(ST_GeomFromGeoJSON(json(%s)->>'geometry'), 4326),
                ST_SetSRID(ST_Point(P.geoloc[1], P.geoloc[0]), 4326)
            ))""", (json.dumps(filters['location']),)))

    if filters['places'] != None:
        q_filters.append(cursor.mogrify('P.id = ANY(%s)', (filters['places'],)))

    return q_filters



def collect_report_data(cursor, filters, religion_filter = True):
    query = '''SELECT DISTINCT E.id, RI.religion_id, PI.place_id
FROM evidence E
  LEFT JOIN religion_instance RI
    ON E.religion_instance_id = RI.id
  LEFT JOIN place_instance PI
    ON E.place_instance_id = PI.id
  LEFT JOIN place P
    ON P.id = PI.place_id
  LEFT JOIN place_type PT
    ON PT.id = P.place_type_id
  LEFT JOIN person_instance PEI
    ON E.person_instance_id = PEI.id
  LEFT JOIN time_instance TI
    ON E.time_group_id = TI.time_group_id
  LEFT JOIN source_instance SI
    ON SI.evidence_id = E.id
  LEFT JOIN (SELECT evidence_id, array_agg(tag_id) AS tag_ids FROM tag_evidence GROUP BY evidence_id) TE
    ON E.id = TE.evidence_id'''

    if len(filters) > 0:
        query += ' WHERE ' + ' AND '.join(map(lambda x: x.decode('utf-8'), filters))

    query += ' ORDER BY E.id;'

    cursor.execute(query)
    if religion_filter == True or religion_filter['type'] == 'simple':
        evidence_ids = list(map(lambda x: x.id, cursor.fetchall()))
    else:
        variants = religion_filter['filter']
        per_place = dict()
        result = list(cursor.fetchall())
        for t in result:
            pp = per_place.get(t.place_id, set())
            pp.add(t.religion_id)
            per_place[t.place_id] = pp

        valid_place_ids = set()
        for place_id, religion_ids in per_place.items():
            if any(map(lambda x: all(map(lambda y: y in religion_ids, x)), variants)):
                valid_place_ids.add(place_id)

        evidence_ids = [ t.id for t in result if t.place_id in valid_place_ids ]


    # short-circuit if no evidences
    if len(evidence_ids) == 0:
        raise ValueError('The provided filters did not match any evidences. No report was generated.')


    # get all source instance data
    query = cursor.mogrify('SELECT * FROM source_instance WHERE evidence_id = ANY(%s);', (evidence_ids,))
    cursor.execute(query)
    source_instances = list(cursor.fetchall())

    # get all source data
    query = cursor.mogrify('''SELECT
        S.id AS id,
        S.name AS name,
        ST.name AS source_type,
        short
    FROM source S
    JOIN source_type ST
    ON S.source_type_id = ST.id
    WHERE S.id = ANY(%s)
    ORDER BY S.id ASC;''', (list(map(lambda x: x.source_id, source_instances)),))
    cursor.execute(query)
    sources_ = list(cursor.fetchall())
    sources = []
    source_lut = dict()
    for i, s in enumerate(sources_, 1):
        sources.append((i, s))
        source_lut[s.id] = i

    # get all evidence data
    query = cursor.mogrify('''SELECT
        E.id,
        E.comment AS evidence_comment,
        E.interpretation_confidence,
        E.visible AS evidence_visible,
        (
            SELECT array_agg(row_to_json(TI.*))
            FROM time_instance TI
            WHERE TI.time_group_id = E.time_group_id
            GROUP BY TI.time_group_id
        ) AS time_instances,
        PI.confidence AS place_attribution_confidence,
        P.confidence AS location_confidence,
        PI.comment AS place_instance_comment,
        P.comment AS place_comment,
        P.name AS place_name,
        P.id AS place_id,
        P.geoloc AS place_geoloc,
        PT.type AS place_type,
        PEI.confidence AS person_confidence,
        PEI.comment AS person_instance_comment,
        PE.comment AS person_comment,
        PE.name AS person_name,
        PE.time_range AS person_time_range,
        PE.id AS person_id,
        PET.type AS person_type,
        RI.confidence AS religion_confidence,
        RI.comment AS religion_instance_comment,
        R.name AS religion,
        R.id AS religion_id
    FROM evidence E
    LEFT JOIN religion_instance RI
      ON E.religion_instance_id = RI.id
    LEFT JOIN religion R
      ON RI.religion_id = R.id
    LEFT JOIN place_instance PI
      ON E.place_instance_id = PI.id
    LEFT JOIN place P
      ON P.id = PI.place_id
    LEFT JOIN place_type PT
      ON P.place_type_id = PT.id
    LEFT JOIN person_instance PEI
      ON E.person_instance_id = PEI.id
    LEFT JOIN person PE
      ON PEI.person_id = PE.id
    LEFT JOIN person_type PET
      ON PE.person_type = PET.id
    WHERE E.id = ANY(%s)
    ORDER BY E.id ASC;''', (evidence_ids,))

    cursor.execute(query)
    evidences = []
    for evidence in list(cursor.fetchall()):
        cursor.execute('''SELECT
            SI.id,
            SI.source_id,
            SI.source_page,
            SI.source_confidence,
            SI.comment,
            S.short
        FROM source_instance SI
        JOIN source S ON S.id = SI.source_id
        WHERE SI.evidence_id = %(eid)s;''', eid=evidence.id)
        evidences.append(Evidence(evidence, list(cursor.fetchall())))

    # sort evidences first by city name, then by religion name, then by start of first time span
    evidences = sorted(evidences, key=sort_evidence)


    source_evidence = { s.id: list(map(lambda e: e.evidence.id, filter(lambda e: any(map(lambda si: si.source_id == s.id, e.source_instances)), evidences))) for _, s in sources }

    # place_data
    query = cursor.mogrify('''SELECT
        P.id,
        P.name,
        P.confidence,
        P.comment,
        P.geoloc,
        ( SELECT array_agg(eid) FROM ( SELECT unnest(array_agg(E.id)) AS eid ORDER BY eid) AS _) AS evidence_ids,
        PT.type AS place_type
    FROM evidence E
    JOIN place_instance PI ON E.place_instance_id = PI.id
    JOIN place P ON P.id = PI.place_id
    JOIN place_type PT ON P.place_type_id = PT.id
    WHERE E.id = ANY(%s)
    GROUP BY (P.id, PT.id)
    ORDER BY P.name ASC;''', (evidence_ids,))
    cursor.execute(query)
    places_ = list(cursor.fetchall())

    places = []
    for place in places_:
        query = cursor.mogrify('''SELECT
            N.name,
            N.transcription,
            L.name AS language
        FROM name_var N
        JOIN language L ON L.id = N.language_id
        WHERE N.place_id = %s
        ORDER BY L.id ASC;''', (place.id,))
        cursor.execute(query)
        alternative_names = sort_alternative_placenames(cursor.fetchall())

        query = cursor.mogrify('''SELECT
            format(UN.short_name, EPU.uri_fragment) AS short,
            format(UN.uri_pattern, EPU.uri_fragment) AS uri,
            EPU.comment,
            ED.name,
            EPU.id
        FROM external_place_uri EPU
        JOIN uri_namespace UN ON EPU.uri_namespace_id = UN.id
        JOIN external_database ED ON UN.external_database_id = ED.id
        WHERE EPU.place_id = %s
        ORDER BY (ED.name, EPU.uri_fragment);''', (place.id,))
        cursor.execute(query)
        external_uris = list(cursor.fetchall())

        places.append(Place(place, external_uris, alternative_names))

    places = sort_placenames(places, keyfn=lambda place: place.place.name)

    # religion data
    cursor.execute('''SELECT
        R.id,
        R.name,
        R.color,
        R.parent_id,
        ( SELECT array_agg(eid) FROM ( SELECT unnest(array_agg(E.id)) AS eid ORDER BY eid) AS _) AS evidence_ids
    FROM evidence E
    JOIN religion_instance RI ON E.religion_instance_id = RI.id
    JOIN religion R ON RI.religion_id = R.id
    WHERE E.id = ANY(%(evidence_ids)s)
    GROUP BY R.id
    ORDER BY R.name;''', evidence_ids=evidence_ids)
    religions = list(cursor.fetchall())

    # person_data
    cursor.execute('''SELECT
        P.id,
        P.name,
        P.time_range,
        PT.type AS person_type,
        ( SELECT array_agg(eid) FROM ( SELECT unnest(array_agg(E.id)) AS eid ORDER BY eid) AS _) AS evidence_ids
    FROM evidence E
        JOIN person_instance PI ON E.person_instance_id = PI.id
        JOIN person P ON PI.person_id = P.id
        JOIN person_type PT ON P.person_type = PT.id
    WHERE E.id = ANY(%(evidence_ids)s)
    GROUP BY (P.id, PT.id)
    ORDER BY (P.name, P.id) ASC;''', evidence_ids=evidence_ids)
    persons = list(cursor.fetchall())

    # time instances
    cursor.execute('''SELECT
        E.id AS evidence_id,
        T.id,
        CASE WHEN lower_inc(T.span) THEN lower(T.span) ELSE lower(T.span) + 1 END AS start_year,
        CASE WHEN upper_inc(T.span) THEN upper(T.span) ELSE upper(T.span) - 1 END AS end_year,
        T.confidence
    FROM evidence E
        JOIN time_instance T ON E.time_group_id = T.time_group_id
    WHERE T.span IS NOT NULL
    AND NOT (lower(T.span) IS NULL AND upper(T.span) IS NULL)
    AND E.id = ANY(%(evidence_ids)s)
    ORDER BY (
        E.id,
        CASE WHEN lower_inc(T.span) THEN lower(T.span) ELSE lower(T.span) + 1 END,
        CASE WHEN upper_inc(T.span) THEN upper(T.span) ELSE upper(T.span) - 1 END
    ) ASC;''', evidence_ids=evidence_ids)
    _time_instances = list(cursor.fetchall())

    _evidences = list(set(map(lambda x: x.evidence_id, _time_instances)))
    num_evidences = len(_evidences)

    # get time range
    starts = list(filter(lambda x: x is not None, map(lambda x: x.start_year, _time_instances)))
    ends = list(filter(lambda x: x is not None, map(lambda x: x.end_year, _time_instances)))

    yr0 = None if len(starts) == 0 else min(starts)
    yr1 = None if len(ends) == 0 else max(ends)

    if yr0 is None and yr1 is None:
        yr0 = 0
        yr1 = 1
    elif yr0 is None:
        yr0 = yr1 - 1
    elif yr1 is None:
        yr1 = yr0 + 1


    _yrs = set(range(100 * math.ceil(yr0/100), 100 * math.floor(yr1/100) + 1, 100))
    _yrs.add(yr0)
    _yrs.add(yr1)
    yrs = sorted(_yrs)

    time_instances=[ (i, e, list(filter(lambda x: x.evidence_id == e, _time_instances))) for i, e in enumerate(_evidences) ]

    time_data = dict(year_start=yr0, year_end=yr1, ticks=yrs, num_evidences=num_evidences, time_instances=time_instances)

    cursor.execute('select * from religion')
    reldata = list(map(lambda x: x._asdict(), cursor.fetchall()))

    def append_children(parent, lst):
        children = list(filter(lambda x: x['parent_id'] == parent['id'], lst))
        parent['children'] = children
        for child in children:
            append_children(child, lst)
        return parent

    toplevel = list(map(lambda x: append_children(x, reldata), filter(lambda x: x['parent_id'] is None, reldata)))
    all_religions = []
    def traverse(lst):
        for r in sorted(lst, key=lambda x: x['id']):
            all_religions.append({'id': r['id'], 'name': r['name'], 'color': r['color']})
            traverse(r['children'])

    traverse(toplevel)


    return dict(
            evidence_ids = evidence_ids,
            evidences=evidences,
            sources=sources,
            source_lut=source_lut,
            source_instances=source_instances,
            source_evidence=source_evidence,
            places=places,
            religions=religions,
            persons=persons,
            time_data=time_data,
            all_religions=all_religions,
            )
