import pytest
import json

def get_headers(client, username, password):
    rv = client.post('/login', data=dict(username=username, password=password))
    return {'Cookie': rv.headers['Set-Cookie']}


def test_get_confidence_values(client_ro, minimal_testuser):
    '''test getting a list of valid confidence values'''
    user,password = minimal_testuser

    url = '/rest/confidence-values'

    headers = get_headers(client_ro, user.name, password)

    rv = client_ro.get(url, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        vals = json.loads(rv.data)
        assert type(vals) == list
        assert all(map(lambda x: type(x) is str, vals))

    else:
        assert rv.status_code == 403


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
def test_method_not_allowed(client_ro, minimal_testuser, method):
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path='/rest/confidence-values', headers=headers, method=method)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 405, rv.data
    else:
        assert rv.status_code == 405


@pytest.mark.parametrize('method', ['GET', 'POST', 'TRACE', 'HEAD', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
def test_nouser(client_ro, method):
    rv = client_ro.open(path='/rest/confidence-values', method=method)
    if method in ('POST', 'TRACE', 'CONNECT', 'PATCH', 'PUT', 'DELETE'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
