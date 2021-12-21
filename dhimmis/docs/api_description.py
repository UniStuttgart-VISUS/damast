import flask
import re
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'api-description'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

def strip_leading_space(s):
    if s is None:
        return '<no docstring>'
    leading_spaces = re.compile('^\s*')
    lines = s.split('\n')
    num_spaces = min(map(lambda s: leading_spaces.match(s).end(), filter(lambda x: len(x.strip()) > 0, lines)))
    if len(lines[0].strip()) == 0:
        lines = lines[1:]
    return '\n\r'.join(map(lambda x: x[num_spaces:], lines))

@app.route('/api', role='dev')
def root():
    '''
    Get list of API endpoints and documentation.

    @returns    text/html; charset=utf-8

    This returns an HTML page describing all registered endpoints and their
    function docstrings. This endpoint is not part of the API, but rather
    documentation for programmers using the API.
    '''
    global name
    prefix = '/rest'

    routes = sorted(
                list(
                    filter(
                        lambda rule: str(rule).startswith(prefix),
                        list(flask.current_app.url_map.iter_rules())
                    )
                ),
                key=lambda rule: str(rule))
    route_data = [ { 'methods': sorted(list(m.methods)),
            'href': str(m),
            'link_title': flask.escape(str(m)),
            'number': i,
            'doc': strip_leading_space(flask.current_app.view_functions[m.endpoint].__doc__)
            } for i,m in enumerate(routes) ]

    return flask.render_template('docs/api.html', title='PostgreSQL REST API', route_data=route_data)


@app.route('/api/static/<path:filename>', role='dev')
def static(filename):
    return flask.current_app.serve_static_file(app.blueprint.root_path + '/static/api/', filename)
