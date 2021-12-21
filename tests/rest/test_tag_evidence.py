import pytest
import re
import dhimmis
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from dhimmis.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import tag_table, evidence_table, Evidence, tag_evidence_table

_evidences = []
EvidenceData = namedtuple('EvidenceData', ['evidence', 'exists'])
for e in evidence_table:
    _evidences.append(EvidenceData(e, True))

for id_ in [256, 2782, 67, 315]:
    _evidences.append(EvidenceData(Evidence(id_, None, None, None, None, None, None, None), False))

@pytest.fixture(params=_evidences)
def evidence_data(request):
    return request.param


@pytest.fixture
def url(evidence_data):
    return F'/rest/evidence/{evidence_data.evidence.id}/tags'


def test_get(client_ro, minimal_testuser, ro_headers, evidence_data, url):
    '''test GET tags for evidence'''
    user, _ = minimal_testuser
    evidence = evidence_data.evidence

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if evidence_data.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is list

            vs = list(map(lambda x: x.tag_id, filter(lambda y: y.evidence_id == evidence.id, tag_evidence_table)))
            assert len(vs) == len(data)

            assert all(map(lambda datum: datum in vs, data))

        else:
            assert rv.status_code == 404

    else:
        assert rv.status_code == 403


PutData = namedtuple('PutData', ['data', 'valid', 'success', 'return_code'])
_put_data = [
        PutData([1,2,3], True, True, (204, 205)),
        PutData([1], True, True, (204, 205)),
        PutData([], True, True, (204,205)),
        PutData([2,6,10,3], True, True, (204,205)),
        PutData([3,4], True, True, (204,205)),
        PutData([1,2,3,4,5,6,7,8,9,10], True, True, (204,205)),

        PutData([1,1,4], True, False, 409),  # duplicate
        PutData([3,5,1345], True, False, 409),  # foreign key violation
        PutData(['a'], True, False, 422),  # wrong datatype XXX?

        PutData(b'', False, False, 415),  # invalid payload
        PutData(b'\xDE\xAD payload', False, False, 415),  # invalid payload
        PutData(dict(x='uy'), True, False, 415),  # invalid payload
        ]

@pytest.fixture(params=_put_data)
def put_data(request):
    return request.param


_evidences_small = [
        EvidenceData(evidence_table[0], True),
        EvidenceData(evidence_table[1], True),
        EvidenceData(evidence_table[2], True),
        EvidenceData(Evidence(261, None, None, None, None, None, None, None), False),
        ]

@pytest.fixture(params=_evidences_small)
def evidence_data_small(request):
    return request.param


@pytest.fixture
def url_small(evidence_data_small):
    return F'/rest/evidence/{evidence_data_small.evidence.id}/tags'


def test_put(client, cursor, minimal_testuser, headers, evidence_data_small, url_small, put_data):
    '''test PUT tags for evidence'''
    user, _ = minimal_testuser
    evidence = evidence_data_small.evidence

    hdrs = { **headers }
    if put_data.valid:
        data = json.dumps(put_data.data)
        hdrs['Content-Type'] = 'application/json'
    else:
        data = put_data.data

    prev = list(map(lambda y: y.tag_id, filter(lambda x: x.evidence_id == evidence.id, tag_evidence_table)))

    rv = client.put(url_small, headers=hdrs, data=data)

    if 'user' in user.roles and 'readdb' in user.roles and 'writedb' in user.roles:
        if evidence_data_small.exists:
            if type(put_data.return_code) == tuple:
                assert rv.status_code in put_data.return_code, rv.data
            else:
                assert rv.status_code == put_data.return_code, rv.data

            if put_data.success:
                query = cursor.mogrify('select * from tag_evidence where evidence_id = %s;', (evidence.id,))
                cursor.execute(query)
                new = list(map(lambda x: x.tag_id, cursor.fetchall()))

                assert len(new) == len(put_data.data)
                assert all(map(lambda d: d in new, put_data.data))

            else:
                assert len(prev) == cursor.one('select count(*) from tag_evidence where evidence_id = %s;', (evidence.id,))

        else:
            assert rv.status_code == 404

    else:
        assert rv.status_code == 403


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'DELETE', 'PATCH'])
def test_method_not_allowed(client_ro, minimal_testuser, method, ro_headers, url):
    '''check method not allowed with login'''
    rv = client_ro.open(path=url, headers=ro_headers, method=method)

    assert rv.status_code == 405, rv.data


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, url, method):
    '''test without login'''
    rv = client_ro.open(path=url, method=method)
    if method not in ('GET', 'HEAD', 'PUT'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
