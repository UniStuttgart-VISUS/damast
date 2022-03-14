import flask
import psycopg2
import json
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

from .user_action import add_user_action
from .util import parse_evidence, parse_geoloc
from .decorators import rest_endpoint

name = 'religion-instance'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/religion-instance/<int:religion_instance_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'], role='user')
@rest_endpoint
def modify_religion_instance(cursor, religion_instance_id):
    if flask.request.method == 'PUT':
        return put_religion_instance(cursor)
    else:
        olddata = cursor.one('select * from religion_instance where id = %s;', (religion_instance_id,))

        if olddata is None:
            raise werkzeug.exceptions.NotFound(F'No religion instance with ID {religion_instance_id}.')

        olddata = olddata._asdict()

        if flask.request.method == 'GET':
            # get for id
            return flask.jsonify(olddata)
        if flask.request.method == 'DELETE':
            return delete_religion_instance(cursor, olddata, religion_instance_id)
        if flask.request.method == 'PATCH':
            return patch_religion_instance(cursor, olddata, religion_instance_id)

    raise werkzeug.exceptions.MethodNotAllowed()


def put_religion_instance(cursor):
    payload = flask.request.json

    allowed_kws = [
            'confidence',
            'comment',
            'religion_id',
            'annotation_id'
            ]

    if type(payload) is not dict:
        raise werkzeug.exceptions.BadRequest('Payload must be a JSON object')

    if all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())) \
            or 'religion_id' not in payload:
                raise werkzeug.exceptions.UnprocessableEntity('Payload must contain \'religion_id\', and one or more of these fields: '
                        + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'%({x})s', kws))

    query_str = 'INSERT INTO religion_instance (' + ', '.join(kws) + ') VALUES (' + update_str + ') RETURNING id;'

    religion_instance_id = cursor.one(query_str, payload)

    add_user_action(cursor, None, 'CREATE',
            F'Create religion instance {religion_instance_id}: {", ".join(kws)} = {cursor.mogrify(update_str, payload).decode("utf-8")}',
            None)
    return dict(religion_instance_id=religion_instance_id), 201


def delete_religion_instance(cursor, olddata, religion_instance_id):
    deleted_data = dict()
    deleted_ids = dict()

    annotation_id = cursor.one('delete from religion_instance where id = %s returning annotation_id;', (religion_instance_id,))
    deleted_data['religion_instance'] = olddata
    deleted_ids['religion_instance_id'] = religion_instance_id

    if annotation_id is not None:
        old_annotation = cursor.one('delete from annotation where id = %s returning *;', (annotation_id,))
        deleted_data['annotation'] = old_annotation
        deleted_ids['annotation_id'] = annotation_id

    add_user_action(cursor, None, 'DELETE', F'Delete religion_instance {religion_instance_id}.',
            deleted_data)

    return flask.jsonify(deleted_ids), 200


def patch_religion_instance(cursor, olddata, religion_instance_id):
    payload = flask.request.json

    allowed_kws = [
            'confidence',
            'comment',
            'religion_id',
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

    query_str = 'UPDATE religion_instance SET ' + update_str + ' WHERE id = %(religion_instance_id)s;'

    query = cursor.mogrify(query_str, dict(religion_instance_id=religion_instance_id, **payload))
    cursor.execute(query)

    add_user_action(cursor, None, 'UPDATE',
            F'Update religion instance {religion_instance_id}: {cursor.mogrify(update_str, payload).decode("utf-8")}',
            olddata)
    return '', 205
