import pytest
import dhimmis
import flask
import json

def get_headers(client, username, password):
    rv = client.post('/login', data=dict(username=username, password=password))
    return {'Cookie': rv.headers['Set-Cookie']}


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
@pytest.mark.parametrize('route', ['/rest/religion-list', '/rest/religions'])
def test_method_not_allowed(client_ro, minimal_testuser, method, route):
    '''check method not allowed with login'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=route, headers=headers, method=method)

    assert rv.status_code == 405, rv.data


def _check_hierarchy_node(cursor, node):
    '''for each subtree, check parent-child relation'''
    for child in node['children']:
        assert child['parent_id'] == node['id']
        assert 1 == cursor.one('select count(*) from religion where id = %s and parent_id = %s;', (child['id'], node['id']))

        _check_hierarchy_node(cursor, child)


def test_religion_hierarchy(client_ro, minimal_testuser):
    '''test getting the trees of religions'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        route = '/rest/religions'
        rv = client_ro.get(route, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            data = json.loads(rv.data)

            assert rv.status_code == 200
            assert type(data) is list

            for node in data:
                assert None == c.one('select parent_id from religion where id = %s;', (node['id'],))
                _check_hierarchy_node(c, node)

        else:
            assert rv.status_code == 403


def test_religion_list(client_ro, minimal_testuser):
    '''test getting the list of religions'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        route = '/rest/religion-list'
        rv = client_ro.get(route, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            data = json.loads(rv.data)

            assert rv.status_code == 200
            assert type(data) is list
            assert all(map(lambda x: 'id' in x and 'name' in x, data))

            for x in data:
                assert 1 == c.one('select count(*) from religion where id = %s and name = %s;', (x['id'], x['name']))

        else:
            assert rv.status_code == 403


_nouser_routes = [
        '/rest/religion-list',
        '/rest/religions',
        ]
_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('route', _nouser_routes)
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, method):
    '''test without login'''
    rv = client_ro.open(path=route, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
