import pytest
import damast

nologin_paths = [
    '/login',
    '/impressum.html',
    '/datenschutz.html',
    '/static/public/dsgvo.css',
    '/static/public/base.css',
    '/static/public/40x.css',
    '/static/public/favicon.png'
        ]

login_paths = [
    '/change-password',  # only page that is safe to assume is only available to all logged-in users
        ]

def login(client_ro, username, password):
    client_ro.set_cookie('', 'cookieConsent', 'all')
    return client_ro.post('/login', data=dict(username=username, password=password), follow_redirects=True)


@pytest.fixture(params=nologin_paths)
def nologin_path(request):
    return request.param


@pytest.fixture(params=login_paths)
def login_path(request):
    return request.param


def test_login_without_user_fails(client_ro, login_path):
    rv = client_ro.get(login_path)
    assert rv.status_code == 401


def test_login_with_user_succeeds(client_ro, login_path, testuser):
    user,password = testuser
    # login
    r1 = login(client_ro, user.name, password)

    # test page
    r2 = client_ro.get(login_path)
    assert r2.status_code == 200


def test_nologin_with_user_succeeds(client_ro, nologin_path, testuser):
    user,password = testuser
    # login
    r1 = login(client_ro, user.name, password)

    # test page
    r2 = client_ro.get(nologin_path)
    assert r2.status_code == 200


def test_nologin(client_ro, nologin_path):
    rv = client_ro.get(nologin_path)
    assert rv.status_code == 200

