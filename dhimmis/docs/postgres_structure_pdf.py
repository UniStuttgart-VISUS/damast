import flask
import re
import os
import datetime
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'schema'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

@app.route('/schema', role=('pgadmin','admin','dev'))
def root():
    '''
    Get the PDF with the database structure.

    @returns application/pdf
    '''
    schema_pdf = os.path.join(app.blueprint.root_path, 'assets', 'database_schema.pdf')
    fname = datetime.datetime.fromtimestamp(os.path.getmtime(schema_pdf + '.br')).astimezone().strftime('postgresql_schema_%Y%m%dT%H%M%S.pdf')

    return flask.current_app.serve_static_file('/', schema_pdf, download_name=fname)
