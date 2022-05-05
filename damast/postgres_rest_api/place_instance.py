import flask
import psycopg2
import json
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

from .user_action import add_user_action
from .util import parse_evidence, parse_geoloc
from .decorators import rest_endpoint

name = 'place-instance'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/place-instance/<int:place_instance_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'], role='user')
@rest_endpoint
def modify_place_instance(cursor, place_instance_id):
    '''
    CRUD endpoint to manipulate place instances.

    [all]     @param place_instance_id      ID of place instance, 0 or `None` for PUT

    C/PUT     @payload                application/json
              @returns                application/json

    Create a new place instance. `place_id` is a required field.
    `confidence`, `comment`, and `annotation_id` are optional. Returns the ID
    for the created place instance.

    Exemplary payload for `PUT /place-instance/0`:

      {
        "place_id": 12,
        "confidence": "certain",
        "comment": "foo bar"
      }


    R/GET     @returns                application/json

    Get one place instance.

    Exemplary reply for `GET /place-instance/64`:

      {
          "id": 64,
          "confidence": "certain",
          "comment": "baz",
          "annotation_id": null
      }


    U/PATCH   @payload                application/json
              @returns                application/json

    Update one or more of the fields `place_id`, `comment`, `confidence`, or
    `annotation_id`.

    Exemplary payload for `PATCH /place-instance/12345`:

      {
        "comment": "updated comment...",
      }


    D/DELETE  @returns                application/json

    Delete place instance. Write `user_action` log, return a JSON with all
    deleted IDs.
    '''
    if flask.request.method == 'PUT':
        return put_place_instance(cursor)
    else:
        olddata = cursor.one('select * from place_instance where id = %s;', (place_instance_id,))

        if olddata is None:
            raise werkzeug.exceptions.NotFound(F'No place instance with ID {place_instance_id}.')

        olddata = olddata._asdict()

        if flask.request.method == 'GET':
            # get for id
            return flask.jsonify(olddata)
        if flask.request.method == 'DELETE':
            return delete_place_instance(cursor, olddata, place_instance_id)
        if flask.request.method == 'PATCH':
            return patch_place_instance(cursor, olddata, place_instance_id)

    raise werkzeug.exceptions.MethodNotAllowed()


def put_place_instance(cursor):
    payload = flask.request.json

    allowed_kws = [
            'confidence',
            'comment',
            'place_id',
            'annotation_id'
            ]

    if type(payload) is not dict:
        raise werkzeug.exceptions.BadRequest('Payload must be a JSON object')

    if all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())) \
            or 'place_id' not in payload:
                raise werkzeug.exceptions.UnprocessableEntity('Payload must contain \'place_id\', and one or more of these fields: '
                        + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'%({x})s', kws))

    query_str = 'INSERT INTO place_instance (' + ', '.join(kws) + ') VALUES (' + update_str + ') RETURNING id;'

    place_instance_id = cursor.one(query_str, payload)

    add_user_action(cursor, None, 'CREATE',
            F'Create place instance {place_instance_id}: {", ".join(kws)} = {cursor.mogrify(update_str, payload).decode("utf-8")}',
            None)
    return dict(place_instance_id=place_instance_id), 201


def delete_place_instance(cursor, olddata, place_instance_id):
    deleted_data = dict()
    deleted_ids = dict()

    annotation_id = cursor.one('delete from place_instance where id = %s returning annotation_id;', (place_instance_id,))
    deleted_data['place_instance'] = olddata
    deleted_ids['place_instance_id'] = place_instance_id

    if annotation_id is not None:
        old_annotation = cursor.one('delete from annotation where id = %s returning *;', (annotation_id,))
        deleted_data['annotation'] = old_annotation
        deleted_ids['annotation_id'] = annotation_id

    add_user_action(cursor, None, 'DELETE', F'Delete place_instance {place_instance_id}.',
            deleted_data)

    return flask.jsonify(deleted_ids), 200


def patch_place_instance(cursor, olddata, place_instance_id):
    payload = flask.request.json

    allowed_kws = [
            'confidence',
            'comment',
            'place_id',
            'annotation_id'
            ]

    if type(payload) is not dict:
        raise werkzeug.exceptions.BadRequest('Payload must be a JSON object')

    if all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())):
                raise werkzeug.exceptions.UnprocessableEntity('Payload must contain one or more of these fields: '
                        + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'{x} = %({x})s', kws))

    query_str = 'UPDATE place_instance SET ' + update_str + ' WHERE id = %(place_instance_id)s;'

    query = cursor.mogrify(query_str, dict(place_instance_id=place_instance_id, **payload))
    cursor.execute(query)

    add_user_action(cursor, None, 'UPDATE',
            F'Update place instance {place_instance_id}: {cursor.mogrify(update_str, payload).decode("utf-8")}',
            olddata)
    return '', 205
