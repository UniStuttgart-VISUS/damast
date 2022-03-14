import flask
import psycopg2
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

from .decorators import rest_endpoint
from .user_action import add_user_action

name = 'source'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/source-instance/<int:source_instance_id>', methods=['GET', 'PUT', 'DELETE', 'PATCH'], role='user')
@rest_endpoint
def source_instance(c, source_instance_id):
    '''
    CRUD endpoint to manipulate source instance entries.

    [all]     @param source_instance_id     ID of tuple, ignored for PUT (use 0)

    C/PUT     @payload                      application/json
              @returns                      application/json

    Create a new source instance tuple. `source_id` is required in the payload,
    `source_page` and `comment` are optional. Returns the `id` of the created
    tuple on success.

    Exemplary payload for `PUT /source-instance/0`:

      {
        "comment": "new instance via PUT, 2",
        "source_id": 3,
        "source_page": "1--2",
        "source_confidence": "contested",
        "evidence_id": 12
      }



    R/GET     @returns                      application/json

    Get one source instance tuple.

    Exemplary return value for `GET /source-instance/4702`:

      {
        "comment": "new comment",
        "evidence_id": 3662,
        "id": 4702,
        "source_id": 3,
        "source_page": null,
        "source_confidence": "contested"
      }


    U/PATCH   @payload                application/json
              @returns                application/json

    Update one or more of the fields `comment` or `source_page`. All other fields or
    connected entities must be modified via their respective endpoints.

    Exemplary payload for `PATCH /source-instance/567`:

      {
        "comment": "updated comment...",
        "source_page": "6--7"
      }

    D/DELETE  @returns                application/json

    Delete all related entities, write `user_action` log, return a JSON with all deleted IDs.

    Exemplary return valye for `DELETE /source-instance/5678`:

      {
        "deleted": {
          "source_instance": 5678
        }
      }

    '''
    if flask.request.method == 'PUT':
        required_kws = ('source_id', 'evidence_id')
        allowed_kws = ('source_page', 'comment', 'source_confidence')

        payload = flask.request.json
        if type(payload) is not dict:
            raise werkzeug.exceptions.BadRequest('Request payload must be valid JSON.')


        if any(map(lambda key: key not in payload, required_kws)) \
                or all(map(lambda x: x not in payload, (*allowed_kws, *required_kws))) \
                or any(map(lambda x: x not in (*allowed_kws, *required_kws), payload.keys())):
                    raise werkzeug.exceptions.UnprocessableEntity(F'Payload MUST contain {", ".join(required_kws)}. Payload MAY contain {", ".join(allowed_kws)}.')

        sid = payload['source_id']
        eid = payload['evidence_id']
        page = payload.get('source_page', None)
        comment = payload.get('comment', None)
        source_confidence = payload.get('source_confidence', None)

        new_id = c.one('insert into source_instance (evidence_id, source_id, source_page, comment, source_confidence) values (%s, %s, %s, %s, %s) returning id;', (eid, sid, page, comment, source_confidence))

        add_user_action(c, eid, 'CREATE', F'Added source instance for source with ID {sid}, page {page}, to evidence with ID {eid}.', None)

        return flask.jsonify({'source_instance_id': new_id}), 201

    else:
        if c.one('select count(*) from source_instance where id = %s;', (source_instance_id,)) == 0:
            raise werkzeug.exceptions.NotFound(F'Source instance with ID {source_instance_id} does not exist.')

        if flask.request.method == 'GET':
            return flask.jsonify(c.one('select * from source_instance where id = %s;', (source_instance_id,))._asdict())

        elif flask.request.method == 'DELETE':
            data = c.one('delete from source_instance where id = %s returning *;', (source_instance_id,))._asdict()
            add_user_action(c, data['evidence_id'], 'UPDATE', F'Delete source_instance with ID {source_instance_id} from evidence with ID {data["evidence_id"]}.', data)

            return flask.jsonify({'deleted': {'source_instance': data['id']}}), 200

        elif flask.request.method == 'PATCH':
            payload = flask.request.json
            allowed_kws = ('comment', 'source_page', 'source_id', 'source_confidence')

            if type(payload) is not dict:
                raise werkzeug.exceptions.BadRequest('Payload must be valid JSON.')

            if all(map(lambda x: x not in payload, allowed_kws)) \
                    or any(map(lambda x: x not in allowed_kws, payload.keys())):
                        raise werkzeug.exceptions.UnprocessableEntity('Payload must be a JSON object with one or more of these fields: '
                        + ', '.join(map(lambda x: F"'{x}'", allowed_kws)))

            elem = c.one('select * from source_instance where id = %s;', (source_instance_id,))

            kws = list(filter(lambda x: x in payload, allowed_kws))
            update_str = ', '.join(map(lambda x: F'{x} = %({x})s', kws))

            query_str = 'UPDATE source_instance SET ' + update_str + ' WHERE id = %(source_instance_id)s;'

            query = c.mogrify(query_str, dict(source_instance_id=source_instance_id, **payload))
            c.execute(query)

            add_user_action(c, elem.evidence_id, 'UPDATE',
                    F'Update source_instance with ID {source_instance_id} for evidence with ID {elem.evidence_id}: {c.mogrify(update_str, payload).decode("utf-8")}',
                    elem._asdict())
            return '', 205

    raise werkzeug.exceptions.MethodNotAllowed()


@app.route('/evidence/<int:evidence_id>/source-instances', role='user')
@rest_endpoint
def source_instance_list(c, evidence_id):
    '''
    Get all source instance entries for evidence `evidence_id`.

    @param evidence_id            ID of evidence tuple
    @returns                      application/json

    Exemplary return value for `GET /evidence/3662/source-instances`:

      [
        {
          "comment": "new comment",
          "evidence_id": 3662,
          "id": 4702,
          "source_id": 3,
          "source_page": null,
          "confidence": "contested"
        },
        {
          "comment": "new comment 2",
          "evidence_id": 3662,
          "id": 4703,
          "source_id": 1,
          "source_page": "test",
          "confidence": "probable"
        }
      ]
    '''
    if 0 == c.one('select count(*) from evidence where id = %s;', (evidence_id,)):
        raise werkzeug.exceptions.NotFound(F'No evidence with ID {evidence_id}.')

    query = c.mogrify('select * from source_instance where evidence_id = %s;', (evidence_id,))
    c.execute(query)
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))


@app.route('/sources-list', role='user')
@rest_endpoint
def get_sources_list(c):
    '''
    Get a list of all sources.

    @returns        application/json

    This returns a JSON array of objects with `id` and `name` from table
    `source`. This API endpoint replaces `/SourcesList` in the old servlet
    implementation.

    Example return value excerpt:

      [
        {
          "id": 32,
          "name": "Bar Ebroyo / Wilmshurst",
          "short": "Bar Ebroyo / Wilmshurst",
          "default_confidence": "probable"
        },
        {
          "id": 1,
          "name": "Fiey, Jean Maurice (1993): Pour un Oriens [...]",
          "short": "OCN",
          "default_confidence": "certain"
        },
        ...
      ]
    '''
    c.execute('select id, name, short, default_confidence from source;')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))
