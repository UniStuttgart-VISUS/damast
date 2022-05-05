import flask
import psycopg2
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions

from .util import parse_place,parse_geoloc,format_geoloc
from .user_action import add_user_action

from .decorators import rest_endpoint

name = 'place'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


from .uri.uri_list_for_place import app as uri_list_for_place
app.register_blueprint(uri_list_for_place)


@app.route('/place/all', role='user')
@rest_endpoint
def place_data_all(c):
    '''
    Get content of table `place` as a list of dicts.

    @return     application/json

    Example return value excerpt:

        [
          {
            "comment": "Unknown place",
            "confidence": null,
            "geoloc": null,
            "id": 448,
            "name": "Dirigh",
            "place_type_id": 4,
            "visible": true
          },
          ...
        ]
    '''
    c.execute('select * from place;')

    def _parse(x):
        d = x._asdict()
        d['geoloc'] = parse_geoloc(d['geoloc'])
        return d

    return flask.jsonify(list(map(_parse, c.fetchall())))


@app.route('/place-type-list', role='user')
@rest_endpoint
def get_place_type_list(c):
    '''
    Get a list of all place types.

    @returns        application/json

    This returns a JSON array of objects with `id`, `type`, and `visible` from
    table `place_type`. This API endpoint replaces `/PlaceTypeList` in the old
    servlet implementation.

    Example return value excerpt:

      [
        {
          "id": 1,
          "type": "Unknown",
          "visible": true
        },
        ...
      ]

    '''
    c.execute('select id, type, visible from place_type order by id asc')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))


@app.route('/find-alternative-names', methods=['POST'], role='user')
@rest_endpoint(['POST'])  # POST okay for read-only access
def search_alternative_names(c):
    '''
    Retrieve `place.id` where the alternative name matches the `regex`.

    @payload                application/json
      @param `regex`        ECMA-Script regular expression
      @param `ignore_case`  If `true`, regex is case-insensitive

    @returns                application/json

    As alternative names are not loaded initially, this API endpoint is used to
    retrieve places' `id` for text search in the location list, where an
    alternative name matches the search term `regex`. This API endpoint then
    returns a JSON array of `place.id` for matching places.

    Example response for case-insensitive serarch of "ko[a-g]":

      > POST /rest/find-alternative-names HTTP/1.1
      > Content-Type: application/json
      >
      > {
      >   "ignore_case": true,
      >   "regex": "ko[a-g]"
      > }
      >
      ---
      < HTTP/1.1 200 OK
      < Content-Type: application/json
      <
      < [
      <   236,
      <   694,
      <   493
      < ]
    '''
    payload = flask.request.json
    if type(payload) is not dict or len(payload) == 0:
        return flask.abort(415, 'Payload must be non-empty JSON.')

    if type(payload) is not dict:
        raise werkzeug.exceptions.UnsupportedMediaType('Payload of type application/json required.')

    required_kws = ('regex',)
    allowed_kws = ('ignore_case',)
    if any(map(lambda x: x not in payload, required_kws)) \
            or all(map(lambda x: x not in payload, (*allowed_kws, *required_kws))) \
            or any(map(lambda x: x not in (*allowed_kws, *required_kws), payload.keys())):
        raise werkzeug.exceptions.BadRequest('Payload MUST contain the keys {} and MAY contain the keys {}.'.format(
            ', '.join(list(map(lambda x: F"'{x}'", required_kws))),
            ', '.join(list(map(lambda x: F"'{x}'", allowed_kws)))
            ))

    if type(payload['regex']) is not str or 'ignore_case' in payload and type(payload['ignore_case']) is not bool:
        raise werkzeug.exceptions.BadRequest("'regex' must be string, 'ignore_case' must be boolean.")


    ignore_case = 'ignore_case' in payload and payload['ignore_case']
    regex_flag = '~*' if ignore_case else '~'

    regex = payload['regex']

    c.execute(F'SELECT place_id FROM name_var WHERE name {regex_flag} %(regex)s OR simplified {regex_flag} %(regex)s OR transcription {regex_flag} %(regex)s;', regex=regex)
    return flask.jsonify(list(map(lambda x: x.place_id, c.fetchall())))


@app.route('/place/<int:place_id>/details', role='user')
@rest_endpoint
def get_place_details(c, place_id):
    '''
    Retrieve more details for the place with ID `place_id`.

    @param `place_id`   `id` in table `place`
    @returns            application/json

    This API endpoint is aimed at the location list of the visualization, where
    tooltips show more details for a place on hover. This information is not
    loaded from the server initially for efficiency reasons. Instead, it is
    queried when the tooltip is created.
    As of now (2020-01-10), the call returns a JSON object containing the place
    ID, the `comment` field from table `place`, and an array of alternative
    names for the place together with the respective language name. This will
    exclude alternative names that are not main forms.

    Example return value excerpt for `GET /place/14/details`:

      {
        "alternative_names": [
          {
            "language": "Arabic - AS",
            "name": "\\u062d\\u0644\\u0628"
          },
          {
            "language": "Arabic - DMG",
            "name": "\\u1e24alab"
          },
          {
            "language": "Syriac - SS",
            "name": "\\u071a\\u0720\\u0712 "
          },
          ...
        ],
        "comment": "[dummy] Comments are strings or null",
        "place_id": 14,
        "external_uris": [
          "Syriaca:3055",
          ...
        ],
      }
    '''
    d = dict(place_id=place_id)
    # check if place exists
    count = c.one('select count(*) from place where id = %(place_id)s;', place_id=place_id)
    if count == 0:
        flask.abort(404)

    # get place.comment
    comment = c.one('select comment from place where id = %(place_id)s;', place_id=place_id)
    d['comment'] = comment

    # get list of alternative names
    c.execute("""SELECT name_var.name as name, language.name as language, transcription
                    FROM
                        (SELECT id, name FROM place WHERE id = %(place_id)s) as P
                    INNER JOIN name_var ON P.id = name_var.place_id
                    INNER JOIN language ON language.id = name_var.language_id
                    WHERE name_var.main_form;""", place_id=place_id)
    d['alternative_names'] = list(map(lambda x: x._asdict(), c.fetchall()))

    # get list of external (short) URIs
    c.execute('''SELECT format(U.short_name, EP.uri_fragment)
    FROM external_place_uri EP
    JOIN uri_namespace U ON EP.uri_namespace_id = U.id
    WHERE EP.place_id = %(place_id)s;''', place_id=place_id)
    d['external_uris'] = list(map(lambda x: x[0], c.fetchall()))

    return flask.jsonify(d)


@app.route('/place/<int:place_id>/evidence', role='user')
@rest_endpoint
def get_place_evidence(c, place_id):
    '''
    Retrieve religion evidence for the place with ID `place_id`.

    @param `place_id`   `id` in table `place`
    @returns            application/json

    This replaces the `/Religions` endpoint in the old servlet implementation.

    Returns a list of evidences, with comments and confidences, time spans, and
    sources.

    Example return value excerpt for `GET /place/12/evidence`:

      {
        "place_id": 12,
        "evidence": [
          {
            "evidence_id": 17,
            "interpretation_confidence": null,
            "place_attribution_confidence": null,
            "place_id": 12,
            "place_instance_comment": null,
            "religion_confidence": null,
            "religion_id": 5,
            "religion_instance_comment": null,
            "religion_name": "Church of the East",
            "sources": [
              {
                "source_id": 8,
                "source_instance_comment": "Neuer Eintrag",
                "source_name": "AKg = Jedin, Hubert; Martin, Jochen (Hg.) (1987): [...]",
                "source_page": "26"
              }
            ],
            "time_spans": [
              {
                "comment": null,
                "confidence": null,
                "end": 1200,
                "start": 800
              }
            ]
          },
          ...
        ]
      }
    '''
    d = dict(place_id=place_id)
    # check if place exists
    count = c.one('select count(*) from place where id = %(place_id)s;', place_id=place_id)
    if count == 0:
        flask.abort(404)

    evidence = []
    c.execute('''
SELECT evidence.id AS evidence_id,
    evidence.interpretation_confidence,
    place_instance.place_id,
    place_instance.confidence as place_attribution_confidence,
    place_instance.comment as place_instance_comment,
    religion_instance.confidence as religion_confidence,
    religion_instance.comment as religion_instance_comment,
    religion.id as religion_id,
    religion.name as religion_name,
    evidence.time_group_id as time_group_id
FROM evidence
 LEFT JOIN religion_instance ON evidence.religion_instance_id = religion_instance.id
 LEFT JOIN place_instance ON evidence.place_instance_id = place_instance.id
 LEFT JOIN religion ON religion_instance.religion_id = religion.id
WHERE place_instance.place_id = %(place_id)s
ORDER BY evidence_id;
    ''', place_id=place_id)

    for e in c.fetchall():
        datum = e._asdict()
        # timespans
        c.execute('''
SELECT
lower(span) as start,
upper(span) - 1 as end,
comment,
confidence
FROM
time_instance
WHERE
time_group_id = %(tgi)s;
                ''', tgi=e.time_group_id)
        datum['time_spans'] = list(map(lambda x: x._asdict(), c.fetchall()))
        del datum['time_group_id']

        # sources
        c.execute('''
select 
    SI.source_id as source_id,
    S.name as source_name,
    SI.source_page as source_page,
    SI.comment as source_instance_comment
from
    source_instance SI
    JOIN source S ON SI.source_id = S.id
where 
    evidence_id = %(eid)s;
    ''', eid=e.evidence_id)
        datum['sources'] = list(map(lambda x: x._asdict(), c.fetchall()))

        evidence.append(datum)

    d['evidence'] = evidence

    return flask.jsonify(d)


@app.route('/place/<int:place_id>/evidence-ids', role='user')
@rest_endpoint
def get_place_evidence_ids(c, place_id):
    '''
    Get all evidence tuple IDs for the place with ID `place_id`.

    @returns application/json

    Example return value exerpt for `/place/12/evidence-ids`:

      [
        1,
        5,
        12,
        191,
        ...
      ]
    '''
    # check if place exists
    count = c.one('select count(*) from place where id = %(place_id)s;', place_id=place_id)
    if count == 0:
        flask.abort(404)

    query = c.mogrify('''
        SELECT E.id
        FROM place_instance PI
        JOIN evidence E ON E.place_instance_id = PI.id
        WHERE PI.place_id = %s;
    ''', (place_id,))
    c.execute(query)

    ids = list(map(lambda d: d[0], c.fetchall()))

    return flask.jsonify(ids)



@app.route('/places', role='user')
@rest_endpoint
def get_places(c):
    '''
    Get a list of places and their IDs.

    @returns            application/json

    This returns a list of place names and IDs.

    Example return value excerpt:

        [
          {
            "id": 1,
            "name": "Mosul",
          },
          ...
        ]
    '''
    c.execute('select id, name from place order by name asc;')

    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))


@app.route('/place-list', role='user')
@rest_endpoint
def get_place_list(c):
    '''
    Get a list of places.

    @arg        filter  An array of arrays specifying an advanced filter
    @returns            application/json

    This returns all tuples from the view `place_overview` as a JSON array of
    objects. The overview contains geographical location, place ID, location
    confidence, place name, and place type name.
    If `filter` is specified, the resulting values are restricted.

    Example return value excerpt:

        [
          {
            "geoloc": {
              "lat": 36.335,
              "lng": 43.11889
            },
            "id": 1,
            "location_confidence": null,
            "name": "Mosul",
            "place_type": "Settlement"
          },
          ...
        ]
    '''
    c.execute('select * from place_overview;')

    return flask.jsonify(list(map(parse_place, c.fetchall())))



@app.route('/place/<int:place_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'], role='user')
@rest_endpoint
def place_data(c, place_id):
    '''
    CRUD endpoint to manipulate place tuples.

    [all]     @param place_id         ID of place tuple, 0 or `None` for PUT

    C/PUT     @payload                application/json
              @returns                application/json

    Create a new place tuple. `name` is a required field, the rest is optional.
    Returns the ID for the created entity. Fails if a place with that name
    already exists.

    Exemplary payload for `PUT /place/0`:

      {
        "name": "Testplace",
        "comment": "Test comment",
        "geoloc": "(48.2,9.6)",
        "confidence": "contested",
        "visible": true,
        "place_type_id": 2
      }


    R/GET     @returns                application/json

    Get place data for the place with ID `place_id`.

    @param place_id     Integer, `id` in table `place`
    @returns            application/json

    This returns the data from table `place` as a single JSON object.

    Example return value (2020-01-09) of `GET /place/12`:

        {
            "comment": "Gesch\\u00e4tzt nach Iraq and the Persian Gulf [...]",
            "confidence": null,
            "geoloc": "(33.542,44.3726)",
            "geonames": "...",
            "google": "...",
            "id": 12,
            "name": "al-Baradan",
            "place_type_id": 3,
            "syriaca": null,
            "visible": true
        }



    U/PATCH   @payload                application/json
              @returns                application/json

    Update one or more of the fields 'comment', 'confidence', 'visible',
    'place_type_id', 'geoloc', or 'name'.

    Exemplary payload for `PATCH /place/12345`:

      {
        "visible": false,
        "comment": "updated comment..."
      }


    D/DELETE  @returns                application/json

    Delete a place if there are no conflicts. Otherwise, fail. Returns the ID
    of the deleted tuple.

    '''
    if flask.request.method == 'PUT':
        return put_place_data(c)

    else:
        if c.one('select count(*) from place where id = %s;', (place_id,)) == 0:
            return flask.abort(404, F'Place {place_id} does not exist.')

        if flask.request.method == 'GET':
            return get_place_data(c, place_id)
        if flask.request.method == 'DELETE':
            return delete_place_data(c, place_id)
        if flask.request.method == 'PATCH':
            return update_place_data(c, place_id)

        flask.abort(405)

def get_place_data(c, place_id):
    data = c.one('select * from place where id = %(place_id)s;', **locals())

    r = data._asdict()
    r['geoloc'] = parse_geoloc(r['geoloc'])
    return r

    return flask.jsonify(r)

def update_place_data(c, place_id):
    payload = flask.request.json
    if type(payload) is not dict or len(payload) == 0:
        return flask.abort(415, 'Payload must be non-empty JSON.')

    old_value = c.one('select * from place where id = %s;', (place_id,))

    payload = flask.request.json
    allowed_kws = ('comment', 'confidence', 'visible', 'place_type_id', 'geoloc', 'name')

    if type(payload) is not dict \
            or all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())):
        return flask.abort(400, 'Payload must be a JSON object with one or more of these fields: '
                + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

    if 'name' in payload and payload['name'] == '':
        return 'Place name must not be empty', 400

    if 'geoloc' in payload:
        if type(payload['geoloc']) is not dict or not ('lat' in payload['geoloc'] and 'lng' in payload['geoloc']):
            return 'geoloc must be a dict with both lat and lng', 400

        payload['geoloc'] = format_geoloc(payload['geoloc'])

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'{x} = %({x})s', kws))

    query_str = 'UPDATE place SET ' + update_str + ' WHERE id = %(place_id)s;'

    query = c.mogrify(query_str, dict(place_id=place_id, **payload))
    c.execute(query)

    add_user_action(c, None, 'UPDATE',
            F'Update place {place_id}: {c.mogrify(update_str, payload).decode("utf-8")}',
            old_value._asdict())
    return '', 205

def delete_place_data(c, place_id):
    restricting_tables = ['bishopric_place', 'bishopric_residence', 'place_instance']
    conflicts = dict()
    for restricting_table in restricting_tables:
        query = c.mogrify(F'select id from {restricting_table} where place_id = %s;', (place_id,))
        c.execute(query)
        results = list(map(lambda r: r._asdict(), c.fetchall()))
        if results:
            conflicts[restricting_table] = [ r['id'] for r in results ]
    if conflicts:
        payload = { 'restricting-tuples': conflicts }
        return flask.jsonify(payload), 409

    query = c.mogrify('delete from place where id = %s returning *;', (place_id,))
    old_value = c.one(query)._asdict()

    add_user_action(c, None, 'DELETE', F'Delete place {old_value["name"]} ({place_id}).', old_value)

    return flask.jsonify(dict(deleted=dict(place=place_id))), 200

def put_place_data(c):
    payload = flask.request.json

    if not payload or 'name' not in payload:
        flask.abort(400, 'Payload must be a JSON object with at least the `name` field.')

    name = payload['name']
    if c.one('select count(*) from place where name = %s;', (name,)) > 0:
        flask.abort(409, F'Places must have a unique name. A place with the name "{name}" already exists.')

    if 'geoloc' in payload:
        if type(payload['geoloc']) is not dict or not ('lat' in payload['geoloc'] and 'lng' in payload['geoloc']):
            return flask.abort(400, 'geoloc must be a dict with both lat and lng')

    comment = payload.get('comment', None)
    geoloc = format_geoloc(payload.get('geoloc', None))
    confidence = payload.get('confidence', None)
    visible = payload.get('visible', True)
    place_type_id = payload.get('place_type_id', None)

    if place_type_id is None:
        place_type_id = c.one('select id from place_type where type = %s;', ('Unknown',))

    place_id = c.one('insert into place (name, comment, geoloc, confidence, visible, place_type_id) values (%(name)s, %(comment)s, %(geoloc)s, %(confidence)s, %(visible)s, %(place_type_id)s) returning id;', **locals())

    add_user_action(c, None, 'CREATE', F'Create place {name} with ID {place_id}.', None)
    return flask.jsonify(dict(place_id=place_id)), 201


@app.route('/place/<int:place_id>/alternative-name/all', methods=['GET'], role='user')
@rest_endpoint
def place_alternative_names(c, place_id):
    '''
    Get a list of all alternative names for place with ID `place_id`.

    @returns                          application/json

    Exemplary return value for `GET /place/1234/alternative-name/all`:

      [
        {
          "id": 5678,
          "place_id": 1234,
          "name": "Dummy test name",
          "language_id": 12
        },
        {
          "id": 5679,
          "place_id": 1234,
          "name": "Dummy test name 2",
          "language_id": 4
        },
        ...
      ]
    '''
    query = c.mogrify('select * from name_var where place_id = %s;', (place_id,))
    c.execute(query)
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))


@app.route('/place/<int:place_id>/alternative-name/<int:name_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'], role='user')
@rest_endpoint
def place_alternative_name(c, place_id, name_id):
    '''
    CRUD endpoint to manipulate alternative names.

    [all]     @param place_id         ID of place tuple
    [all]     @param name_id          ID of name_var tuple, 0 or `None` for PUT

    C/PUT     @payload                application/json
              @returns                application/json

    Create new alternative name. `name` and `language_id` are required

    Exemplary payload for `PUT /place/1234/alternative-name/0`:

      {
        "name": "Testplace",
        "language_id": 2
      }


    R/GET     @returns                application/json

    Get alternative name tuple.

    Example return value of `GET /place/1234/alternative-name/5678`:

        {
          "id": 5678,
          "place_id": 1234,
          "name": "Dummy test name",
          "language_id": 12
        }


    U/PATCH   @payload                application/json
              @returns                application/json

    Update one or more of the fields 'name' and 'language_id'.

    Exemplary payload for `PATCH /place/alternative-name/5678`:

      {
        "name": "New name",
        "language_id": 13
      }


    D/DELETE  @returns                application/json

    Delete an alternative name tuple. Returns the ID of the deleted tuple.
    '''
    if flask.request.method == 'PUT':
        return put_alternative_name(c, place_id)

    else:
        if c.one('select count(*) from place where id = %s;', (place_id,)) == 0:
            return flask.abort(404, F'Place {place_id} does not exist.')

        if flask.request.method == 'GET':
            return get_alternative_name(c, place_id, name_id)
        if flask.request.method == 'DELETE':
            return delete_alternative_name(c, place_id, name_id)
        if flask.request.method == 'PATCH':
            return update_alternative_name(c, place_id, name_id)

        flask.abort(405)


def put_alternative_name(c, place_id):
    payload = flask.request.json

    if type(payload) is not dict \
            or 'name' not in payload \
            or 'language_id' not in payload \
            or payload['name'] == '' \
            or type(payload['language_id']) is not int:
                flask.abort(400, 'Payload must be a JSON containing a valid name and language_id')

    name = payload['name']
    language_id = payload['language_id']
    transcription = payload.get('transcription', None)
    simplified = payload.get('simplified', None)
    main_form = payload.get('main_form', True)
    comment = payload.get('comment', None)

    nvid = c.one('insert into name_var (name, place_id, language_id, transcription, simplified, main_form, comment) values (%s, %s, %s, %s, %s, %s, %s) returning id;', \
            (name, place_id, language_id, transcription, simplified, main_form, comment))
    add_user_action(c, None, 'UPDATE',
            F'Add alternative name "{name}" to place {place_id}.',
            None)

    return flask.jsonify(dict(name_var_id=nvid)), 201


def get_alternative_name(c, place_id, name_id):
    pl = c.one('select * from name_var where id = %s and place_id = %s;', (name_id, place_id))
    if pl is None:
        flask.abort(404)
    return flask.jsonify(pl._asdict())


def delete_alternative_name(c, place_id, name_id):
    olddata = c.one('delete from name_var where id = %s and place_id = %s returning *;', (name_id, place_id))
    if olddata is None:
        flask.abort(404)
    d = olddata._asdict()
    add_user_action(c, None, 'UPDATE', F'Delete alternative name "{d["name"]}" (ID {name_id}) for place {place_id}.', d)
    return flask.jsonify(dict(deleted=dict(name_var=d['id']))), 200


def update_alternative_name(c, place_id, name_id):
    payload = flask.request.json
    allowed_kws = ('name', 'language_id', 'transcription', 'simplified', 'main_form', 'comment')

    if type(payload) is not dict \
            or all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())):
        return flask.abort(400, 'payload must be a json object with one or more of these fields: '
                + ', '.join(map(lambda x: f"'{x}'", allowed_kws)))

    if 'name' in payload and payload['name'] == '':
        return 'Alternative place name must not be empty', 400

    old_value = c.one('select * from name_var where id = %s and place_id = %s;', (name_id, place_id))
    if old_value is None:
        flask.abort(404)

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'{x} = %({x})s', kws))

    query_str = 'UPDATE name_var SET ' + update_str + ' WHERE id = %(name_id)s and place_id = %(place_id)s;'

    query = c.mogrify(query_str, dict(place_id=place_id, name_id=name_id, **payload))
    c.execute(query)

    add_user_action(c, None, 'UPDATE',
            F'Update name_var {name_id} (place {place_id}): {c.mogrify(update_str, payload).decode("utf-8")}',
            old_value._asdict())
    return '', 205


@app.route('/place-list-detailed', role='user')
@rest_endpoint
def get_place_list_detailed(c):
    '''
    Get a list of places, with more details.

    @returns            application/json

    Example return value excerpt:

        [
          {
            "external_uris": [
              "IndAnat:37356",
              "https://nisanyanmap.com/?yer=37356",
              "syriaca:285",
              "https://syriaca.org/place/285",
              "EI2:SIM_0749",
              "http://dx.doi.org/10.1163/1573-3912_islam_SIM_0749",
              "EI1:SIM_0872",
              "http://dx.doi.org/10.1163/2214-871X_ei1_SIM_0872",
              "EI3:COM_23768",
              "http://dx.doi.org/10.1163/1573-3912_ei3_COM_23768"
            ],
            "name_vars": [
              "Arzun, Arzon",
              "Arz\u016bn, Arz\u014dn",
              "\u0627\u0631\u0632\u0646",
              "Arzan",
              "\u0710\u072a\u0719\u0718\u0722"
            ],
            "place_comment": "There are two Arzan. [...]",
            "place_id": 36,
            "place_name": "Arzan"
          },
          ...
        ]
    '''
    c.execute('''SELECT
    P.id AS place_id,
    P.name AS place_name,
    P.comment AS place_comment,
    (
        SELECT ARRAY_REMOVE(
            ARRAY(
                SELECT DISTINCT unnest(array(
                    SELECT array[name, simplified, transcription]
                    FROM name_var NV
                    WHERE NV.place_id = P.id
                ))
            ),
            NULL
        )
    ) AS name_vars,
    (
        SELECT ARRAY(
            SELECT unnest(array(
                SELECT ARRAY[format(U.short_name, EP.uri_fragment), format(U.uri_pattern, EP.uri_fragment)]
                FROM external_place_uri EP
                JOIN uri_namespace U ON EP.uri_namespace_id = U.id
                WHERE EP.place_id = P.id
            ))
        )
    ) AS external_uris
FROM place P
JOIN place_type PT ON P.place_type_id = PT.id
WHERE P.visible AND PT.visible;''')

    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))
