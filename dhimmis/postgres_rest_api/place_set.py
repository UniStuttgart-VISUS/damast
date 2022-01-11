import flask
import psycopg2
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
import werkzeug.exceptions
import datetime
import uuid
import re

from .util import parse_place,parse_geoloc,format_geoloc
from .user_action import add_user_action

from .decorators import rest_endpoint

name = 'place-set'

app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)


from .uri.uri_list_for_place import app as uri_list_for_place
app.register_blueprint(uri_list_for_place)

_isuuid = re.compile('-'.join(map(lambda n: F'[0-9a-fA-F]{"{"}{n}{"}"}', [8,4,4,4,12])))

@app.route('/place-set', role='vis', methods=['GET', 'POST'])
@rest_endpoint
def place_set(c):
    '''
    REST endpoint for place sets. Place sets are used as a filtering
    possibility in the visualization, and are stored in the database to be
    shared between users.

    GET         Returns a JSON list of all place sets in the database.
    POST        Accepts ONE JSON place set as a payload. Depending on whether
                the UUID exists in the database already, the entry is either
                overwritten, or a new entry is created.
    '''
    if flask.request.method == 'GET':
        return flask.jsonify(list(map(lambda x: x._asdict(), c.all('select * from place_set;'))))
    elif flask.request.method == 'POST':
        if flask.current_app.auth.current_user().visitor:
            flask.abort(401)

        now = datetime.datetime.now().isoformat('T')
        u = flask.current_app.auth.current_user().name

        data = dict(**flask.request.json)
        data['date'] = now
        data['username'] = u
        uu = data['uuid']

        if _isuuid.fullmatch(uu) and 1 == c.one('SELECT COUNT(*) FROM place_set WHERE uuid = %s;', (uu,)):
            c.run('UPDATE place_set SET filter = %(filter)s, date = %(date)s, username = %(username)s WHERE uuid = %(uuid)s;', data)

            return '', 205

        else:
            uu = str(uuid.uuid1())
            data['uuid'] = uu
            c.run('INSERT INTO place_set (uuid, description, filter, date, username) VALUES (%(uuid)s, %(description)s, %(filter)s, %(date)s, %(username)s);', data)

            return uu, 201

    raise werkzeug.exceptions.MethodNotAllowed()


