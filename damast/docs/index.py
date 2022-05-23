import flask
import re
import os
import datetime
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'index'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

@app.route('/', role=['user', 'visitor','dev'])
def root():
    # find database schema pdf, if exists
    schema_pdf = os.path.join(app.blueprint.root_path, 'assets/database_schema.pdf.br')
    params = {
            "structure_pdf_filename": datetime.datetime.fromtimestamp(os.path.getmtime(schema_pdf)).astimezone().strftime('postgresql_schema_%Y%m%dT%H%M%S.pdf') if os.path.exists(schema_pdf) else None
            }

    return flask.render_template('docs/index.html', **params)

@app.route('/index/static/<path:filename>', role=['user', 'visitor', 'dev'])
def static(filename):
    return flask.current_app.serve_static_file(app.blueprint.root_path + '/static/index', filename)
