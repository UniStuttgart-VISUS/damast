import flask
import psycopg2
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .user_action import add_user_action

from .decorators import rest_endpoint

name = 'time'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


def time_group_data(cursor, time_group_id):
    response = dict(time_group_id=time_group_id)
    response['annotation_id'] = cursor.one('select annotation_id from time_group where id = %s;', (time_group_id,))

    cursor.execute('''
      SELECT
          lower(span) as start,
          upper(span) - 1 as end,
          comment,
          confidence,
          id
      FROM
          time_instance
      WHERE
          time_group_id = %(tgi)s;
          ''', tgi=time_group_id)
    response['time_spans'] = list(map(lambda x: x._asdict(), cursor.fetchall()))
    return response


@app.route('/time-group/<int:time_group_id>', methods=['GET', 'PUT', 'DELETE', 'PATCH'], role=['user', 'visitor'])
@rest_endpoint
def time_group(c, time_group_id):
    '''
    CRUD endpoint to manipulate time_group entries.

    [all]     @param time_span_id           ID of tuple, ignored for PUT (use 0)

    C/PUT     @payload                      application/json
              @returns                      application/json

    Create a new group tuple. Optionally takes a valid `annotation_id`.
    Returns the `id` of the created tuple on success.

    Exemplary payload for `PUT /time-group/0`:

      {
        "annotation_id": 412
      }



    R/GET     @returns                      application/json

    Get one time_group tuple.

    Exemplary return value for `GET /time-group/3658`:

      {
        "annotation_id": null,
        "time_group_id": 3658,
        "time_spans": [
          {
            "comment": null,
            "confidence": null,
            "end": 988,
            "start": 985,
            "time_instance_id": 3658
          }
        ]
      }



    U/PATCH   @payload                application/json
              @returns                204 NO CONTENT

    Update the `annotation_id` field to a valid value, or `null`.

    Exemplary payload for `PATCH /time-group/789`:

      {
        "annotation_id": 456
      }


    D/DELETE  @returns                application/json

    Delete all related entities, write `user_action` log, return a JSON with all deleted IDs.

    Exemplary return value for `DELETE /time-group/5678`:

      {
        "deleted": {
          "annotation": 4211,
          "time_group": 5678,
          "time_instance": [
            19221,
            19222,
            32115
          ]
      }

    '''
    if flask.request.method == 'PUT':
        return put_time_group(c)
    else:
        if c.one('select count(*) from time_group where id = %s;', (time_group_id,)) == 0:
            raise werkzeug.exceptions.NotFound(F'Time group with ID {time_group_id} does not exist.')

        if flask.request.method == 'GET':
            response = time_group_data(c, time_group_id)
            return flask.jsonify(response)
        elif flask.request.method == 'DELETE':
            return delete_time_group(c, time_group_id)
        elif flask.request.method == 'PATCH':
            return patch_time_group(c, time_group_id)

        raise werkzeug.exceptions.MethodNotAllowed()


def put_time_group(c):
    payload = flask.request.json

    allowed_kws = [ 'annotation_id' ]

    if type(payload) is not dict:
        raise werkzeug.exceptions.BadRequest('Payload must be a JSON object')

    if any(map(lambda x: x not in allowed_kws, payload.keys())):
        raise werkzeug.exceptions.UnprocessableEntity('Payload may only contain "annotation_id".')

    aid = payload.get('annotation_id', None)

    query_str = 'INSERT INTO time_group (annotation_id) VALUES (%s) RETURNING id;'
    time_group_id = c.one(query_str, (aid,))

    add_user_action(c, None, 'CREATE',
            F'Create time group {time_group_id}{"with annotation_id %s"%aid if aid is not None else ""}',
            None)
    return dict(time_group_id=time_group_id), 201


def delete_time_group(c, time_group_id):
    olddata = time_group_data(c, time_group_id)
    deleted = dict(time_group=time_group_id, time_instance=list(map(lambda x: x['id'], olddata['time_spans'])))
    tg_old = c.one('delete from time_group where id = %s returning *;', (time_group_id,))
    olddata['time_group'] = tg_old._asdict()

    if olddata['annotation_id'] is not None:
        deleted['annotation'] = olddata['annotation_id']
        olddata['annotation'] = c.one('delete from annotation where id = %s returning *;', (olddata['annotation_id'],))._asdict()
        del olddata['annotation_id']

    add_user_action(c, None, 'DELETE', F'Delete time_group {time_group_id}.', olddata)
    return flask.jsonify(dict(deleted=deleted)), 200


def patch_time_group(c, time_group_id):
    payload = flask.request.json

    allowed_kws = [ 'annotation_id' ]

    if type(payload) is not dict:
        raise werkzeug.exceptions.BadRequest('Payload must be a JSON object')

    if any(map(lambda x: x not in allowed_kws, payload.keys())):
        raise werkzeug.exceptions.UnprocessableEntity('Payload may only contain "annotation_id".')

    if 'annotation_id' not in payload:
        return '', 204

    aid = payload['annotation_id']
    elem = c.one('select * from time_group where id = %s;', (time_group_id,))
    query_str = 'UPDATE time_group SET annotation_id = %(annotation_id)s WHERE id = %(time_group_id)s;'
    query = c.mogrify(query_str, dict(time_group_id=time_group_id, annotation_id=aid))
    c.execute(query)

    add_user_action(c, None, 'UPDATE',
            F'Update time_group with ID {time_group_id}: annotation_id = {aid}',
            elem._asdict())
    return '', 204


@app.route('/time-group/<int:time_group_id>/time-instance/<int:time_instance_id>', methods=['GET', 'PUT', 'DELETE', 'PATCH'], role=['user', 'visitor'])
@rest_endpoint
def time_instance(c, time_group_id, time_instance_id):
    '''
    CRUD endpoint to manipulate time_instance entries. The `time_group_id` and
    `time_instance.time_group_id` must match.

    [all]     @param time_group_id          ID of time_group tuple
              @param time_instance_id       ID of time_instance tuple, ignored for PUT


    C/PUT     @payload                      application/json
              @returns                      application/json

    Create a new timespan tuple. Optionally takes start, end, comment and
    confidence. Returns the ID of the created tuple.

    Exemplary payload for `PUT /time-group/2/time-instance/0`:

      {
        "start": 1200,
        "end": 1300,
        "comment": "New comment",
        "confidence": "contested"
      }



    R/GET     @returns                      application/json

    Get one time_instance tuple.

    Exemplary return value for `GET /time-group/3659/time-instance/3670`:

      {
        "comment": "new comment",
        "confidence": "probable",
        "end": 1299,
        "id": 3669,
        "start": null,
        "time_group_id": 3659
      }



    U/PATCH   @payload                application/json
              @returns                204 NO CONTENT

    Update the start, end, confidence, or comment fields.

    Exemplary payload for `PATCH /time-group/789/time-instance/1000`:

      {
        "start": 1238,
        "comment": "Start year now confirmed",
        "confidence": "probable"
      }


    D/DELETE  @returns                application/json

    Delete tuple, write `user_action` log, return a JSON with deleted ID.

    Exemplary return value for `DELETE /time-group/5678/time-instance/1234`:

      {
        "deleted": {
          "time_instance": 1234
        }
      }

    '''
    if flask.request.method == 'PUT':
        return put_time_instance(c, time_group_id)
    else:
        if c.one('select count(*) from time_group join time_instance on time_instance.time_group_id = time_group.id where time_group.id = %s and time_instance.id = %s;', (time_group_id, time_instance_id)) == 0:
            raise werkzeug.exceptions.NotFound(F'Time group {time_group_id} or time instance {time_instance_id} do not exist, or are not related.')

        if flask.request.method == 'GET':
            return get_time_instance(c, time_instance_id)
        elif flask.request.method == 'PATCH':
            return patch_time_instance(c, time_group_id, time_instance_id)
        elif flask.request.method == 'DELETE':
            return delete_time_instance(c, time_group_id, time_instance_id)

        raise werkzeug.exceptions.MethodNotAllowed()


def put_time_instance(c, time_group_id):
    # check if evidence and time group exist
    if c.one('select count(*) from time_group where time_group.id = %s;', (time_group_id,)) == 0:
        raise werkzeug.exceptions.NotFound(F'Time group {time_group_id} does not exist.')

    payload = flask.request.json
    if type(payload) is not dict:
        raise werkzeug.exceptions.BadRequest('Payload must be JSON')

    if 'start' in payload and 'end' not in payload \
            or 'start' not in payload and 'end' in payload:
                raise werkzeug.exceptions.UnprocessableEntity('Payload must contain both "start" and "end" values, or neither.')

    start = payload.get('start', None)
    end = payload.get('end', None)
    ts = psycopg2.extras.NumericRange(start, end, '[]')
    confidence = payload.get('confidence', None)
    comment = payload.get('comment', None)

    new_id = c.one('insert into time_instance (time_group_id, span, confidence, comment) values (%s, %s, %s, %s) returning id;', (time_group_id, ts, confidence, comment))

    add_user_action(c, None, 'CREATE', F'Added time instance with id {new_id} ({start}—{end}, confidence {confidence}), time group {time_group_id}.', None)

    return flask.jsonify({'time_instance_id': new_id}), 201


def get_time_instance(c, time_instance_id):
    tup = c.one('select * from time_instance where id = %s;', (time_instance_id,))

    o = tup.span
    start = None if o is None or o.lower is None else o.lower if o.lower_inc else o.lower + 1
    end = None if o is None or o.upper is None else o.upper if o.upper_inc else o.upper - 1

    response = tup._asdict()
    del response['span']
    response['start'] = start
    response['end'] = end

    return flask.jsonify(response)


def patch_time_instance(c, time_group_id, time_instance_id):
    payload = flask.request.json
    if type(payload) is not dict or len(payload) == 0:
        raise werkzeug.exceptions.BadRequest('Payload must be non-empty JSON.')

    if 'start' in payload and 'end' not in payload \
            or 'start' not in payload and 'end' in payload:
                raise werkzeug.exceptions.UnprocessableEntity('Payload must contain both "start" and "end" values, or neither.')

    old_value = c.one('select * from time_instance where id = %s;', (time_instance_id,))

    o = old_value.span
    start = None if o is None or o.lower is None else o.lower if o.lower_inc else o.lower + 1
    end = None if o is None or o.upper is None else o.upper if o.upper_inc else o.upper - 1

    changes = dict()
    if 'comment' in payload:
        changes['comment'] = payload['comment']
    if 'confidence' in payload:
        changes['confidence'] = payload['confidence']
    if 'start' in payload:
        start = payload['start']
        end = payload['end']
        changes['span'] = psycopg2.extras.NumericRange(start, end, '[]')

    keys, values = tuple(zip(*changes.items()))

    changestr = ', '.join(map(lambda x: F'{x} = %({x})s', changes.keys()))
    difference_str = c.mogrify(changestr, changes).decode('utf-8')
    querystr = 'update time_instance set ' + difference_str + ' where id = %(time_instance_id)s;'

    query = c.mogrify(querystr, dict(time_instance_id=time_instance_id))

    add_user_action(c, None, 'UPDATE', F'Changing time instance {time_instance_id} (time group ID {time_group_id}): {difference_str}.', old_value._asdict())

    c.execute(query)

    return '', 205


def delete_time_instance(c, time_group_id, time_instance_id):
    deleted = c.one('delete from time_instance where id = %s returning *;', (time_instance_id,))._asdict()

    add_user_action(c, None, 'DELETE', F'Delete time_instance {time_instance_id} for time group ID {time_group_id}.', deleted)
    return flask.jsonify(dict(deleted={'time_instance': time_instance_id})), 200
