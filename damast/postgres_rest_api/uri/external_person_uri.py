import flask
import psycopg2
import json
from ...authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions

from ..decorators import rest_endpoint

name = 'external-person-uri'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/external-person-uri/<int:uri_id>', methods=['PUT', 'PATCH', 'GET', 'DELETE'], role=['user', 'visitor'])
@rest_endpoint
def modify_person(c, uri_id):
    '''
    CRUD endpoint to manipulate external person URIs.

    [all]     @param uri_id           ID of tuple, 0 or `None` for PUT

    C/PUT     @payload                application/json
              @returns                application/json

    Create a new person URI tuple.

    Required fields: `person_id`, `uri_namespace_id`, `uri_fragment`.
    Optional fields: `comment`.

    Returns the ID for the created entity.

    Exemplary payload for `PUT /uri/external-person-uri/0`:

      {
        "person_id": 12,
        "uri_namespace_id": 1,
        "uri_fragment": "1234",
        "comment": "comment"
      }


    R/GET     @returns                application/json

    Get data for the person URI.

    @returns            application/json

    Example return value of `GET /uri/external-person-uri/1`:

      {
        "id": 1,
        "person_id": 12,
        "uri_namespace_id": 1,
        "uri_fragment": "1234",
        "comment": "comment"
      }


    U/PATCH   @payload                application/json
              @returns                205 RESET CONTENT

    Update one or more of the fields `person_id`, `uri_namespace_id`,
    `uri_fragment`, or `comment`.

    Exemplary payload for `PATCH /uri/external-person-uri/12345`:

      {
        "uri_fragment": "1236",
        "comment": "updated comment..."
      }


    D/DELETE  @returns                application/json

    Delete the tuple and return the ID of the deleted tuple.
    '''
    if flask.request.method == 'PUT':
        return put(c)

    else:
        if c.one('SELECT count(*) FROM external_person_uri WHERE id = %s;', (uri_id,)) == 0:
            raise werkzeug.exceptions.NotFound(F'Person URI {uri_id} does not exist.')

        if flask.request.method == 'GET':
            return get(c, uri_id)
        if flask.request.method == 'DELETE':
            return delete(c, uri_id)
        if flask.request.method == 'PATCH':
            return patch(c, uri_id)

        raise werkzeug.exceptions.MethodNotAllowed()


def put(c):
    payload = flask.request.json
    if type(payload) is not dict:
        raise werkzeug.exceptions.UnsupportedMediaType('Payload of type application/json required.')

    required_kws = ('person_id', 'uri_namespace_id', 'uri_fragment')
    allowed_kws = ('comment',)
    if any(map(lambda x: x not in payload, required_kws)) \
            or all(map(lambda x: x not in payload, (*allowed_kws, *required_kws))) \
            or any(map(lambda x: x not in (*allowed_kws, *required_kws), payload.keys())):
        raise werkzeug.exceptions.BadRequest('Payload MUST contain the keys {} and MAY contain the keys {}.'.format(
            ', '.join(list(map(lambda x: F"'{x}'", required_kws))),
            ', '.join(list(map(lambda x: F"'{x}'", allowed_kws)))
            ))

    uri_id = c.one(
        'INSERT INTO external_person_uri (person_id, uri_namespace_id, uri_fragment, comment) VALUES (%s, %s, %s, %s) RETURNING id;',
        (payload['person_id'], payload['uri_namespace_id'], payload['uri_fragment'], payload.get('comment', None))
    )

    return flask.jsonify(dict(
        external_person_uri_id=uri_id,
    )), 201


def get(c, uri_id):
    return flask.jsonify(c.one('SELECT * FROM external_person_uri WHERE id = %s;', (uri_id,))._asdict())


def delete(c, uri_id):
    uri_id = c.one('DELETE FROM external_person_uri WHERE id = %s RETURNING id;', (uri_id,))
    return flask.jsonify(dict(deleted=dict(external_person_uri=uri_id))), 200


def patch(c, uri_id):
    payload = flask.request.json
    allowed_kws = ('person_id', 'uri_namespace_id', 'uri_fragment', 'comment')

    if type(payload) is not dict:
        raise werkzeug.exceptions.UnsupportedMediaType('Payload of type application/json required.')

    if all(map(lambda x: x not in payload, allowed_kws)) \
            or any(map(lambda x: x not in allowed_kws, payload.keys())):
        raise werkzeug.exceptions.BadRequest('Payload must be a JSON object with one or more of these fields: '
                + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

    kws = list(filter(lambda x: x in payload, allowed_kws))
    update_str = ', '.join(map(lambda x: F'{x} = %({x})s', kws))

    query_str = 'UPDATE external_person_uri SET ' + update_str + ' WHERE id = %(uri_id)s;'

    query = c.mogrify(query_str, dict(uri_id=uri_id, **payload))
    c.execute(query)

    return '', 205
