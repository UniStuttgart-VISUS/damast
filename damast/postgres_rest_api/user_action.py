import flask
import json
import datetime

from .util import NumericRangeEncoder

def add_user_action(
        cursor,
        evidence_id,
        action,
        description,
        old_value,
        ):
    auth = flask.current_app.config['auth']
    comment = '{}; {}'.format(auth.current_user().name, flask.request.headers.get('User-Agent', None))

    old_value = json.dumps(old_value, cls=NumericRangeEncoder) if old_value is not None else None

    user_id = cursor.one('select id from users where name = %(user)s;', user=auth.current_user().name)

    if user_id is None:
        flask.abort(401, 'PostgreSQL user does not exist')

    action_type_id = cursor.one('select id from action_type where name = %s;', (action,))
    if action_type_id is None:
        flask.abort(500, F'Action \'{action}\' not defined')

    timestamp = datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat()

    query = cursor.mogrify('''
        INSERT INTO user_action
            (
                evidence_id,
                action_type_id,
                user_id,
                timestamp,
                description,
                old_value,
                comment
            ) VALUES (
                %(evidence_id)s,
                %(action_type_id)s,
                %(user_id)s,
                %(timestamp)s,
                %(description)s,
                %(old_value)s,
                %(comment)s
            );

            ''', locals())
    cursor.execute(query)
