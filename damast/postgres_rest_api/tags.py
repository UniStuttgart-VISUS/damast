import flask
import psycopg2
import json
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

from .user_action import add_user_action
from .util import parse_evidence, parse_geoloc
from .decorators import rest_endpoint

name = 'tags'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/tag-list', role=['user', 'visitor'])
@rest_endpoint
def get_tag_list(c):
    '''
    Get a list of tags.

    @returns            application/json

    Example return value excerpt:

      [
        {
          "id": 1,
          "tagname": "bishopric",
          "comment": "test comment"
        },
        ...
      ]
    '''
    c.execute('select * from tag;')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))


@app.route('/tag-sets', role=['user', 'visitor'])
@rest_endpoint
def get_tag_sets(c):
    '''
    Get the set of evidence IDs for each tag.

    @returns            application/json

    Example return value excerpt:

      [
        {
          "tag_id": 1,
          "evidence_ids": [1,2,3,6,37]
        },
        {
          "tag_id": 2,
          "evidence_ids": [1,3]
        },
        ...
      ]
    '''
    c.execute('''SELECT
    T.id AS tag_id,
    (
        SELECT
            CASE WHEN array_agg(TE.evidence_id) IS NULL
            THEN array_to_json(ARRAY[]::INTEGER[])
            ELSE array_to_json(array_agg(TE.evidence_id))
        END AS array_to_json
        FROM tag_evidence TE
        WHERE (TE.tag_id = T.id)
    ) AS evidence_ids
FROM tag T;''')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))


@app.route('/evidence/<int:evidence_id>/tags', role=['user', 'visitor'], methods=['GET', 'PUT'])
@rest_endpoint
def modify_tags_for_evidence(c, evidence_id):
    '''
    Get or set tag set for evidence.

    @param              evidence_id     ID of evidence

    GET

        Get list of tag IDs as array.

        @returns            application/json

        Return value example for `GET /rest/evidence/1/tags`:

          [1,4,6]


    PUT

        Replace list of tag IDs. Takes a JSON array as payload.

        @returns            nothing

        Payload value example for `PUT /rest/evidence/1/tags`:

          [1,2]
    '''
    if c.one('select count(*) from evidence where id = %s;', (evidence_id,)) == 0:
        raise werkzeug.exceptions.NotFound(F'No evidence with ID {evidence_id}')

    if flask.request.method == 'GET':
        query = c.mogrify('select tag_id from tag_evidence where evidence_id = %s;', (evidence_id,))
        c.execute(query)
        return flask.jsonify(list(map(lambda x: x.tag_id, c.fetchall())))
    elif flask.request.method == 'PUT':
        payload = flask.request.json
        import logging
        logging.getLogger('flask.error').info(payload)
        if type(payload) is not list:
            raise werkzeug.exceptions.UnsupportedMediaType('Payload of type application/json required.')
        if not all(map(lambda x: type(x) is int, payload)):
            raise werkzeug.exceptions.UnprocessableEntity('Payload must be array of IDs')
        if not len(payload) == len(set(payload)):
            raise werkzeug.exceptions.Conflict('Payload may not contain duplicates')

        # get old IDs
        query = c.mogrify('select tag_id from tag_evidence where evidence_id = %s;', (evidence_id,))
        c.execute(query)
        old_ids = list(map(lambda x: x.tag_id, c.fetchall()))

        # calculate deltas
        add = [ id_ for id_ in payload if id_ not in old_ids ]
        remove = [ id_ for id_ in old_ids if id_ not in payload ]

        if len(add) == 0 and len(remove) == 0:
            return '', 204

        for a in add:
            query = c.mogrify('insert into tag_evidence (tag_id, evidence_id) values (%s, %s);', (a, evidence_id))
            c.execute(query)

        for r in remove:
            query = c.mogrify('delete from tag_evidence where tag_id=%s and evidence_id=%s;', (r, evidence_id))
            c.execute(query)

        logmsg = F'Change tag IDs for evidence {evidence_id}: {old_ids} -> {payload} (+{add}/-{remove})'
        add_user_action(c, evidence_id, 'UPDATE', logmsg, old_ids)

        return '', 205
    else:
        raise werkzeug.exceptions.MethodNotAllowed()

