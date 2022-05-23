import flask
import psycopg2
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions

from .user_action import add_user_action

from .decorators import rest_endpoint

name = 'person'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None, url_prefix='/person')

@app.route('/<int:person_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'], role=['user', 'visitor'])
@rest_endpoint
def person_data(c, person_id):
    '''
    CRUD endpoint to manipulate person tuples.

    [all]     @param person_id        ID of person tuple, 0 or `None` for PUT

    C/PUT     @payload                application/json
              @returns                application/json

    Create a new person tuple. `name` is a required field, the rest is optional.
    Returns the ID for the created entity. Fails if a person with that name
    already exists.

    Exemplary payload for `PUT /person/0`:

      {
        "name": "Testperson",
        "comment": "Test comment",
        "time_range": "6th century",
        "person_type": 2
      }


    R/GET     @returns                application/json

    Get person data for the person with ID `person_id`.

    @param person_id     Integer, `id` in table `person`
    @returns            application/json

    This returns the data from table `person` as a single JSON object.

    Example return value:

      {
        "id": 12,
        "name": "Testperson",
        "comment": "Test comment",
        "time_range": "6th century",
        "person_type": 2
      }


    U/PATCH   @payload                application/json
              @returns                application/json

    Update one or more of the fields 'comment', 'name', 'time_range',
    'person_type', or 'name'.

    Exemplary payload for `PATCH /person/12345`:

      {
        "comment": "updated comment...",
        "name": "updated name"
      }


    D/DELETE  @returns                application/json

    Delete a person if there are no conflicts. Otherwise, fail. Returns the ID
    of the deleted tuple.

    '''
    if flask.request.method == 'PUT':
        return put_person_data(c)

    else:
        if c.one('select count(*) from person where id = %s;', (person_id,)) == 0:
            return flask.abort(404, F'Person {person_id} does not exist.')

        if flask.request.method == 'GET':
            return get_person_data(c, person_id)
        if flask.request.method == 'DELETE':
            return delete_person_data(c, person_id)
        if flask.request.method == 'PATCH':
            return update_person_data(c, person_id)

        flask.abort(405)


def get_person_data(c, person_id):
    data = c.one('select * from person where id = %(person_id)s;', **locals())
    return flask.jsonify(data._asdict())


def update_person_data(c, person_id):
    payload = flask.request.json
    if type(payload) is not dict or len(payload) == 0:
        return flask.abort(415, 'Payload must be non-empty JSON.')

    old_value = c.one('select * from person where id = %s;', (person_id,))

    payload = flask.request.json
    allowed_kws = ('comment', 'time_range', 'person_type', 'name')

    if type(payload) is not dict \
            or len(payload) == 0 \
            or all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())):
        return flask.abort(400, 'Payload must be a JSON object with one or more of these fields: '
                + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

    if 'name' in payload and payload['name'] == '':
        return 'Person name must not be empty', 400

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'{x} = %({x})s', kws))

    query_str = 'UPDATE person SET ' + update_str + ' WHERE id = %(person_id)s;'

    query = c.mogrify(query_str, dict(person_id=person_id, **payload))
    c.execute(query)

    add_user_action(c, None, 'UPDATE',
            F'Update person {person_id}: {c.mogrify(update_str, payload).decode("utf-8")}',
            old_value._asdict())
    return '', 205


def delete_person_data(c, person_id):
    query = c.mogrify('delete from person where id = %s returning *;', (person_id,))
    old_value = c.one(query)._asdict()

    add_user_action(c, None, 'DELETE', F'Delete person {old_value["name"]} ({person_id}).', old_value)

    return flask.jsonify(dict(deleted=dict(person=person_id))), 205


def put_person_data(c):
    payload = flask.request.json

    if not payload or 'name' not in payload:
        flask.abort(400, 'Payload must be a JSON object with at least the `name` field.')

    comment = payload.get('comment', None)
    time_range = payload.get('time_range', '')
    name = payload.get('name', None)
    person_type = payload.get('person_type', None)

    person_id = c.one('insert into person (name, comment, time_range, person_type) values (%(name)s, %(comment)s, %(time_range)s, %(person_type)s) returning id;', **locals())

    add_user_action(c, None, 'CREATE', F'Create person {name} with ID {person_id}.', None)
    return flask.jsonify(dict(person_id=person_id)), 201
