import flask
import os
import datetime
import subprocess
import werkzeug.exceptions
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

name = 'dump'
app = AuthenticatedBlueprintPreparator(name, __name__, template_folder=None)

@app.route('/', role='user')
def dump():
    if flask.current_app.auth.current_user().visitor:
        raise werkzeug.exceptions.Unauthorized()

    if not flask.request.accept_encodings.best_match('identity'):
        raise werkzeug.exceptions.NotAcceptable('Endpoint only provides identity encoding.')

    environ = os.environ.copy()
    environ['PGHOST'] = 'localhost'
    environ['PGPORT'] = os.environ.get('PGPORT', '5432')
    environ['PGUSER'] = 'ro_dump'
    environ['PGPASSWORD'] = 'dump'
    environ['PGDATABASE'] = os.environ.get('PGDATABASE', 'testing' if flask.current_app.config.get('testing', False) else 'ocn')

    command = [
        'nice', '--adjustment=5',
        'pg_dump',
        '--format=plain',
        '--compress=9',
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

    fname=datetime.datetime.now().astimezone().strftime('dhimmis_pgdump_%Y%m%dT%H%M%S.sql.gz')
    response = flask.make_response((result, 200, {
        'Content-Type': 'application/gzip',
        'Content-Disposition': F'attachment; filename="{fname}"',
        'Content-Length': len(result)
        }))

    response.headers['Content-Length'] = len(response.data)

    return response
