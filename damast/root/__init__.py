#!/usr/bin/env python3

import flask
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

auth = flask.current_app.config['auth']

app = AuthenticatedBlueprintPreparator('root-app', __name__, template_folder='templates')

@app.route('/', role=['user', 'visitor'])
def root():
    language = flask.request.args.get('lang', 'en')
    return flask.render_template('root/index.html', language=language)

@app.route('/<path:path>', role=['user', 'visitor'])
def file(path):
    return flask.current_app.serve_static_file(__path__[0] + '/static', path)

@app.route('/impressum.html', optional=True)
def impressum():
    return flask.render_template('root/impressum.html')

@app.route('/datenschutz.html', optional=True)
def datenschutz():
    return flask.render_template('root/datenschutz.html')

@app.route('/static/public/<path:filename>', optional=True)
def static_public(filename):
    return flask.current_app.serve_static_file(__path__[0] + '/static', F'public/{filename}')

@app.route('/whoami', optional=True)
def whoami():
    u = flask.current_app.auth.current_user()

    if u is None:
        data = dict(user=None, readdb=False, writedb=False, visitor=True)

    else:
        data = dict(user=u.name,
            readdb=('readdb' in u.roles or 'admin' in u.roles),
            writedb=('writedb' in u.roles or 'admin' in u.roles),
            geodb=('geodb' in u.roles or 'admin' in u.roles),
            dev=('dev' in u.roles),
            visitor=u.visitor,
            )

    return flask.jsonify(data)


@app.route('/cookie-preferences', optional=True)
def cookie_preferences():
    return flask.render_template('root/cookies.html')
