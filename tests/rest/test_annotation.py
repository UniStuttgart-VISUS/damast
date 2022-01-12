import pytest
import re
import psycopg2.extras
import dhimmis
from dhimmis.postgres_rest_api.util import NumericRangeEncoder
import flask
import json
from functools import namedtuple

from database.testdata import annotation_table
from conftest import get_headers
_routes = list(map(lambda x: F'/rest/annotation/{x.id}', annotation_table))


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT'])
@pytest.mark.parametrize('route', _routes)
def test_method_not_allowed(client_ro, minimal_testuser, method, route):
    '''check method not allowed with login'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=route, headers=headers, method=method)

    assert rv.status_code == 405, rv.data


_bounds_pattern = re.compile(R'([\[(])\s*(\d*)\s*,\s*(\d*)\s*([\])])')
def get_inclusive_int4range_bounds(val_str):
    m = _bounds_pattern.fullmatch(val_str)
    assert m

    bounds = F'{m[1]}{m[4]}'
    lower = None if m[2] == '' else int(m[2])
    upper = None if m[3] == '' else int(m[3])

    span = psycopg2.extras.NumericRange(lower=lower, upper=upper, bounds=bounds)
    a = span.lower if (span.lower_inc or span.lower is None) else span.lower+1
    b = span.upper if (span.upper_inc or span.upper is None) else span.upper-1

    return a,b


@pytest.mark.parametrize('annotation', annotation_table)
def test_get_annotation(client_ro, minimal_testuser, annotation):
    '''test getting an annotation'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    route = F'/rest/annotation/{annotation.id}'
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        data = json.loads(rv.data)

        assert rv.status_code == 200
        assert type(data) is dict

        assert annotation.id == data['id']
        assert annotation.document_id == data['document_id']
        assert annotation.comment == data['comment']

        start, end = get_inclusive_int4range_bounds(annotation.span)
        rv_start, rv_end = tuple(data['span'])

        assert start == rv_start
        assert end == rv_end

    else:
        assert rv.status_code == 403


@pytest.mark.parametrize('annotation_id', [0, 70, 4501])
def test_get_annotation_notfound(client_ro, minimal_testuser, annotation_id):
    '''test getting an annotation'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    route = F'/rest/annotation/{annotation_id}'
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 404

    else:
        assert rv.status_code == 403


PutAnnotation = namedtuple('PutAnnotation', ['data', 'valid', 'success', 'return_code'])
_put_data = [
    PutAnnotation(dict(document_id=4, span='[0,10]'), True, True, 201),
    PutAnnotation(dict(document_id=1, span='[14,20]', comment='Test comment'), True, True, 201),
    PutAnnotation(dict(document_id=2, span='[1,4]'), True, True, 201),
    PutAnnotation(dict(document_id=1, comment='different comment'), True, False, 409),
    PutAnnotation(dict(comment='different comment'), True, False, 409),
    PutAnnotation(dict(document_id=422, span='[1,2]'), True, False, 409),
    PutAnnotation(b'', False, False, 400),
    PutAnnotation(b'Garbage payload, not JSON', False, False, 400),
    PutAnnotation(dict(), True, False, 400),
    PutAnnotation(dict(document_id=2, span='[1,4]', garbage_arg=12), True, False, 400),
    PutAnnotation(dict(document_id=3, span='[-101,4]'), True, False, 409),
    PutAnnotation(dict(document_id=4, span='[-101,-24]'), True, False, 409),
    PutAnnotation(dict(document_id=2, span='[10,4]'), True, False, 422),
    PutAnnotation(dict(document_id=1, span='[100,401]'), True, False, 409),
    ]

@pytest.mark.parametrize('data', _put_data)
def test_put_annotation(client, minimal_testuser, data):
    '''test creating an annotation'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client, user.name, password)
        route = F'/rest/annotation/0'

        d = data.data
        if data.valid:
            d = json.dumps(d)
            headers['Content-Type'] = 'application/json'

        rv = client.put(route, headers=headers, data=d)

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            assert rv.status_code == data.return_code, rv.data

            anns = c.one('select count(*) from annotation;')
            if data.success:
                assert anns == len(annotation_table) + 1
                ret = json.loads(rv.data)
                assert type(ret) == dict
                assert 'annotation_id' in ret
                assert ret['annotation_id'] == len(annotation_table) + 1

            else:
                assert anns == len(annotation_table)

        else:
            assert rv.status_code == 403, rv.data


PatchAnnotation = namedtuple('PatchAnnotation', ['id', 'data', 'valid', 'success', 'return_code'])
_patch_data = [
    # good
    PatchAnnotation(1, dict(span='(1, 3)'), True, True, 205),
    PatchAnnotation(1, dict(span='[1, 1]'), True, True, 205),
    PatchAnnotation(2, dict(span='[0, 10]'), True, True, 205),
    PatchAnnotation(3, dict(span='[4, 15]', comment='New comment'), True, True, 205),
    PatchAnnotation(4, dict(comment='only new comment'), True, True, 205),
    PatchAnnotation(5, dict(comment=None), True, True, 205),
    PatchAnnotation(6, dict(span='[1,5]', comment=None), True, True, 205),
    PatchAnnotation(7, dict(span='(1,5]', comment='aaa'), True, True, 205),
    PatchAnnotation(8, dict(span='[12,46)', comment=''), True, True, 205),

    # span not valid
    PatchAnnotation(4, dict(span='[12,]'), True, False, 409),
    PatchAnnotation(2, dict(span='[,]'), True, False, 409),
    PatchAnnotation(6, dict(span=None), True, False, 409),
    PatchAnnotation(5, dict(span='aksjf'), True, False, 422),
    PatchAnnotation(6, dict(span='(-15,3]'), True, False, 409),
    PatchAnnotation(7, dict(span='(-15,3]'), True, False, 409),
    PatchAnnotation(2, dict(span='[7,3234]'), True, False, 409),
    PatchAnnotation(3, dict(span='[735,3234]'), True, False, 409),

    # span parseable, but not valid
    PatchAnnotation(5, dict(span='[14, 12]'), True, False, 422),
    PatchAnnotation(2, dict(span='[24, 4]'), True, False, 422),

    # invalid or empty payload
    PatchAnnotation(2, dict(), True, False, 400),
    PatchAnnotation(3, b'', False, False, 400),
    PatchAnnotation(7, b'garbage', False, False, 400),

    # payload contains non-changeable keys
    PatchAnnotation(1, dict(comment='test', illegal_payload_member=15), True, False, 400),
    PatchAnnotation(6, dict(foo=True), True, False, 400),
    PatchAnnotation(6, dict(document_id=1), True, False, 400),
    PatchAnnotation(2, dict(document_id=4), True, False, 400),

    # not found
    PatchAnnotation(100, dict(span='[12,46)', comment=''), True, False, 404),
    PatchAnnotation(61, dict(span='[12,]'), True, False, 404),
    PatchAnnotation(2324, dict(), True, False, 404),
    PatchAnnotation(0, b'', False, False, 404),
    PatchAnnotation(2361, dict(comment='test', illegal_payload_member=15), True, False, 404),
        ]

@pytest.mark.parametrize('data', _patch_data)
def test_patch_annotation(client, minimal_testuser, data):
    '''test modifying an annotation'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        olddata = c.one('select * from annotation where id = %s;', (data.id,))
        if olddata is not None:
            olddata = olddata._asdict()

        headers = get_headers(client, user.name, password)
        route = F'/rest/annotation/{data.id}'

        d = data.data
        if data.valid:
            d = json.dumps(d)
            headers['Content-Type'] = 'application/json'

        rv = client.patch(route, headers=headers, data=d)

        newdata = c.one('select * from annotation where id = %s;', (data.id,))
        if newdata is not None:
            newdata = newdata._asdict()

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            assert rv.status_code == data.return_code, rv.data
            assert len(annotation_table) == c.one('select count(*) from annotation;')

            if data.success:
                if 'comment' in data.data:
                    assert data.data['comment'] == newdata['comment']
                if 'span' in data.data:
                    a,b = get_inclusive_int4range_bounds(data.data['span'])
                    x = newdata['span']
                    c = None if x is None else x.lower if x.lower_inc else x.lower + 1
                    d = None if x is None else x.upper if x.upper_inc else x.upper - 1

                    assert a==c and b==d

            else:
                assert json.dumps(olddata, cls=NumericRangeEncoder) == json.dumps(newdata, cls=NumericRangeEncoder)

        else:
            assert json.dumps(olddata, cls=NumericRangeEncoder) == json.dumps(newdata, cls=NumericRangeEncoder)
            assert rv.status_code == 403


def delete_test(client, minimal_testuser, annotation_id, exists, has_evidence):
    '''do the actual deletion'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        oldcount = c.one('select count(*) from annotation where id = %s;', (annotation_id,))

        headers = get_headers(client, user.name, password)
        route = F'/rest/annotation/{annotation_id}'

        rv = client.delete(route, headers=headers)

        newcount = c.one('select count(*) from annotation where id = %s;', (annotation_id,))

        if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
            if exists:
                if has_evidence:
                    assert rv.status_code == 409
                    assert oldcount == 1
                    assert newcount == 1
                else:
                    assert rv.status_code == 200
                    assert oldcount == 1
                    assert newcount == 0

            else:
                assert rv.status_code == 404
                assert oldcount == 0
                assert newcount == 0

        else:
            assert oldcount == newcount
            assert rv.status_code == 403


@pytest.mark.parametrize('data', annotation_table)
def test_delete_annotation(client, minimal_testuser, cursor, data):
    evidence_count = cursor.one('''
        SELECT COUNT(*)
            FROM evidence E
            JOIN person_instance PRI ON E.person_instance_id = PRI.id
            JOIN place_instance PI ON E.place_instance_id = PI.id
            JOIN religion_instance RI ON E.religion_instance_id = RI.id
            JOIN time_group TG ON E.time_group_id = TG.id
            WHERE %(id)s IN ( PRI.annotation_id, PI.annotation_id, RI.annotation_id, TG.annotation_id );
    ''', id=data.id)
    has_evidence = (0 < evidence_count)
    delete_test(client, minimal_testuser, data.id, True, has_evidence)


@pytest.mark.parametrize('annotation_id', [0, 201, 472, 4237])
def test_delete_annotation_notfound(client, minimal_testuser, annotation_id):
    delete_test(client, minimal_testuser, annotation_id, False, None)


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('route', _routes)
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, method):
    '''test without login'''
    rv = client_ro.open(path=route, method=method)
    if method not in ('GET', 'HEAD', 'DELETE', 'PUT', 'PATCH'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
