import flask
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .decorators import rest_endpoint
from .user_action import add_user_action
from ..document_fragment import inner_text, extract_fragment

name = 'annotation'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/annotation/<int:annotation_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'], role='user')
@rest_endpoint
def annotation(cursor, annotation_id):
    '''
    CRUD endpoint to get document metadata for a document.

    [all]       @param annotation_id        ID of annotation


    GET         @returns                    application/json

    Get the annotation data for annotation `annotation_id`. Example payload:

        {
            "id": 1,
            "document_id": 3,
            "span": "(422,431)",
            "comment": "comment content"
        }


    PUT         @returns                    application/json

    Create a new annotation. Returns the created annotation tuple's ID. Example payload:

        {
            "document_id": 4,
            "span": "[0, 10]",
            "comment": "foo bar"
        }


    PATCH       @returns                    205 Reset Content; empty body

    Modify an existing annotation. Example payload:

        {
            "comment": "new comment"
        }


    DELETE      @returns                    application/json

    Delete an annotation, and its connected instance. This will fail if the
    instance is still in use by an evidence tuple. Returns the deleted
    annotation's and instance's IDs.
    '''

    if flask.request.method == 'PUT':
        return put_annotation(cursor)
    else:
        olddata = cursor.one('select * from annotation where id = %s;', (annotation_id,))
        if olddata is None:
            raise werkzeug.exceptions.NotFound(F'No annotation with ID {annotation_id}.')
        olddata = olddata._asdict()

        if flask.request.method == 'GET':
            return flask.jsonify(olddata)
        elif flask.request.method == 'PATCH':
            return patch_annotation(cursor, olddata, annotation_id)
        elif flask.request.method == 'DELETE':
            return delete_annotation(cursor, olddata, annotation_id)
        else:
            raise werkzeug.exceptions.MethodNotAllowed()


def find_and_correct_referenced_annotation(cursor, annotation_id):
    deleted = dict()
    deleted_ids = dict()
    for table in [
        'place_instance',
        'person_instance',
        'religion_instance'
        ]:
        res = cursor.one(F'delete from {table} where annotation_id = %s returning *;', (annotation_id,))
        if res is not None:
            deleted[table] = res._asdict()
            deleted_ids[F'{table}_id'] = res.id

    # time_group_id
    time_group = cursor.one('select * from time_group where annotation_id = %s;', (annotation_id,))
    if time_group is not None:
        deleted['time_group'] = time_group._asdict()
        deleted_ids['time_group_id'] = time_group.id

        query = cursor.mogrify('delete from time_instance where time_group_id = %s returning *;', (time_group.id,))
        cursor.execute(query)
        result = cursor.fetchall()
        if len(result) > 1:
            deleted_ids['time_instance_id'] = list(map(lambda x: x.id, result))
            deleted['time_instance'] = list(map(lambda x: x._asdict(), result))

        query = cursor.mogrify('delete from time_group where id = %s;', (time_group.id,))
        cursor.execute(query)

    return deleted, deleted_ids


def delete_annotation(cursor, olddata, annotation_id):
    '''Delete annotation with ID `annotation_id`'''
    # cascade to instance holding annotation (will fail if evidence holds instance)
    deleted, deleted_ids = find_and_correct_referenced_annotation(cursor, annotation_id)

    query = cursor.mogrify('DELETE FROM annotation WHERE id = %s;', (annotation_id,))
    cursor.execute(query)

    deleted_ids['annotation_id'] = olddata['id']
    deleted['annotation'] = olddata

    # cannot delete if evidence connected in any case, or if an instance is connected
    add_user_action(cursor, None, 'DELETE', F'Delete annotation with ID {annotation_id}', deleted)

    return flask.jsonify(deleted_ids), 200


def put_annotation(cursor):
    '''Create new annotation'''
    payload = flask.request.json
    allowed_kws = ('document_id', 'span', 'comment')

    if type(payload) is not dict \
            or all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())):
        raise werkzeug.exceptions.BadRequest('payload must be a json object with one or more of these fields: '
                + ', '.join(map(lambda x: f"'{x}'", allowed_kws)))


    kws = list(filter(lambda x: x in payload, allowed_kws))
    field_str = ', '.join(kws)
    val_str = ', '.join(map(lambda x: F'%({x})s', kws))

    query_str = 'INSERT INTO annotation (' + field_str + ') VALUES (' + val_str +') RETURNING id;'

    query = cursor.mogrify(query_str, payload)
    annotation_id = cursor.one(query)

    add_user_action(cursor, None, 'CREATE', F'Add new annotation {annotation_id}.', None)
    return dict(annotation_id=annotation_id), 201


def patch_annotation(cursor, olddata, annotation_id):
    '''update an annotation'''
    payload = flask.request.json
    allowed_kws = ('span', 'comment')  # cannot directly change document_id, because that would be silly

    if type(payload) is not dict \
            or all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())):
        raise werkzeug.exceptions.BadRequest('payload must be a json object with one or more of these fields: '
                + ', '.join(map(lambda x: f"'{x}'", allowed_kws)))

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'{x} = %({x})s', kws))

    query_str = 'UPDATE annotation SET ' + update_str + ' WHERE id = %(annotation_id)s;'

    query = cursor.mogrify(query_str, dict(annotation_id=annotation_id, **payload))
    cursor.execute(query)

    add_user_action(cursor, None, 'UPDATE',
            F'Update annotation {annotation_id}: {cursor.mogrify(update_str, payload).decode("utf-8")}',
            olddata)
    return '', 205


@app.route('/document/<int:document_id>/annotation-list', methods=['GET'], role='user')
@rest_endpoint
def document_annotation_list(cursor, document_id):
    '''
    REST endpoint to get a list of annotations associated with a document.

    This is a slice of the `annotation_overview` VIEW. It contains all the data
    from the `annotation` table, alongside the connected instance IDs and
    evidence ID. The `span` property is an array with the first and last
    inclusive index of the annotation. As an instance can be part of multiple
    evidence tuples (i.e., an annotation can be in multiple groups), the
    `evidence_ids` is an array.

    Example return value for `/rest/document/1/annotation-list`:

      [
        {
          "id": 1,
          "document_id": 1,
          "span": [ 0, 4 ],
          "comment": "test comment",
          "place_instance_id": null,
          "person_instance_id": 1623,
          "religion_instance_id": null,
          "time_group_id": null,
          "evidence_ids": [ 3611 ]
        },
        ...
      ]


    This endpoint can also be requested as in LD-JSON format. In this case, it
    is assumed to be required for the Recogito tool. NOTE that to properly show
    the annotations in Recogito, the `{ mode: 'pre' }` configuration value must
    be set, as the DOM annotator we use internally respects all white-space in
    the document without collapsing it.

    Example return value excerpt for

      GET /rest/document/7/annotation-list
      Accept: application/ld+json

      [
        {
          "@context": "http://www.w3.org/ns/anno.jsonld",
          "body": [
            {
              "purpose": "tagging",
              "type": "TextualBody",
              "value": "Religion"
            },
            {
              "purpose": "tagging",
              "type": "TextualBody",
              "value": "Christianity"
            }
          ],
          "id": "#31847",
          "target": {
            "selector": [
              {
                "end": 479,
                "start": 474,
                "type": "TextPositionSelector"
              },
              {
                "exact": "Amen.",
                "type": "TextQuoteSelector"
              }
            ]
          },
          "type": "Annotation"
        },
        ...
        {
          "@context": "http://www.w3.org/ns/anno.jsonld",
          "body": [
            {
              "purpose": "tagging",
              "type": "TextualBody",
              "value": "religion"
            }
          ],
          "id": "#5843_religion",
          "motivation": "linking",
          "target": [
            {
              "id": "#31826"
            },
            {
              "id": "#31840"
            }
          ],
          "type": "Annotation"
        },
        ...
      ]
    '''
    if 0 == cursor.one('select count(*) from document where id = %s;', (document_id,)):
        raise werkzeug.exceptions.NotFound(F'No document with ID {document_id}.')

    if flask.request.accept_mimetypes.best_match(('application/json', 'application/ld+json')) == 'application/ld+json':
        return jsonld_annotation_list_for_document(cursor, document_id)

    query = cursor.mogrify('select * from annotation_overview where document_id = %s;', (document_id,))
    cursor.execute(query)

    return flask.jsonify(list(map(lambda x: x._asdict(), cursor.fetchall())))


def jsonld_annotation_list_for_document(cursor, document_id):
    parts = list()

    query = cursor.mogrify('select * from annotation_overview where document_id = %s;', (document_id,))
    cursor.execute(query)

    annotations = list(map(lambda x: x._asdict(), cursor.fetchall()))

    document_content = str(cursor.one('SELECT content FROM document WHERE id = %s;', (document_id,)), 'utf-8')

    for annotation in annotations:
        ann = dict(type='Annotation')
        ann['@context'] = 'http://www.w3.org/ns/anno.jsonld'
        ann['id'] = '#' + str(annotation['id'])

        span = annotation['span']
        start = span.lower if span.lower_inc else span.lower + 1
        end = span.upper + 1 if span.upper_inc else span.upper

        ann['target'] = dict(selector=[
            dict(
                type='TextPositionSelector',
                start=start,
                end=end - 1,  # Recogito uses inclusive bounds
                ),
            dict(
                type='TextQuoteSelector',
                exact=inner_text(extract_fragment(document_content, start, end - 1)),
                ),
            ])

        body = []
        if annotation['comment'] is not None:
            body.append(dict(type='TextualBody', value=annotation['comment']))

        if annotation['person_instance_id'] is not None:
            name, confidence = cursor.one('select P.name, PI.confidence from person P join person_instance PI on PI.person_id = P.id where PI.id = %s;', (annotation['person_instance_id'],))
            body.append(dict(type='TextualBody', purpose='tagging', value='Person'))
            body.append(dict(type='TextualBody', purpose='tagging', value=name))
            if confidence is not None:
                body.append(dict(type='TextualBody', purpose='tagging', value=confidence))

        elif annotation['place_instance_id'] is not None:
            name, confidence = cursor.one('select P.name, PI.confidence from place P join place_instance PI on PI.place_id = P.id where PI.id = %s;', (annotation['place_instance_id'],))
            body.append(dict(type='TextualBody', purpose='tagging', value='Place'))
            body.append(dict(type='TextualBody', purpose='tagging', value=name))
            if confidence is not None:
                body.append(dict(type='TextualBody', purpose='tagging', value=confidence))

        elif annotation['religion_instance_id'] is not None:
            name, confidence = cursor.one('select R.name, RI.confidence from religion R join religion_instance RI on RI.religion_id = R.id where RI.id = %s;', (annotation['religion_instance_id'],))
            body.append(dict(type='TextualBody', purpose='tagging', value='Religion'))
            body.append(dict(type='TextualBody', purpose='tagging', value=name))
            if confidence is not None:
                body.append(dict(type='TextualBody', purpose='tagging', value=confidence))

        elif annotation['time_group_id'] is not None:
            cursor.execute('SELECT span, confidence FROM time_instance WHERE time_group_id = %(time_group_id)s;', time_group_id=annotation['time_group_id'])

            body.append(dict(type='TextualBody', purpose='tagging', value='Time'))

            for time_instance in map(lambda x: x._asdict(), cursor.fetchall()):
                span = time_instance['span']
                start = '' if  span.lower is None else str(span.lower if span.lower_inc else span.lower + 1)
                end = '' if span.upper is None else str(span.upper + 1 if span.upper_inc else span.upper)
                value = F'{start}—{end}'
                if time_instance['confidence'] is not None:
                    value += F' ({time_instance["confidence"]})'

                body.append(dict(type='TextualBody', purpose='tagging', value=value))

        ann['body'] = body

        parts.append(ann)


    place_instances = list(filter(lambda p: p is not None, map(lambda x: x['place_instance_id'], annotations)))
    for piid in place_instances:
        # add links
        cursor.execute('''
        SELECT
            E.id as evidence_id,
            TG.annotation_id as time,
            PI.annotation_id as place,
            PRI.annotation_id as person,
            RI.annotation_id as religion
        FROM
            evidence E
        LEFT JOIN time_group TG on E.time_group_id = TG.id
        LEFT JOIN place_instance PI on E.place_instance_id = PI.id
        LEFT JOIN person_instance PRI on E.person_instance_id = PRI.id
        LEFT JOIN religion_instance RI on E.religion_instance_id = RI.id
        WHERE PI.id = %(person_instance_id)s;''',
        person_instance_id=piid)
        for f in cursor.fetchall():
            if f.time is not None:
                ann = ann = dict(type='Annotation',
                        motivation='linking')
                ann['@context'] = 'http://www.w3.org/ns/anno.jsonld'
                ann['id'] = F'#{f.evidence_id}_time'
                ann['body'] = [{'type': 'TextualBody', 'value': 'time', 'purpose': 'tagging'}]
                ann['target'] = [
                        dict(id='#'+str(f.place)),
                        dict(id='#'+str(f.time))
                        ]
                parts.append(ann)

            if f.person is not None:
                ann = ann = dict(type='Annotation',
                        motivation='linking')
                ann['@context'] = 'http://www.w3.org/ns/anno.jsonld'
                ann['id'] = F'#{f.evidence_id}_person'
                ann['body'] = [{'type': 'TextualBody', 'value': 'person', 'purpose': 'tagging'}]
                ann['target'] = [
                        dict(id='#'+str(f.place)),
                        dict(id='#'+str(f.person))
                        ]
                parts.append(ann)

            if f.religion is not None:
                ann = ann = dict(type='Annotation',
                        motivation='linking')
                ann['@context'] = 'http://www.w3.org/ns/anno.jsonld'
                ann['id'] = F'#{f.evidence_id}_religion'
                ann['body'] = [{'type': 'TextualBody', 'value': 'religion', 'purpose': 'tagging'}]
                ann['target'] = [
                        dict(id='#'+str(f.place)),
                        dict(id='#'+str(f.religion))
                        ]
                parts.append(ann)


    response = flask.jsonify(parts)
    response.content_type = 'application/ld+json'

    return response
