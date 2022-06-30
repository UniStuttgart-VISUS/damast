import flask
import psycopg2
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions

from .util import parse_place,parse_geoloc,format_geoloc
from .user_action import add_user_action

from .decorators import rest_endpoint

name = 'person-type'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


@app.route('/person-type-list', role=['user', 'visitor'])
@rest_endpoint
def get_place_type_list(c):
    '''
    Get a list of all person types.

    @returns        application/json

    This returns a JSON array of objects with `id`, and `type` from table
    `person_type`.

    Example return value excerpt:

      [
        {
          "id": 1,
          "type": "Bishop"
        },
        ...
      ]

    '''
    c.execute('select id, type from person_type order by id asc')
    return flask.jsonify(list(map(lambda x: x._asdict(), c.fetchall())))


