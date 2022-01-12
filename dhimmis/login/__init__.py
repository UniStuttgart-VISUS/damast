import flask
import logging
import datetime
import password_strength
from passlib.hash import sha256_crypt, sha512_crypt, bcrypt
from passlib.context import CryptContext
import jwt
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator

policy = password_strength.PasswordPolicy.from_names(
    length=10,
    entropybits=30
        )

token_expiry_hours = 12

app = AuthenticatedBlueprintPreparator('login', __name__, template_folder='templates/login')
error_log = logging.getLogger('flask.error')

crypt = CryptContext(schemes=['sha256_crypt', 'sha512_crypt', 'bcrypt'], default='bcrypt')

@app.route('/login.css')
def login_css():
    return flask.current_app.serve_static_file(__path__[0] + '/static', 'login.css')

@app.route('/login', methods=['GET'], optional=True)
def login():
    return flask.render_template('login.html')

@app.route('/login', methods=['POST'])
def login_submit():
    user = flask.request.form.get('username', None)
    password = flask.request.form.get('password', None)

    with flask.current_app.auth_cursor() as c:
        c.execute('SELECT id, password, expires, roles FROM users WHERE id = ?;', (user,))
        userdata = c.fetchone()
        if userdata is not None:
            expiry = userdata[2]
            if expiry is not None:
                expires = (userdata[2] - datetime.date.today()).days
                if expires <= 0:
                    error_log.info('User %s tried to log in, account expired for %d days.', userdata[0], -expires)
                    flask.flash('User account expired, please contact administrator', 'error')
                    flask.abort(401)

            oldhash = userdata[1]
            if not crypt.verify(password, oldhash):
                error_log.warning(F'User account {user} failed to authenticate.')
                flask.flash('Wrong username or password', 'error')
                flask.abort(401)

        else:
            error_log.warning(F'User account {user} failed to authenticate.')
            flask.flash('Wrong username or password', 'error')
            flask.abort(401)

    error_log.info(F'User {user} logged in.')
    flask.flash('Login successful.', 'success')
    generate_session_token(user, expiry)
    resp = flask.redirect(flask.request.args.get('next',
        flask.url_for('root-app.root')), 302)

    return resp

@app.route('/logout', methods=['POST'], login=True)
def logout():
    auth = flask.current_app.auth
    if auth.current_user().visitor:
        flask.abort(401)

    error_log.info(F'User {auth.current_user().name} logged out.')
    flask.flash('Logged out.', 'success')
    resp = flask.redirect(flask.request.args.get('next', flask.url_for('login.login')), 302)
    auth.clear_token()
    return resp

@app.route('/change-password', login=True)
def change_password():
    if flask.current_app.auth.current_user().visitor:
        flask.abort(401)

    return flask.render_template('password-change.html')


@app.route('/change-password', methods=['POST'], login=True)
def change_password_post():
    auth = flask.current_app.auth

    if auth.current_user() is None or auth.current_user().visitor:
        flask.abort(401)

    oldpassword = flask.request.form.get('password', None)
    newpassword = flask.request.form.get('new-password', None)

    username = auth.current_user().name

    with flask.current_app.auth_cursor() as c:
        c.execute('SELECT password FROM users WHERE id = ?;', (username,))
        (oldhash,) = c.fetchone()

        if crypt.verify(oldpassword, oldhash):
            res = policy.test(newpassword)
            if res:
                reasons = []
                for r in res:
                    if type(r) is password_strength.tests.Length:
                        reasons.append(F'too short (minimum length {r.length} characters)')
                    elif type(r) is password_strength.tests.EntropyBits:
                        reasons.append('complexity too low')
                msg = F'New password unacceptable: {", ".join(reasons)}.'
                flask.flash(msg, 'error')
                return flask.redirect(flask.url_for('login.change_password', _method='GET'))

            newhash = bcrypt.hash(newpassword)
            c.execute('UPDATE users SET password = ? WHERE id = ?;', (newhash, username))
            flask.current_app.user_db.commit()
            generate_session_token(username, None)

            error_log.info(F'User {username} changed their password.')
            flask.flash('Password changed successfully.', 'success')

            return flask.redirect(flask.url_for('login.change_password', _method='GET'))

        else:
            flask.flash('Old password incorrect.', 'error')
            return flask.redirect(flask.url_for('login.change_password', _method='GET'))

def generate_session_token(username, expiry=None):
    if expiry is not None:
        expiry = datetime.datetime.combine(expiry, datetime.time()).astimezone()
    now = datetime.datetime.now().astimezone()
    exp = now + datetime.timedelta(hours=token_expiry_hours)
    if expiry is not None:
        exp = min(exp, expiry)

    payload = dict(role=username, iat=now.timestamp(), exp=exp.timestamp())

    encoded_jwt = jwt.encode(payload, flask.current_app.config['jwt_secret'], algorithm='HS256')

    error_log.info(F'Generate new session token for user {username}.')

    @flask.after_this_request
    def append_auth(response):
        auth = flask.current_app.auth

        auth.set_token(encoded_jwt)
        return response
