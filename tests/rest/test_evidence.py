import pytest
import re
import damast
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from damast.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import evidence_table, place_instance_table, place_table, place_type_table, time_instance_table, religion_instance_table


PutData = namedtuple('PutData', ['data', 'valid', 'success', 'return_code'])
_put_data = [
        PutData(dict(place_instance_id=23, religion_instance_id=25), True, True, 201),
        PutData(dict(place_instance_id=18, religion_instance_id=5), True, True, 201),
        PutData(dict(place_instance_id=13, religion_instance_id=7), True, True, 201),
        PutData(dict(place_instance_id=13, religion_instance_id=7, comment='test', person_instance_id=12), True, True, 201),
        PutData(dict(place_instance_id=13, religion_instance_id=7, time_group_id=5), True, True, 201),
        PutData(dict(place_instance_id=13, religion_instance_id=7, time_group_id=2, visible=True), True, True, 201),
        PutData(dict(place_instance_id=13, religion_instance_id=7, interpretation_confidence='certain', visible=False), True, True, 201),

        PutData(dict(religion_instance_id=7, interpretation_confidence='contested', visible=False), True, False, 400),
        PutData(dict(comment='contested', visible=False), True, False, 400),
        PutData(dict(place_instance_id=4), True, False, 400),
        PutData(dict(garbage_value='foo', place_instance_id=1, religion_instance_id=4), True, False, 400),

        PutData(dict(place_instance_id=144, religion_instance_id=4, comment='hey'), True, False, 409),
        PutData(dict(place_instance_id=14, religion_instance_id=4354, comment='hey'), True, False, 409),
        PutData(dict(place_instance_id=14, religion_instance_id=4, comment='hey', time_group_id='this is a string'), True, False, 422),

        PutData(dict(), True, False, 400),
        PutData(b'', False, False, 415),
        PutData(b'324', False, False, 415),
        PutData(b'garbage\x63\xf1value', False, False, 415),
        ]
@pytest.fixture(params=_put_data)
def put_data(request):
    return '/rest/evidence/0', request.param



def test_put_evidence(client, minimal_testuser, cursor, headers, put_data):
    '''test PUT /rest/evidence/0'''
    user, _ = minimal_testuser
    put_route, data = put_data

    if data.valid:
        payload = json.dumps(data.data)
        headers['Content-Type'] = 'application/json'
    else:
        payload = data.data

    rv = client.put(put_route, headers=headers, data=payload)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        assert rv.status_code == data.return_code, rv.data

        if data.success:
            d = json.loads(rv.data)
            assert 'evidence_id' in d
            assert d['evidence_id'] == len(evidence_table) + 1

            d2 = cursor.one('select * from evidence where id = %s;', (d['evidence_id'],))._asdict()
            assert all(map(lambda k: d2[k[0]] == k[1], data.data.items()))
            assert len(evidence_table) + 1 == cursor.one('select count(*) from evidence;')

        else:
            assert len(evidence_table) == cursor.one('select count(*) from evidence;')

    else:
        assert rv.status_code == 403


PatchData = namedtuple('PatchData', ['data', 'valid', 'success', 'return_code'])
_patch_data = [
        PatchData(dict(visible=False), True, True, 205),
        PatchData(dict(visible=True, place_instance_id=2), True, True, 205),
        PatchData(dict(comment=None, time_group_id=None), True, True, 205),
        PatchData(dict(time_group_id=10), True, True, 205),
        PatchData(dict(religion_instance_id=2), True, True, 205),
        PatchData(dict(place_instance_id=None), True, False, 409),  # place_instance_id may not be null
        PatchData(dict(place_instance_id=1, religion_instance_id=None), True, False, 409),  # religion_instance_id may not be null
        PatchData(dict(time_group_id='Foo'), True, False, 422),  # time_group_id must be number
        PatchData(dict(time_group_id=711), True, False, 409),  # time_group_id must exist
        PatchData(dict(), True, False, 400),
        PatchData(dict(nonexisting=12), True, False, 400),
        PatchData(b'', False, False, 415),
        PatchData(b'324', False, False, 415),
        PatchData(b'garbage\x63\xf1value', False, False, 415),
        ]


Target = namedtuple('Target', ['id', 'exists'])
_targets = []
for e in evidence_table:
    _targets.append(Target(e.id, True))
for n in [0, 216, 404, 21536]:
    _targets.append(Target(n, False))


@pytest.fixture(params=_patch_data)
def patch_data(request):
    return request.param


@pytest.fixture(params=_targets)
def target(request):
    return request.param


Patch = namedtuple('Patch', ['id', 'url', 'exists', 'data', 'valid', 'success', 'return_code'])

@pytest.fixture
def patch(patch_data, target):
    url = F'/rest/evidence/{target.id}'
    return Patch(target.id, url, target.exists, *patch_data)


def test_patch_evidence(client, minimal_testuser, cursor, headers, patch):
    '''test PATCH /rest/evidence/<id>'''
    user, _ = minimal_testuser

    hdr = {**headers}
    if patch.valid:
        payload = json.dumps(patch.data)
        hdr['Content-Type'] = 'application/json'
    else:
        payload = patch.data

    query = 'select * from evidence order by id asc;'
    cursor.execute(query)
    old = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    rv = client.patch(patch.url, headers=hdr, data=payload)

    cursor.execute(query)
    new = json.dumps(list(map(lambda d: d._asdict(), cursor.fetchall())), sort_keys=True)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if patch.exists:
            assert rv.status_code == patch.return_code, rv.data

            if patch.success:
                d2 = cursor.one('select * from evidence where id = %s;', (patch.id,))._asdict()
                assert all(map(lambda k: d2[k[0]] == k[1], patch.data.items()))

            else:
                assert old == new

        else:
            assert rv.status_code == 404
            assert old == new

    else:
        assert rv.status_code == 403
        assert old == new


# DELETE

@pytest.fixture(params=[False, True])
def cascade(request):
    return request.param


DeleteDependents = namedtuple('DeleteDependents', ['dependents', 'success'])

@pytest.fixture
def delete_dependents(target, cascade, cursor):
    if not target.exists:
        return DeleteDependents(None, None)

    # fill dependencies
    evidence = next(filter(lambda x: x.id == target.id, evidence_table))
    vals = dict(evidence=[target.id])

    # source instances (cascade anyways)
    # TODO
    query = cursor.mogrify('select id from source_instance where evidence_id = %s;', (target.id,))
    cursor.execute(query)
    siids = list(map(lambda x: x.id, cursor.fetchall()))
    if len(siids) > 0:
        vals['source_instance'] = siids

    if not cascade:
        return DeleteDependents(vals, True)

    success = True
    annotations = []

    if evidence.place_instance_id is not None:
        vals['place_instance'] = [evidence.place_instance_id]

        if 1 != cursor.one('select count(*) from evidence where place_instance_id = %s;', (evidence.place_instance_id,)):
            success = False

        aid = cursor.one('select annotation_id from place_instance where id = %s;', (evidence.place_instance_id,))
        if aid is not None:
            annotations.append(aid)

    if evidence.religion_instance_id is not None:
        vals['religion_instance'] = [evidence.religion_instance_id]
        if 1 != cursor.one('select count(*) from evidence where religion_instance_id = %s;', (evidence.religion_instance_id,)):
            success = False

        aid = cursor.one('select annotation_id from religion_instance where id = %s;', (evidence.religion_instance_id,))
        if aid is not None:
            annotations.append(aid)

    if evidence.person_instance_id is not None:
        vals['person_instance'] = [evidence.person_instance_id]
        if 1 != cursor.one('select count(*) from evidence where person_instance_id = %s;', (evidence.person_instance_id,)):
            success = False

        aid = cursor.one('select annotation_id from person_instance where id = %s;', (evidence.person_instance_id,))
        if aid is not None:
            annotations.append(aid)

    if evidence.time_group_id is not None:
        tiids = list(map(lambda x: x.id, filter(lambda x: x.time_group_id == evidence.time_group_id, time_instance_table)))
        if len(tiids) > 0:
            vals['time_instance'] = tiids

        vals['time_group'] = [evidence.time_group_id]
        if 1 != cursor.one('select count(*) from evidence where time_group_id = %s;', (evidence.time_group_id,)):
            success = False

        aid = cursor.one('select annotation_id from time_group where id = %s;', (evidence.time_group_id,))
        if aid is not None:
            annotations.append(aid)

    if len(annotations) > 0:
        vals['annotation'] = annotations

    return DeleteDependents(vals, success)


Delete = namedtuple('Delete', ['id', 'url', 'exists'])

@pytest.fixture
def delete(target, cascade):
    url = F'/rest/evidence/{target.id}'
    if cascade:
        url += '?cascade=1'
    return Delete(target.id, url, target.exists)


@pytest.fixture
def affected_tables():
    return ['evidence', 'place_instance', 'person_instance', 'time_instance',
            'time_group', 'religion_instance', 'annotation', 'source_instance']


def tablecontents(cursor, name):
    cursor.execute(F'select * from {name} order by id;')
    return list(map(lambda x: x._asdict(), cursor.fetchall()))


def test_delete_evidence(client, minimal_testuser, cursor, headers, delete, delete_dependents, affected_tables, cascade):
    '''test DELETE /rest/evidence/<id>, with and without cascading'''
    user, _ = minimal_testuser
    before = { tbl: tablecontents(cursor, tbl) for tbl in affected_tables }

    rv = client.delete(delete.url, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if delete.exists and delete_dependents.success:
            assert rv.status_code == 200

            for table, ids in delete_dependents.dependents.items():
                id_set = '(' + ','.join(map(str, ids)) + ')'
                assert 0 == cursor.one(F'select count(*) from {table} where id in {id_set};'), (table, id_set, rv.data)

            for table in affected_tables:
                if table not in delete_dependents.dependents:
                    before_tbl = json.dumps(before[table], sort_keys=True, cls=NumericRangeEncoder)
                    after = json.dumps(tablecontents(cursor, table), sort_keys=True, cls=NumericRangeEncoder)
                    assert before_tbl == after

        else:
            if not delete.exists:
                assert rv.status_code == 404
            elif not delete_dependents.success:
                assert rv.status_code == 409

            for table in affected_tables:
                before_tbl = json.dumps(before[table], sort_keys=True, cls=NumericRangeEncoder)
                after = json.dumps(tablecontents(cursor, table), sort_keys=True, cls=NumericRangeEncoder)
                assert before_tbl == after

    else:
        assert rv.status_code == 403
        for table in affected_tables:
            before_tbl = json.dumps(before[table], sort_keys=True, cls=NumericRangeEncoder)
            after = json.dumps(tablecontents(cursor, table), sort_keys=True, cls=NumericRangeEncoder)
            assert before_tbl == after


Get = namedtuple('Get', ['id', 'url', 'exists'])

@pytest.fixture
def get(target):
    url = F'/rest/evidence/{target.id}'
    return Get(target.id, url, target.exists)


def test_get_evidence(client_ro, minimal_testuser, ro_cursor, ro_headers, get):
    '''test GET /rest/evidence/<id>'''
    user, _ = minimal_testuser

    rv = client_ro.get(get.url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if get.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is dict
            assert data['religion_id'] is not None
            assert data['place_id'] is not None

            evidence = next(filter(lambda x: x.id == get.id, evidence_table))

            for i in ['place_instance_id', 'person_instance_id',
                    'religion_instance_id', 'time_group_id']:
                assert i in data
                assert data[i] == evidence._asdict()[i]

        else:
            assert rv.status_code == 404

    else:
        assert rv.status_code == 403


@pytest.fixture
def url(target):
    return F'/rest/evidence/{target.id}'

@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT'])
def test_method_not_allowed(client_ro, minimal_testuser, method, ro_headers, url):
    '''check method not allowed with login'''
    rv = client_ro.open(path=url, headers=ro_headers, method=method)

    assert rv.status_code == 405, rv.data


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, url, method):
    '''test without login'''
    rv = client_ro.open(path=url, method=method)
    if method not in ('GET', 'HEAD', 'DELETE', 'PUT', 'PATCH'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
