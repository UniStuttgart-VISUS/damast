#!/usr/bin/env python3

import flask
import urllib.parse
import base64
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..postgres_rest_api.decorators import rest_endpoint

auth = flask.current_app.config['auth']

app = AuthenticatedBlueprintPreparator('geodb_editor', __name__, template_folder='templates')
app.static_url_path = None

@app.route('/places', role='geodb')
def root():
    return flask.render_template('geodb_editor/places.html', current='places')

@app.route('/persons', role='geodb')
def persons():
    return flask.render_template('geodb_editor/persons.html', current='persons')

@app.route('/<path:path>', role='geodb')
def file(path):
    return flask.current_app.serve_static_file(__path__[0] + '/static', path)

@app.route('/view-evidence/<int:evidence_id>', role='geodb')
@rest_endpoint
def redirect_for_evidence(cursor, evidence_id):
    place_id = cursor.one('SELECT PI.place_id FROM evidence E JOIN place_instance PI ON E.place_instance_id = PI.id WHERE E.id = %s;', (evidence_id,))

    fragment = urllib.parse.quote(
            base64.b64encode(
                json.dumps(
                    dict(place_id=place_id, evidence_id=evidence_id)
                ).encode('utf-8')
            )
        )
    url = flask.url_for('.root')
    (scheme, loc, path, query, _) = urllib.parse.urlsplit(url)
    next_ = urllib.parse.urlunsplit((scheme, loc, path, query, fragment))

    return flask.redirect(next_, 301)
