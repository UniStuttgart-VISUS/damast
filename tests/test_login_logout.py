import os
import pytest
import dhimmis
import flask
import urllib.parse
import base64
import sqlite3
from functools import namedtuple
from passlib.hash import sha256_crypt, sha512_crypt, bcrypt
from passlib.context import CryptContext

from conftest import get_headers

crypt = CryptContext(schemes=['sha256_crypt', 'sha512_crypt', 'bcrypt'], default='bcrypt')

next_location_paths = [ None, '/', '/vis/', '/docs/', '/impressum.html' ]
@pytest.fixture(params=next_location_paths)
def next_location(request):
    return request.param

def test_login_with_redirect(client_ro, testuser, next_location):
    '''Login, then goto ?next=X'''
    user, password = testuser
    next_ = urllib.parse.urlencode(dict(next=next_location)) if next_location else ''
    rv = client_ro.post(F'/login?{next_}', data=dict(username=user.name, password=password))
    assert rv.status_code == 302
    assert 'session' in rv.headers['Set-Cookie']

    endpoint = urllib.parse.urlparse(rv.location).path
    assert endpoint == (next_location or '/')


NewPassword = namedtuple('NewPassword', ['password', 'valid', 'reason'])
new_passwords = [
    NewPassword('sdc', False, b'too short'),
    NewPassword('aaaaasdssx', False, b'complexity too low'),
    NewPassword('KejbdMyGpJUJGGey9O3ZGy9NY4uxb3wg', True, None),
    NewPassword('wJBdqawhm,RBT&BKjZMx%$Jys|L3VEr', True, None)
        ]
@pytest.fixture(params=new_passwords)
def new_password(request):
    return request.param

def test_password_change(client_ro, testuser, new_password):
    '''Try to change password'''
    user, oldpassword = testuser

    try:
        get_headers(client_ro, user.name, oldpassword)

        change_dict = {
                'password': oldpassword,
                'new-password': new_password.password
                }
        rv = client_ro.post('/change-password', data=change_dict, follow_redirects=True)

        if new_password.valid:
            # check that using old password does not work
            rv = client_ro.post('/login', data=dict(username=user.name, password=oldpassword))
            assert rv.status_code == 401

            # check that using new password works
            rv = client_ro.post('/login', data=dict(username=user.name, password=new_password.password))
            assert rv.status_code == 302

            # check that new password persists
            s = sqlite3.connect(os.environ['DHIMMIS_USER_FILE'])
            c = s.cursor()
            c.execute('SELECT password FROM users WHERE id = ?;', (user.name,))
            (newhash,) = c.fetchone()
            assert crypt.verify(new_password.password, newhash)

        else:
            print(rv.data)
            assert new_password.reason in rv.data

    finally:
        # reset password
        c = flask.current_app.user_db
        cr = c.cursor()
        cr.execute('UPDATE users SET password = ? WHERE id = ?;', (oldpassword, user.name))
        c.commit()


def test_logout_with_user(client_ro, testuser):
    '''Login, then log out'''
    user, password = testuser
    get_headers(client_ro, user.name, password)
    rv = client_ro.post('/logout')
    assert rv.status_code == 302


def test_logout_without_user(client_ro):
    '''No logout if not logged in'''
    rv = client_ro.post('/logout')
    assert rv.status_code == 401


def test_access_with_invalid_session(client_ro):
    '''Generate an invalid session token'''
    sessiondata = b'''
    This is highly invalid session data. It should not be able to authenticate me. In fact, this should fail pretty spectacularly.
    '''
    client_ro.set_cookie('', 'session', '{}; location=/; HttpOnly'.format(base64.b64encode(sessiondata).decode('utf-8')))
    rv = client_ro.get('/vis/')

    assert rv.status_code == 401
