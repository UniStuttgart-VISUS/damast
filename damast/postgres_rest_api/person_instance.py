import flask
import psycopg2
import json
import werkzeug.exceptions
import logging
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

from .user_action import add_user_action
from .util import parse_evidence, parse_geoloc
from .decorators import rest_endpoint

name = 'person-instance'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/person-instance/<int:person_instance_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'], role='user')
@rest_endpoint
def modify_person_instance(cursor, person_instance_id):
    if flask.request.method == 'PUT':
        return put_person_instance(cursor)
    else:
        olddata = cursor.one('select * from person_instance where id = %s;', (person_instance_id,))

        if olddata is None:
            raise werkzeug.exceptions.NotFound(F'No person instance with ID {person_instance_id}.')

        olddata = olddata._asdict()

        if flask.request.method == 'GET':
            # get for id
            return flask.jsonify(olddata)
        if flask.request.method == 'DELETE':
            return delete_person_instance(cursor, olddata, person_instance_id)
        if flask.request.method == 'PATCH':
            return patch_person_instance(cursor, olddata, person_instance_id)

    raise werkzeug.exceptions.MethodNotAllowed()


def put_person_instance(cursor):
    payload = flask.request.json

    allowed_kws = [
            'confidence',
            'comment',
            'person_id',
            'annotation_id'
            ]

    if type(payload) is not dict:
        raise werkzeug.exceptions.BadRequest('Payload must be a JSON object')

    logging.getLogger('flask.error').info('PUT person_instance: %s', json.dumps(payload))  # XXX temporary for https://github.tik.uni-stuttgart.de/frankemx/damast/issues/155

    if all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())) \
            or 'person_id' not in payload:
                raise werkzeug.exceptions.UnprocessableEntity('Payload must contain \'person_id\', and one or more of these fields: '
                        + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'%({x})s', kws))

    query_str = 'INSERT INTO person_instance (' + ', '.join(kws) + ') VALUES (' + update_str + ') RETURNING id;'

    person_instance_id = cursor.one(query_str, payload)

    add_user_action(cursor, None, 'CREATE',
            F'Create person instance {person_instance_id}: {", ".join(kws)} = {cursor.mogrify(update_str, payload).decode("utf-8")}',
            None)
    return dict(person_instance_id=person_instance_id), 201


def delete_person_instance(cursor, olddata, person_instance_id):
    deleted_data = dict()
    deleted_ids = dict()

    annotation_id = cursor.one('delete from person_instance where id = %s returning annotation_id;', (person_instance_id,))
    deleted_data['person_instance'] = olddata
    deleted_ids['person_instance_id'] = person_instance_id

    if annotation_id is not None:
        old_annotation = cursor.one('delete from annotation where id = %s returning *;', (annotation_id,))
        deleted_data['annotation'] = old_annotation
        deleted_ids['annotation_id'] = annotation_id

    add_user_action(cursor, None, 'DELETE', F'Delete person_instance {person_instance_id}.',
            deleted_data)

    return flask.jsonify(deleted_ids), 200


def patch_person_instance(cursor, olddata, person_instance_id):
    payload = flask.request.json

    allowed_kws = [
            'confidence',
            'comment',
            'person_id',
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

    query_str = 'UPDATE person_instance SET ' + update_str + ' WHERE id = %(person_instance_id)s;'

    query = cursor.mogrify(query_str, dict(person_instance_id=person_instance_id, **payload))
    cursor.execute(query)

    add_user_action(cursor, None, 'UPDATE',
            F'Update person instance {person_instance_id}: {cursor.mogrify(update_str, payload).decode("utf-8")}',
            olddata)
    return '', 205
