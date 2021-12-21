import flask
import psycopg2
import json
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

from .user_action import add_user_action
from .util import parse_evidence, parse_geoloc
from .decorators import rest_endpoint

name = 'evidence'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/evidence-list', role='user')
@rest_endpoint
def get_evidence_list(c):
    '''
    Get a list of compact evidence tuples from the view `place_religion_overview`.

    @returns            application/json

    This replaces the `/PlaceReligion` API endpoint of the old servlet
    implementation. Returns a JSON array of objects with a place ID, evidence
    tuple ID, religion ID, and a time span. Only evidences with
    `evidence.visible`, `place.visible` and `place_type.visible` are listed!

    Example return value excerpt:

      [
        {
          "place_id": 1,
          "religion_id": 4,
          "time_span": {
            "end": 1200,
            "start": 800
          },
          "tuple_id": 1,
          "source_ids": [12]
        },
        ...
      ]
    '''
    c.execute('select * from place_religion_overview;')
    return flask.jsonify(list(map(parse_evidence, c.fetchall())))


@app.route('/annotator-evidence-list', role='user')
@rest_endpoint
def get_evidence_with_annotations(c):
    '''
    This endpoint returns a list of `evidence_id`, `document_id` tuples for all
    evidence that was created using the annotator; i.e., all evidence whose
    instances are connected to annotations.

    Example return value excerpt:

      [[8122, 1], [8125, 1], [8145, 2], ...]

    '''
    c.execute('''SELECT DISTINCT E.id, A.document_id
        FROM evidence E
        LEFT JOIN place_instance PI ON E.place_instance_id = PI.id
        LEFT JOIN person_instance PEI ON E.person_instance_id = PEI.id
        LEFT JOIN religion_instance RI ON E.religion_instance_id = RI.id
        LEFT JOIN time_group TG ON E.time_group_id = TG.id
        JOIN annotation A ON A.id IN (
                PI.annotation_id,
                PEI.annotation_id,
                RI.annotation_id,
                TG.annotation_id
        );''')
    return flask.jsonify(list(map(list, c.fetchall())))


@app.route('/evidence/<int:evidence_id>', methods=['GET', 'PATCH', 'DELETE', 'PUT'], role='user')
@rest_endpoint
def modify_evidence(c, evidence_id):
    '''
    CRUD endpoint to manipulate evidence tuples.

    [all]     @param evidence_id      ID of evidence tuple, 0 or `None` for PUT

    C/PUT     @payload                application/json
              @returns                application/json

    Create a new evidence tuple. `place_instance_id` and `religion_instance_id`
    are required fields, the rest (`person_instance_id`, `time_group_id`,
    `comment`, `interpretation_confidence`, `visible`) is optional. Returns the
    IDs for the created evidence.

    Exemplary payload for `PUT /evidence`:

      {
        "place_instance_id": 202,
        "religion_instance_id": 7,
        "person_instance_id": 12,
        "time_group_id": 4,
        "interpretation_confidence": "probable",
        "visible": true,
        "comment": "evidence comment: test"
      }


    R/GET     @returns                application/json

    Get one evidence tuple, specified by `evidence_id`. Request takes no
    payload and returns a JSON object with data from a bunch of tables
    (`place`, `religion`, `time_span`, `source_instance`, `source`, and
    intermediary tables).

    Exemplary reply for `GET /evidence/64`:

      {
          "evidence_id": 64,
          "interpretation_confidence": null,
          "location_confidence": null,
          "place_attribution_confidence": null,
          "place_comment": "",
          "place_geoloc": null,
          "place_id": 46,
          "place_instance_comment": null,
          "place_name": "Beth Sayda",
          "religion_confidence": null,
          "religion_id": 4,
          "religion_instance_comment": null,
          "religion_name": "Syriac Orthodox Church",
          "sources": [
              {
                  "source_id": 1,
                  "source_instance_comment": "",
                  "source_name": "OCN = Fiey, [...]",
                  "source_page": "179"
              },
              {
                  "source_id": 2,
                  "source_instance_comment": "Levenq, G. (1935). : s. v. Bêth Saida. [...],
                  "source_name": "DHGE = Aubert, [...],
                  "source_page": "8, 1239-1240"
              }
          ],
          "time_group_id": 64,
          "time_spans": [
              {
                  "comment": null,
                  "confidence": null,
                  "end": 1277,
                  "start": 1261
              }
          ]
      }


    U/PATCH   @payload                application/json
              @returns                application/json

    Update one or more of the fields `comment`, `interpretation_confidence`,
    `visible`, `person_instance_id`, or `time_group_id`. The
    `religion_instance_id` and `place_instance_id` CANNOT be updated for an
    existing evidence tuple.

    Exemplary payload for `PATCH /evidence/12345`:

      {
        "visible": false,
        "comment": "updated comment...",
        "person_instance_id": 1234
      }


    D/DELETE  @param                  cascade=0|1
              @returns                application/json

    Delete evidence. If the `cascade` parameter is 1, also delete all related
    entities. Write `user_action` log, return a JSON with all deleted IDs.

    '''

    if flask.request.method == 'PUT':
        return put_evidence(c)
    else:
        olddata = c.one('select * from evidence where id = %s;', (evidence_id,))

        if olddata is None:
            raise werkzeug.exceptions.NotFound(F'No evidence with ID {evidence_id}.')

        if flask.request.method == 'GET':
            # get for id
            return get_evidence(c, olddata, evidence_id)
        if flask.request.method == 'DELETE':
            return delete_evidence(c, olddata, evidence_id)
        if flask.request.method == 'PATCH':
            return update_evidence(c, olddata, evidence_id)

    flask.abort(405)

def get_evidence(c, olddata, eid):
    e = c.one('''
SELECT evidence.id AS evidence_id,
    evidence.id AS id,
    evidence.interpretation_confidence as interpretation_confidence,
    evidence.comment as evidence_comment,
    evidence.visible,
    place.name AS place_name,
    place.geoloc AS place_geoloc,
    place.confidence AS location_confidence,
    place.comment as place_comment,
    place_instance.place_id,
    place_instance.id as place_instance_id,
    place_instance.confidence as place_attribution_confidence,
    place_instance.comment as place_instance_comment,
    religion_instance.confidence as religion_confidence,
    religion_instance.comment as religion_instance_comment,
    religion_instance.id as religion_instance_id,
    religion.id as religion_id,
    religion.name as religion_name,
    evidence.time_group_id as time_group_id,
    person_instance.id as person_instance_id,
    person.name as person_name,
    person.id as person_id,
    person_instance.confidence as person_confidence,
    person_instance.comment as person_instance_comment,
    person_type.type as person_type
FROM evidence
 LEFT JOIN religion_instance ON evidence.religion_instance_id = religion_instance.id
 LEFT JOIN place_instance ON evidence.place_instance_id = place_instance.id
 LEFT JOIN person_instance ON evidence.person_instance_id = person_instance.id
 LEFT JOIN person ON person_instance.person_id = person.id
 LEFT JOIN person_type ON person.person_type = person_type.id
 JOIN religion ON religion_instance.religion_id = religion.id
 JOIN place ON place.id = place_instance.place_id
WHERE evidence.id = %(eid)s;
    ''', eid=eid)

    if e is None:
        return flask.abort(404)

    datum = e._asdict()

    datum['place_geoloc'] = parse_geoloc(datum['place_geoloc'])

    # timespans
    c.execute('''
SELECT
lower(span) as start,
upper(span) - 1 as end,
comment,
confidence,
id as time_instance_id
FROM
time_instance
WHERE
time_group_id = %(tgi)s;
            ''', tgi=e.time_group_id)
    datum['time_spans'] = list(map(lambda x: x._asdict(), c.fetchall()))

    # sources
    c.execute('''
select
    SI.source_id as source_id,
    SI.id as source_instance_id,
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

    # tag IDs
    c.execute('''SELECT tag_id
        FROM tag_evidence
        WHERE evidence_id = %(eid)s;''', eid=e.evidence_id)
    datum['tag_ids'] = list(map(lambda x: x.tag_id, c.fetchall()))

    return flask.jsonify(datum)


def put_evidence(c):
    #raise werkzeug.exceptions.NotImplemented('Testfehlermeldung') 
    payload = flask.request.json
    if type(payload) is not dict:
        raise werkzeug.exceptions.UnsupportedMediaType('Payload of type application/json required.')

    required_kws = ('place_instance_id', 'religion_instance_id')
    allowed_kws = ('person_instance_id', 'time_group_id', 'comment', 'interpretation_confidence', 'visible')
    if any(map(lambda x: x not in payload, required_kws)) \
            or all(map(lambda x: x not in payload, (*allowed_kws, *required_kws))) \
            or any(map(lambda x: x not in (*allowed_kws, *required_kws), payload.keys())):
        raise werkzeug.exceptions.BadRequest('Payload MUST contain the keys {} and MAY contain the keys {}.'.format(
            ', '.join(list(map(lambda x: F"'{x}'", required_kws))),
            ', '.join(list(map(lambda x: F"'{x}'", allowed_kws)))
            ))

    # place_instance
    place_instance_id = payload['place_instance_id']
    religion_instance_id = payload['religion_instance_id']
    person_instance_id = payload.get('person_instance_id', None)
    time_group_id = payload.get('time_group_id', None)
    evidence_comment = payload.get('comment', None)
    visible = payload.get('visible', False)
    interpretation_confidence = payload.get('interpretation_confidence', None)

    evidence_id = c.one(
        'insert into evidence (place_instance_id, religion_instance_id, time_group_id, person_instance_id, interpretation_confidence, comment, visible) values (%s, %s, %s, %s, %s, %s, %s) returning id;',
        (place_instance_id, religion_instance_id, time_group_id, person_instance_id, interpretation_confidence, evidence_comment, visible)
    )

    add_user_action(c, evidence_id, 'CREATE', F'Create new evidence {evidence_id} via REST API', None)

    return flask.jsonify(dict(
        evidence_id=evidence_id,
    )), 201


def delete_evidence(c, olddata, evidence_id):
    ids = dict()
    deleted_entities = dict()

    cascade = flask.request.args.get('cascade', '0')
    if cascade not in '01':
        raise werkzeug.exceptions.BadRequest("'cascade' parameter must be either 0 or 1")
    cascade = cascade == '1'

    # read record for referenced FKs
    (place_instance_id, religion_instance_id, person_instance_id, time_group_id) = c.one('select place_instance_id, religion_instance_id, person_instance_id, time_group_id from evidence where id = %s;', (evidence_id,))

    ids['evidence'] = evidence_id
    ids['place_instance'] = place_instance_id
    ids['religion_instance'] = religion_instance_id
    ids['person_instance'] = person_instance_id
    ids['time_group'] = time_group_id

    # get connected sources ahead of time, because removing evidence tuple cascades there
    query = c.mogrify('select * from source_instance where evidence_id = %s;', (evidence_id,))
    c.execute(query)
    d_si = list(map(lambda x: x._asdict(), c.fetchall()))
    ids['source_instance'] = [l['id'] for l in d_si]

    deleted_entities['source_instance'] = d_si

    # delete record (top-down because of foreign key-constraints)
    del_evidence = c.mogrify('delete from evidence where id = %s returning *;', (evidence_id,))
    d_ev = c.one(del_evidence)
    deleted_entities['evidence'] = d_ev._asdict()

    if cascade:
        query = c.mogrify('delete from time_instance where time_group_id = %s returning *;', (time_group_id,))
        c.execute(query)

        d_ti = list(map(lambda x: x._asdict(), c.fetchall()))
        deleted_entities['time_instance'] = d_ti

        ids['time_instance'] = [l['id'] for l in d_ti]

        del_ann = []

        for tbl in ('place_instance', 'religion_instance', 'person_instance', 'time_group'):
            val = locals()[F'{tbl}_id']
            if val is not None:
                query = c.mogrify(F'select annotation_id from {tbl} where id = %s;', (val, ))
                aid = c.one(query)

                query = c.mogrify(F'delete from {tbl} where id = %s returning *;', (val,))
                deltd = c.one(query)
                deleted_entities[tbl] = deltd._asdict()

                if aid is not None:
                    query = c.mogrify('delete from annotation where id = %s returning *;', (aid,))
                    d = c.one(query)
                    del_ann.append(d._asdict())
        if len(del_ann) > 0:
            deleted_entities['annotation'] = del_ann

        no_delete = set()
        for k,v in ids.items():
            if v is None or type(v) is list and len(v) == 0:
                no_delete.add(k)
        for k in no_delete:
            del ids[k]

    add_user_action(c, None, 'DELETE', F'Delete evidence {evidence_id}{" cascading" if cascade else ""}via REST API', deleted_entities)

    #https://www.techrepublic.com/article/sql-joins-make-it-easy-to-find-and-fix-missing-data/
    return flask.jsonify(dict(deleted=ids)), 200


def update_evidence(c, olddata, evidence_id):
    payload = flask.request.json
    allowed_kws = ('person_instance_id', 'time_group_id', 'religion_instance_id', 'place_instance_id', 'comment', 'interpretation_confidence', 'visible')

    if type(payload) is not dict:
        raise werkzeug.exceptions.UnsupportedMediaType('Payload of type application/json required.')

    if all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())):
        raise werkzeug.exceptions.BadRequest('Payload must be a JSON object with one or more of these fields: '
                + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'{x} = %({x})s', kws))

    query_str = 'UPDATE evidence SET ' + update_str + ' WHERE id = %(evidence_id)s;'

    query = c.mogrify(query_str, dict(evidence_id=evidence_id, **payload))
    c.execute(query)

    add_user_action(c, evidence_id, 'UPDATE',
            F'Update evidence {evidence_id}: {c.mogrify(update_str, payload).decode("utf-8")}',
            olddata._asdict())
    return '', 205



@app.route('/document/<int:document_id>/evidence-list', role='user')
@rest_endpoint
def get_evidence_list_for_document(c, document_id):
    '''
    Get a list of evidence tuples based on a document.

    @param              document_id     ID of document
    @returns            application/json

    An evidence tuple is based on a document if any of its instances'
    annotations is located in that document.

    Example return value excerpt:

      [
        {
            "comment": "Bischof nachgewiesen",
            "id": 1632,
            "interpretation_confidence": null,
            "person_instance_id": null,
            "place_instance_id": 1632,
            "religion_instance_id": 1632,
            "time_group_id": 1632,
            "visible": true
        },
        ...
      ]
    '''
    if c.one('select count(*) from document where id = %s;', (document_id,)) == 0:
        raise werkzeug.exceptions.NotFound(F'No document with ID {document_id}')

    query = c.mogrify('''SELECT E.id,
        E.time_group_id,
        E.place_instance_id,
        E.religion_instance_id,
        E.person_instance_id,
        E.interpretation_confidence,
        E.visible,
        E.comment
    FROM evidence E
    LEFT JOIN place_instance PI ON PI.id = E.place_instance_id
    LEFT JOIN annotation A1 ON PI.annotation_id = A1.id
    LEFT JOIN religion_instance RI ON RI.id = E.religion_instance_id
    LEFT JOIN annotation A2 ON RI.annotation_id = A2.id
    LEFT JOIN person_instance PRI ON PRI.id = E.person_instance_id
    LEFT JOIN annotation A3 ON PRI.annotation_id = A3.id
    LEFT JOIN time_group TG ON TG.id = E.time_group_id
    LEFT JOIN annotation A4 ON TG.annotation_id = A4.id
    WHERE %s in (A1.document_id, A2.document_id, A3.document_id, A4.document_id);
    ''', (document_id,))
    c.execute(query)
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))
