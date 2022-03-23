import pytest
import re
import damast
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from damast.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import uri_namespace_table, external_database_table, external_place_uri_table

Get = namedtuple('Get', ['id', 'exists', 'datum'])
_get_targets = []
for t in external_place_uri_table:
    _get_targets.append(Get(t.id, True, t))
for id_ in (0, 404, 261234):
    _get_targets.append(Get(id_, False, None))

@pytest.fixture(params=_get_targets)
def get_target(request):
    return request.param


@pytest.fixture
def get_url(get_target):
    return F'/rest/uri/external-place-uri/{get_target.id}'


def test_get(client_ro, minimal_testuser, ro_headers, get_target, get_url):
    '''test GET place URI'''
    user, _ = minimal_testuser

    rv = client_ro.get(get_url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if get_target.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is dict

            d = get_target.datum

            assert data['id'] == d.id
            assert data['place_id'] == d.place_id
            assert data['uri_namespace_id'] == d.uri_namespace_id
            assert data['uri_fragment'] == d.uri_fragment
            assert data['comment'] == d.comment
        else:
            assert rv.status_code == 404, rv.data

    else:
        assert rv.status_code == 403, rv.data


Put = namedtuple('Put', ['data', 'valid', 'success', 'return_code'])
_put_targets = [
        Put(dict(place_id=12, uri_namespace_id=1, uri_fragment='1234'), True, True, 201),
        Put(dict(place_id=11, uri_namespace_id=3, uri_fragment='1234', comment=None), True, True, 201),
        Put(dict(place_id=4, uri_namespace_id=4, uri_fragment='https://www.uris.org/uri-13245', comment='foo'), True, True, 201),

        Put(dict(place_id=16, uri_fragment='1234'), True, False, 400),   # no URI namespace ID
        Put(dict(place_id='string', uri_namespace_id=2, uri_fragment='1234'), True, False, 422),   # place_id is string
        Put(dict(uri_namespace_id=2, uri_fragment='124'), True, False, 400),   # no place_id
        Put(dict(uri_namespace_id=2, place_id=1), True, False, 400),   # no uri_fragment
        Put(dict(place_id=11, uri_namespace_id=3, uri_fragment='1234', comment=None, garbage_content='foo'), True, False, 400),  # invalid data key passed
        Put(dict(place_id=2016, uri_namespace_id=1, uri_fragment='1234'), True, False, 409),   # place does not exist
        Put(dict(place_id=1, uri_namespace_id=7, uri_fragment='1234'), True, False, 409),   # URI namespace does not exist

        Put(dict(), True, False, 400),   # empty payload, but valid JSON
        Put('', False, False, 415),   # empty payload
        Put(b'\u03942akasd', False, False, 415),   # invalid payload
        ]

@pytest.fixture(params=_put_targets)
def put_target(request):
    return request.param


@pytest.fixture
def put_url():
    return '/rest/uri/external-place-uri/0'


def test_put(client, minimal_testuser, headers, cursor, put_target, put_url):
    '''test PUT place URI'''
    user, _ = minimal_testuser

    hdr = dict(**headers)
    data = put_target.data
    if put_target.valid:
        hdr['Content-Type'] = 'application/json'
        data = json.dumps(data)

    old_count = cursor.one('SELECT count(*) FROM external_place_uri;')
    rv = client.put(put_url, headers=hdr, data=data)
    new_count = cursor.one('SELECT count(*) FROM external_place_uri;')

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == put_target.return_code, rv.data

        if put_target.success:
            ret = json.loads(rv.data)
            assert type(ret) is dict
            assert 'external_place_uri_id' in ret

            assert new_count == old_count + 1

            new_tuple = cursor.one('SELECT * FROM external_place_uri WHERE id = %s;', (ret['external_place_uri_id'],))._asdict()
            for k, v in put_target.data.items():
                assert new_tuple[k] == v

        else:
            assert new_count == old_count

    else:
        assert rv.status_code == 403, rv.data


Delete = namedtuple('Delete', ['id', 'exists'])
_delete_targets = []
for t in external_place_uri_table:
    _delete_targets.append(Delete(t.id, True))
for t in [0, 505, 2343777]:
    _delete_targets.append(Delete(t, False))

@pytest.fixture(params=_delete_targets)
def delete_target(request):
    return request.param


@pytest.fixture
def delete_url(delete_target):
    return F'/rest/uri/external-place-uri/{delete_target.id}'


def test_delete(client, minimal_testuser, headers, cursor, delete_target, delete_url):
    '''test DELETE place URI'''
    user, _ = minimal_testuser

    old_count = cursor.one('SELECT count(*) FROM external_place_uri;')
    rv = client.delete(delete_url, headers=headers)
    new_count = cursor.one('SELECT count(*) FROM external_place_uri;')

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if delete_target.exists:
            assert rv.status_code == 200, rv.data

            ret = json.loads(rv.data)
            assert type(ret) is dict
            assert 'deleted' in ret
            assert 'external_place_uri' in ret['deleted']
            assert ret['deleted']['external_place_uri'] == delete_target.id

            assert new_count == old_count - 1
            assert 0 == cursor.one('SELECT COUNT(*) FROM external_place_uri WHERE id = %s;', (delete_target.id,))

        else:
            assert rv.status_code == 404, rv.data
            assert new_count == old_count

    else:
        assert rv.status_code == 403, rv.data


Patch = namedtuple('Patch', ['data', 'valid', 'success', 'return_code'])
_patch_data = [
    Patch(dict(place_id=12), True, True, 205),
    Patch(dict(place_id=4, uri_fragment='12'), True, True, 205),
    Patch(dict(uri_fragment='xfxc'), True, True, 205),
    Patch(dict(uri_namespace_id=3, comment=None), True, True, 205),
    Patch(dict(comment='foo'), True, True, 205),

    Patch(dict(place_id=23456, comment='hey'), True, False, 409),  # place_id does not exist
    Patch(dict(uri_namespace_id=31), True, False, 409),              # uri namespace does not exist
    Patch(dict(uri_namespace_id='hello'), True, False, 422),              # datatype mismatch
    Patch(dict(comment='aii', garbage_xxwetert='invalid property'), True, False, 400),  # invalid key

    Patch(dict(), True, False, 400),  # no valid updatable fields
    Patch('', False, False, 415),  # no JSON
    Patch(b'foo bar', False, False, 415),  # no JSON
        ]

@pytest.fixture(params=_patch_data)
def patch_data(request):
    return request.param


PatchTarget = namedtuple('PatchTarget', ['id', 'exists'])
_patch_targets = [
        PatchTarget(1, True),
        PatchTarget(4, True),
        PatchTarget(404, False)
        ]

@pytest.fixture(params=_patch_targets)
def patch_target(request):
    return request.param


@pytest.fixture
def patch_url(patch_target):
    return F'/rest/uri/external-place-uri/{patch_target.id}'


def test_patch(client, minimal_testuser, headers, cursor, patch_target, patch_url, patch_data):
    '''test PATCH place URI'''
    user, _ = minimal_testuser

    hdr = dict(**headers)
    data = patch_data.data
    if patch_data.valid:
        hdr['Content-Type'] = 'application/json'
        data = json.dumps(data)

    if patch_target.exists:
        old_data = cursor.one('SELECT * FROM external_place_uri WHERE id = %s;', (patch_target.id,))._asdict()
    else:
        cursor.execute('SELECT * FROM external_place_uri;')
        old_data = {
            x._asdict()['id']: x._asdict() for x in cursor.fetchall()
                }
    rv = client.patch(patch_url, headers=hdr, data=data)
    if patch_target.exists:
        new_data = cursor.one('SELECT * FROM external_place_uri WHERE id = %s;', (patch_target.id,))._asdict()
    else:
        cursor.execute('SELECT * FROM external_place_uri;')
        new_data = {
            x._asdict()['id']: x._asdict() for x in cursor.fetchall()
                }

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if patch_target.exists:
            assert rv.status_code == patch_data.return_code, rv.data

            if patch_data.success:
                data = dict(**old_data)
                data.update(patch_data.data)

                new_str = json.dumps(new_data, sort_keys=True)
                simulated = json.dumps(data, sort_keys=True)

                assert simulated == new_str

        else:
            assert rv.status_code == 404, rv.data

            new_str = json.dumps(new_data, sort_keys=True)
            old_str = json.dumps(old_data, sort_keys=True)

            assert new_str == old_str

    else:
        assert rv.status_code == 403, rv.data


_nouser_methods = [
        ('GET', None),
        ('POST', '{}'),
        ('PATCH', '{}'),
        ('PUT', '{}'),
        ('DELETE', None),
        ('TRACE', None),
        ('CONNECT', None),
        ('HEAD', None) ]
@pytest.mark.parametrize('method, payload', _nouser_methods)
def test_nouser(client_ro, get_url, method, payload):
    '''test without login'''

    kwargs = dict()
    if payload is not None:
        kwargs = dict(headers={'Content-Type': 'application/json'}, data=payload)

    rv = client_ro.open(path=get_url, method=method, **kwargs)
    if method not in ('GET', 'HEAD', 'PATCH', 'PUT', 'DELETE'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401


_disallowed_methods = [ 'POST', 'TRACE', 'CONNECT' ]
@pytest.mark.parametrize('method', _disallowed_methods)
def test_method_not_allowed(client_ro, get_url, method, ro_headers):
    '''test method not allowed'''
    rv = client_ro.open(path=get_url, method=method, headers=ro_headers)
    assert rv.status_code == 405
