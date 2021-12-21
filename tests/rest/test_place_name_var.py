import pytest
import dhimmis
import flask
import json
import urllib.parse
from functools import namedtuple

def get_headers(client, username, password):
    rv = client.post('/login', data=dict(username=username, password=password))
    return {'Cookie': rv.headers['Set-Cookie']}


_match_data = [
    ('^u', True, (1, 2, 3, 15)),
    ('^u', False, (3, 15)),
    ('z', True, (1, 16)),
    ('Unique', True, (1, 2, 3, 15)),
    ('Unique', False, (1, 2)),
    ('ra', True, (2, 3, 4, 7, 15)),
    ('ra', False, (4, 7, 15)),
    ('^ra', True, (2, 3, 4)),
    ('t$', True, (5, 6, 17)),
    ('t$', False, (5, 17)),
    ('\\d', True, (1, 2, 3, 6, 7, 16)),
    ('^.{3}$', True, (6, 7)),
    ('^s', True, (4, 16)),
    ('no match anywhere', True, tuple()),
    ('\\yt', False, (3, 5, 15, 17)),
    ('t\\y', False, (3, 5, 8, 17)),
    ('برقة', True, (18,)),
    ('ka\\y', True, (18,)),
    ('Barca', True, (18,)),
    ('برقة', True, (18,)),
    ('قة', True, (18,)),
    ('برق', True, (18,)),
    ]

# add queries with unset ignore_case
_m2 = []
for regex, ignore_case, ids in _match_data:
    if not ignore_case:
        _m2.append((regex, None, ids))
_match_data += _m2


@pytest.fixture
def name_var_regex_url():
    return '/rest/find-alternative-names'


@pytest.mark.parametrize('regex, ignore_case, matches', _match_data)
def test_get_place_name_var_by_regex(client_ro, minimal_testuser, name_var_regex_url, regex, ignore_case, matches):
    '''test finding alternative names by regex'''
    user,password = minimal_testuser

    payload = dict(regex=regex)
    if ignore_case is not None:
        payload['ignore_case'] = ignore_case

    headers = get_headers(client_ro, user.name, password)
    headers['Content-Type'] = 'application/json'

    rv = client_ro.post(path=name_var_regex_url, headers=headers, data=json.dumps(payload))

    if 'user' in user.roles and 'readdb' in user.roles:
        ids = json.loads(rv.data)
        assert type(ids) == list
        assert len(ids) == len(matches), rv.data
        assert all(map(lambda x: x in matches, ids))
        assert all(map(lambda x: x in ids, matches))

    else:
        assert rv.status_code == 403


@pytest.mark.parametrize('method', ['GET', 'DELETE', 'PATCH', 'TRACE', 'HEAD', 'CONNECT'])
def test_get_place_name_var_by_regex_method_not_allowed(client_ro, minimal_testuser, method, name_var_regex_url):
    '''test 404, 405 on alternative names by regex'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=name_var_regex_url, method=method, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code in (404,405)

    else:
        assert rv.status_code in (403,405)


@pytest.mark.parametrize('place_id, place_exists', list(map(lambda x: (x, x <= 26), range(1, 32))))
def test_get_all_name_var(client_ro, minimal_testuser, place_id, place_exists):
    '''test getting a list of alternative names for a place'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        alt_names = []
        c.execute(c.mogrify('select id, name from name_var where place_id = %s;', (place_id, )))
        for result in c.fetchall():
            alt_names.append(result)

        url = F'/rest/place/{place_id}/alternative-name/all'

        headers = get_headers(client_ro, user.name, password)


        rv = client_ro.get(url, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            data = json.loads(rv.data)
            assert type(data) == list
            assert len(data) == len(alt_names)
            assert all(map(lambda x: any(map(lambda y: x['name'] == y.name, alt_names)), data))
            assert all(map(lambda x: any(map(lambda y: y['name'] == x.name, data)), alt_names))

        else:
            assert rv.status_code == 403

#
## @app.route('/place/<int:place_id>/alternative-name/<int:name_id>', methods=['GET', 'PUT', 'PATCH', 'DELETE'], role='user')
#
_get_requests = [
    (1, 1, 200, True),
    (4, 8, 200, True),
    (7, 13, 200, True),
    (4, 4, 404, False),       # name_var exists but not for this place_id
    (1, 13, 404, False),       # name_var exists but not for this place_id
    (1, 324, 404, False),       # name_var does not exist
    (7, 44, 404, False),       # name_var does not exist
    (431, 1, 404, False),       # place_id does not exist
    (2341, 6, 404, False),       # place_id does not exist
    (21, 61, 404, False),       # neither place_id nor place_id exist
    (411, 1155, 404, False),       # neither place_id nor place_id exist
        ]
@pytest.mark.parametrize('place_id, name_id, status_code, success', _get_requests)
def test_get_name_var(client_ro, minimal_testuser, place_id, name_id, status_code, success):
    '''test getting one alternative name'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        url = F'/rest/place/{place_id}/alternative-name/{name_id}'

        headers = get_headers(client_ro, user.name, password)

        rv = client_ro.get(url, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            assert rv.status_code == status_code, rv.data
            if success:
                assert 'application/json' in rv.headers['Content-Type']

                data = json.loads(rv.data)
                assert data['id'] == name_id
                assert data['language_id'] == (name_id if name_id < 8 else name_id - 7)
                assert data['place_id'] == place_id

                name_entry = c.one('select name from name_var where id = %s;', (name_id,))
                assert name_entry == data['name']

        else:
            assert rv.status_code == 403


_delete_data = []
for pid, nid, retval, success in _get_requests:
    _delete_data.append((pid, nid, retval, success))
@pytest.mark.parametrize('place_id, name_id, status_code, success', _delete_data)
def test_delete_name_var(client, minimal_testuser, place_id, name_id, status_code, success):
    '''test deleting one alternative name'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(autocommit=True) as c:
        url = F'/rest/place/{place_id}/alternative-name/{name_id}'

        oldlength = c.one('select count(*) from name_var;')

        headers = get_headers(client, user.name, password)

        rv = client.delete(url, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            assert rv.status_code == status_code, rv.data
            if success:
                assert 'application/json' in rv.headers['Content-Type']

                data = json.loads(rv.data)
                assert data['deleted']['name_var'] == name_id
                assert c.one('select count(*) from name_var;') == oldlength - 1
            else:
                assert c.one('select count(*) from name_var;') == oldlength

        else:
            assert rv.status_code == 403


@pytest.mark.parametrize('place_id, name_id, status_code, success', _delete_data)
def test_delete_name_var_nouser(client_ro, place_id, name_id, status_code, success):
    '''test deleting one alternative name without user'''
    with flask.current_app.pg.get_cursor(readonly=True) as c:
        url = F'/rest/place/{place_id}/alternative-name/{name_id}'

        oldlength = c.one('select count(*) from name_var;')

        rv = client_ro.delete(url)

        assert rv.status_code == 401
        assert c.one('select count(*) from name_var;') == oldlength


PUT = namedtuple('PutData', ['place_id', 'data', 'valid', 'success', 'status_code'])
_putdata = [
    PUT(1, dict(name='Testname 1 (alt)', simplified='alt_testname_1', transcription='alttestname1', language_id=5, comment='comment number 1'), True, True, 201),
    PUT(1, dict(name='الإسكندرية', transcription='al-ʾIskandariyya', simplified='al-iskandariyya', language_id=1), True, True, 201),
    PUT(1, dict(name='Αλεξάνδρεια', transcription='Alexandria', simplified='Alexandria', language_id=345), True, False, 409),   # non-existent language_id
    PUT(21, dict(name='Αλεξάνδρεια', transcription='Alexandria', simplified='Alexandria'), True, False, 400),   # no language_id
    PUT(21, dict(name='', transcription='<empty>', language_id=3), True, False, 400),   # empty place
    PUT(12, dict(name='sdfsd', transcription='<empty>', language_id=3, main_form=False), True, True, 201),   # empty place
    PUT(12, b'', False, False, 400),   # no JSON
    PUT(12, b'ksdfjksd sdjfk dsjmfsd', False, False, 400),   # no JSON
    PUT(1006, dict(name='asdkl', simplified='alt', transcription='alt', language_id=5, main_form=False), True, False, 409),     # non-existent place
    ]
@pytest.mark.parametrize('datum', _putdata)
def test_put_name_var(client, minimal_testuser, datum):
    '''test creating one alternative name'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(autocommit=True) as c:
        url = F'/rest/place/{datum.place_id}/alternative-name/0'

        oldlength = c.one('select count(*) from name_var;')

        headers = get_headers(client, user.name, password)
        if datum.valid:
            headers['Content-Type'] = 'application/json'

        data = json.dumps(datum.data) if datum.valid else datum.data

        rv = client.put(url, headers=headers, data=data)

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            assert rv.status_code == datum.status_code, rv.data
            if datum.success:
                assert c.one('select count(*) from name_var;') == oldlength + 1
            else:
                assert c.one('select count(*) from name_var;') == oldlength

        else:
            assert rv.status_code == 403


@pytest.mark.parametrize('datum', _putdata)
def test_put_name_var_nouser(client_ro, datum):
    '''test putting one alternative name without user'''
    with flask.current_app.pg.get_cursor(readonly=True) as c:
        url = F'/rest/place/{datum.place_id}/alternative-name/0'

        oldlength = c.one('select count(*) from name_var;')

        headers = dict()
        if datum.valid:
            headers['Content-Type'] = 'application/json'

        data = json.dumps(datum.data) if datum.valid else datum.data

        rv = client_ro.put(url, headers=headers, data=data)

        assert rv.status_code == 401
        assert c.one('select count(*) from name_var;') == oldlength


PATCH = namedtuple('PatchData', ['name_id', 'place_id', 'data', 'valid', 'success', 'status_code'])
_patchdata = [
    PATCH(1, 1, dict(name='New testname 1'), True, True, 205),
    PATCH(1, 1, dict(simplified='new_testname_1'), True, True, 205),
    PATCH(3, 2, dict(transcription='newtestname1'), True, True, 205),
    PATCH(3, 2, dict(main_form=True), True, True, 205),
    PATCH(5, 3, dict(language_id=6,), True, True, 205),
    PATCH(13, 7, dict(comment='change comment'), True, True, 205),
    PATCH(14, 8, dict(comment=None), True, True, 205),
    PATCH(6, 3, dict(name='Other name', simplified=None, transcription='other name', language_id=2, comment='change comment again'), True, True, 205),
    PATCH(6, 3, dict(name='', simplified=None, transcription='other name', language_id=2, comment='change comment again'), True, False, 400),           # name empty
    PATCH(8, 4, dict(name=None, language_id=4), True, False, 409),   # name empty
    PATCH(8, 1, dict(name='deedee'), True, False, 404),   # place and name_var tuples not related
    PATCH(6799, 4, dict(main_form=False), True, False, 404),   # name_var tuple does not exist
    PATCH(6, 555, dict(name='as sdfsdf ew '), True, False, 404),   # place tuple does not exist
    PATCH(7, 3, dict(), True, False, 400),   # empty data
    PATCH(13, 7, b'Garbage content is not\x00JSON', False, False, 400),   # invalid data
    PATCH(12, 7, b'', False, False, 400),   # empty data
    ]
@pytest.mark.parametrize('datum', _patchdata)
def test_patch_name_var(client, minimal_testuser, datum):
    '''test changing one alternative name'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(autocommit=True) as c:
        url = F'/rest/place/{datum.place_id}/alternative-name/{datum.name_id}'

        headers = get_headers(client, user.name, password)
        if datum.valid:
            headers['Content-Type'] = 'application/json'

        data = json.dumps(datum.data) if datum.valid else datum.data

        rv = client.patch(url, headers=headers, data=data)

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            assert rv.status_code == datum.status_code, rv.data

            if datum.success:
                new_place_data = c.one('select * from name_var where id=%s;', (datum.name_id,))._asdict()
                for k, v in datum.data.items():
                    assert new_place_data[k] == v

        else:
            assert rv.status_code == 403


@pytest.mark.parametrize('datum', _patchdata)
def test_patch_name_var_nouser(client_ro, datum):
    '''test patching one alternative name without user'''
    with flask.current_app.pg.get_cursor(readonly=True) as c:
        url = F'/rest/place/{datum.place_id}/alternative-name/{datum.name_id}'

        c.execute('select count(*) from name_var;')
        olddata = json.dumps(c.fetchall())

        headers = dict()
        if datum.valid:
            headers['Content-Type'] = 'application/json'

        data = json.dumps(datum.data) if datum.valid else datum.data

        rv = client_ro.put(url, headers=headers, data=data)

        assert rv.status_code == 401

        c.execute('select count(*) from name_var;')
        newdata = json.dumps(c.fetchall())
        assert olddata == newdata


_valid_combinations = [ (1, 1), (2, 1), (4, 2), (7, 3), (10, 5), (14, 8) ]
@pytest.mark.parametrize('name_id, place_id', _valid_combinations)
@pytest.mark.parametrize('method', ['POST', 'TRACE', 'HEAD', 'CONNECT'])
def test_method_not_allowed(client_ro, minimal_testuser, method, name_id, place_id):
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=F'/rest/place/{place_id}/alternative-name/{name_id}', headers=headers, method=method)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 405, rv.data
    else:
        if method == 'HEAD':
            assert rv.status_code == 403
        else:
            assert rv.status_code == 405


_nouser_routes = [
        '/rest/place/12/alternative-name/all',
        '/rest/place/41/alternative-name/all',
        '/rest/place/0/alternative-name/all',
        '/rest/place/4/alternative-name/11',
        '/rest/place/1/alternative-name/1',
        '/rest/place/7/alternative-name/5343',
        '/rest/place/23423/alternative-name/324',
        ]
_nouser_methods = [ 'GET' ]
@pytest.mark.parametrize('route', _nouser_routes)
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, method):
    rv = client_ro.open(path=route, method=method)
    assert rv.status_code == 401


def test_nouser_post(client_ro):
    rv = client_ro.post(path='/rest/find-alternative-names')
    assert rv.status_code == 401
