import flask
import psycopg2
import json
from ...authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions

from ..decorators import rest_endpoint

name = 'uri-list'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/place/<int:place_id>/external-uri-list', role='user')
@rest_endpoint
def get_uri_list_for_place(c, place_id):
    '''
    Get a list of external URIs for a place.

    @param   place_id   ID of place
    @returns            application/json

    Example return value excerpt for `GET /rest/place/12/external-uri-list`:

        [
          {
            "id": 1,
            "place_id": 12,
            "uri_namespace_id": 1,
            "uri_fragment": "27223",
            "comment": null
          }
          ...
        ]
    '''
    if 0 == c.one('SELECT COUNT(*) FROM place WHERE id = %s;', (place_id,)):
        raise werkzeug.exceptions.NotFound(F'No place with ID {place_id}.')

    query = c.mogrify('SELECT * FROM external_place_uri WHERE place_id = %s;', (place_id,))
    c.execute(query)
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))

