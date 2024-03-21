import os
import flask
import werkzeug.exceptions
import json
import jsonschema


def load_schema(uri):
    root_path = 'https://www2.visus.uni-stuttgart.de/damast/vis/schemas/'
    if uri.startswith(root_path):
        path = uri.replace(root_path, '')
        schema_path = os.path.join(flask.current_app.root_path, 'vis/static/schemas', path)

        with open(schema_path) as f:
            schema = json.load(f)
            return schema

    raise UserError(F'Could not load schema at {uri}')


def init_post():
    if flask.request.content_type is None:
        raise werkzeug.exceptions.BadRequest('Request must have either a JSON payload or a JSON file attached as multipart/form-data.')

    if 'application/json' in flask.request.content_type:
        filter_json = flask.request.json
    elif 'multipart/form-data' in flask.request.content_type:
        filter_json = json.load(flask.request.files['filter_file'])
    else:
        raise werkzeug.exceptions.BadRequest('Request must have either a JSON payload or a JSON file attached as multipart/form-data.')

    schema = load_schema('https://www2.visus.uni-stuttgart.de/damast/vis/schemas/exportable-filters.json')
    r = jsonschema.RefResolver('https://www2.visus.uni-stuttgart.de/damast/vis/schemas/',
        'https://www2.visus.uni-stuttgart.de/damast/vis/schemas/exportable-filters.json',
        handlers=dict(http=load_schema, https=load_schema), cache_remote=False)
    v = jsonschema.Draft7Validator(schema, resolver=r)

    if not v.is_valid(filter_json):
        errors = [ ( '/' + '/'.join(map(str, e.path)), e.message ) for e in v.iter_errors(filter_json) ]
        return None, (flask.render_template('reporting/422.html', errors=errors), 422)

    return filter_json, None