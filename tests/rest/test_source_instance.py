import pytest
import re
import damast
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from damast.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import evidence_table, source_instance_table


Target = namedtuple('Target', ['id', 'exists', 'data'])
_targets = []
for si in source_instance_table:
    _targets.append(Target(si.id, True, si))

for id_ in (0, 216, 831):
    _targets.append(Target(id_, False, None))


@pytest.fixture(params=_targets)
def target(request):
    return request.param


@pytest.fixture
def url(target):
    return F'/rest/source-instance/{target.id}'


def test_get(client_ro, minimal_testuser, ro_headers, target, url):
    '''test GET source instance'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if target.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is dict

            for k, v in target.data._asdict().items():
                assert k in data
                assert data[k] == v

        else:
            assert rv.status_code == 404

    else:
        assert rv.status_code == 403


Put = namedtuple('Put', ['data', 'valid', 'success', 'status_code'])
_put_data = [
        Put(dict(evidence_id=12, source_id=4), True, True, 201),
        Put(dict(evidence_id=1, source_id=1, comment='testcomment'), True, True, 201),
        Put(dict(evidence_id=14, source_id=7, comment='testcomment', source_page='20--24'), True, True, 201),
        Put(dict(evidence_id=29, source_id=23, source_confidence='certain', comment='test'), True, True, 201),
        Put(dict(evidence_id=16, source_id=25, comment=None, source_confidence='false'), True, True, 201),

        Put(dict(evidence_id=161, source_id=25, comment=None, source_confidence='false'), True, False, 409),  # evidence does not exist
        Put(dict(evidence_id=1, source_id=51, source_confidence='contested', source_page='17'), True, False, 409),  # source does not exist
        Put(dict(evidence_id=12352, source_id=51, source_confidence='contested', source_page='17'), True, False, 409),  # source and evidence do not exist

        Put(dict(source_id=25, source_confidence='contested', source_page='181a'), True, False, 422),  # no evidence id
        Put(dict(evidence_id=12, comment='test'), True, False, 422),  # no source id
        Put(dict(comment='test', source_page='12'), True, False, 422),  # neither source nor evidence id
        Put(dict(evidence_id=29, source_id=23, source_page=16, foo='bar'), True, False, 422),  # illegal property
        Put(dict(evidence_id=29, source_id=23, source_page=16, non_valid=1), True, False, 422),  # illegal property

        Put(dict(), True, False, 422),  # empty dict
        Put(b'', False, False, 400),
        Put(b'12', False, False, 400),
        Put(b'\xf7eersdfsd\x00', False, False, 400),
        ]

@pytest.fixture(params=_put_data)
def put(request):
    return request.param


@pytest.fixture
def put_url():
    return '/rest/source-instance/0'


def test_put(client, minimal_testuser, headers, cursor, put, put_url):
    '''test PUT source instance'''
    user, _ = minimal_testuser

    if put.valid:
        d = json.dumps(put.data)
        headers['Content-Type'] = 'application/json'
    else:
        d = put.data

    query = 'select * from source_instance order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    rv = client.put(put_url, headers=headers, data=d)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == put.status_code, rv.data

        if put.success:
            ret = json.loads(rv.data)
            assert type(ret) == dict
            assert 'source_instance_id' in ret
            assert ret['source_instance_id'] == len(source_instance_table) + 1
            assert new != old

            new_data = cursor.one('select * from source_instance where id = %s;', (ret['source_instance_id'],))
            for k, v in put.data.items():
                assert new_data._asdict()[k] == v

        else:
            assert old == new

    else:
        assert rv.status_code == 403
        assert old == new


Patch = namedtuple('Patch', ['data', 'valid', 'success', 'status_code'])
_patch_data = [
        Patch(dict(comment='new comment'), True, True, 205),
        Patch(dict(comment=None, source_page='12-12a'), True, True, 205),
        Patch(dict(source_confidence='certain'), True, True, 205),
        Patch(dict(source_confidence=None, source_page=None), True, True, 205),
        Patch(dict(source_confidence='contested', source_id=12), True, True, 205),

        Patch(dict(comment='new comment 1', evidence_table=12), True, False, 422),
        Patch(dict(), True, False, 422),
        Patch(dict(misc_value=4.2211, source_page='12'), True, False, 422),

        Patch(dict(source_id=409), True, False, 409),

        Patch(dict(source_confidence=409, comment='12'), True, False, 400),  # source_confidence should be string
        Patch(b'', False, False, 400),
        Patch(b'12', False, False, 400),
        Patch(b'\xf7eersdfsd\x00', False, False, 400),
        ]

@pytest.fixture(params=_patch_data)
def patch(request):
    return request.param


_patch_targets = []
for si in [
        source_instance_table[0],
        source_instance_table[1],
        source_instance_table[4],
        source_instance_table[12],
        source_instance_table[21],
        source_instance_table[24],
        source_instance_table[33],
        ]:
    _patch_targets.append(Target(si.id, True, si))
for id_ in (0, 216, 831):
    _patch_targets.append(Target(id_, False, None))

@pytest.fixture(params=_patch_targets)
def patch_target(request):
    return request.param


@pytest.fixture
def patch_url(patch_target):
    return F'/rest/source-instance/{patch_target.id}'


def test_patch(client, minimal_testuser, headers, cursor, patch, patch_url, patch_target):
    '''test PATCH source instance'''
    user, _ = minimal_testuser

    if patch.valid:
        d = json.dumps(patch.data)
        headers['Content-Type'] = 'application/json'
    else:
        d = patch.data

    query = 'select * from source_instance order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    rv = client.patch(patch_url, headers=headers, data=d)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if patch_target.exists:
            assert rv.status_code == patch.status_code, rv.data

            if patch.success:
                assert new != old

                new_data = cursor.one('select * from source_instance where id = %s;', (patch_target.id,))
                for k, v in patch.data.items():
                    assert new_data._asdict()[k] == v

            else:
                assert old == new

        else:
            assert old == new
            assert rv.status_code == 404

    else:
        assert rv.status_code == 403
        assert old == new


def test_delete(client, minimal_testuser, headers, cursor, target, url):
    '''test DELETE source instance'''
    user, _ = minimal_testuser

    query = 'select * from source_instance order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    rv = client.delete(url, headers=headers)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if target.exists:
            assert rv.status_code == 200, rv.data
            assert 0 == cursor.one('select count(*) from source_instance where id = %s;', (target.id,))

        else:
            assert old == new
            assert rv.status_code == 404, rv.data

    else:
        assert rv.status_code == 403, rv.data
        assert old == new



@pytest.fixture(params=[0, 2, 12, 16, 1, 25, 325, 64530])
def minimal_url(request):
    return F'/rest/source-instance/{request.param}'


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT'])
def test_method_not_allowed(client_ro, minimal_testuser, method, ro_headers, minimal_url):
    '''check method not allowed with login'''
    rv = client_ro.open(path=minimal_url, headers=ro_headers, method=method)

    assert rv.status_code == 405, rv.data


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, minimal_url, method):
    '''test without login'''
    rv = client_ro.open(path=minimal_url, method=method)
    if method not in ('GET', 'HEAD', 'DELETE', 'PUT', 'PATCH'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
