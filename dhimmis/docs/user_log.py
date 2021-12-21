import flask
import json
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..postgres_rest_api.decorators import rest_endpoint

name = 'user-log'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder='templates')

@app.route('/log', role='admin')
@rest_endpoint
def root(cursor):
    '''
    Get a rendered log of edit actions on the database, last edits first.

    @args       count       Number of edits to load, default is 50. 0 will load
                            all edits.
    '''
    count = flask.request.args.get('count', 50, type=int)
    pg = flask.current_app.pg
    cursor.execute('''
        SELECT
            UA.id,
            UA.evidence_id,
            A.name AS action_name,
            UA.timestamp,
            U.name AS user_name,
            UA.description,
            UA.comment,
            UA.old_value
        FROM
            user_action UA
        JOIN action_type A on A.id = UA.action_type_id
        JOIN users U on U.id = UA.user_id
        ORDER BY timestamp DESC{};
    '''.format('' if count == 0 else cursor.mogrify(' LIMIT %s', (count,)).decode('utf-8')))

    def _parse(tup):
        d = tup._asdict()
        j = d['old_value']
        j = '' if j is None else json.dumps(j, indent=2)
        d['old_value'] = j
        return d

    action_log = list(map(_parse, cursor.fetchall()))
    return flask.render_template('docs/userlog.html', action_log=action_log)


@app.route('/user-log/static/<path:filename>', role='admin')
def static(filename):
    return flask.current_app.serve_static_file(app.blueprint.root_path + '/static/user-log', filename)
