import flask
import os
import datetime
import subprocess
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..config import get_config

name = 'dump'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)

@app.route('/', role='user')
def dump():
    '''
    Get a database dump of the PostgreSQL database.

    @returns application/sql

    This dumps the database and returns the SQL. If the user requesting it is
    an administrator, the entire database is dumped, including the user and
    provenance tables.
    '''
    if flask.current_app.auth.current_user().visitor:
        raise werkzeug.exceptions.Unauthorized()

    conf = get_config()

    environ = os.environ.copy()
    environ['PGHOST'] = 'localhost'
    environ['PGPORT'] = str(conf.pgport)
    environ['PGUSER'] = 'ro_dump'
    environ['PGPASSWORD'] = 'dump'
    environ['PGDATABASE'] = 'testing' if flask.current_app.config.get('TESTING', False) else 'ocn'

    command = [
        'nice', '--adjustment=5',
        'pg_dump',
        '--format=plain',
        '--no-password'
            ]

    if 'admin' in flask.current_app.auth.current_user().roles:
        command += [
            '--clean',
            '--create',
                ]
    else:
        command += [
                '--exclude-table', 'public.action_type(|_id_seq)',
                '--exclude-table', 'public.user_action(|_id_seq)',
                '--exclude-table', 'public.users(|_id_seq)',
                '--data-only'
                ]

    result = subprocess.check_output(command, env=environ, stderr=subprocess.DEVNULL)

    fname=datetime.datetime.now().astimezone().strftime('damast_pgdump_%Y%m%dT%H%M%S.sql')
    response = flask.make_response((result, 200, {
        'Content-Type': 'application/sql',
        'Content-Disposition': F'attachment; filename="{fname}"',
        'Content-Length': len(result)
        }))

    response.headers['Content-Length'] = len(response.data)

    return response
