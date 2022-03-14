import pytest
import re
import damast
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from damast.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import evidence_table, source_instance_table


Evidence = namedtuple('Evidence', ['id', 'exists'])
_evidence = []
for e in evidence_table:
    _evidence.append(Evidence(e.id, True))
for e in (0, 400, 1635):
    _evidence.append(Evidence(e, False))

@pytest.fixture(params=_evidence)
def evidence(request):
    return request.param


@pytest.fixture
def source_instances_for_evidence(evidence):
    if evidence.exists:
        return list(filter(lambda x: x.evidence_id == evidence.id, source_instance_table))
    return []


@pytest.fixture
def url(evidence):
    return F'/rest/evidence/{evidence.id}/source-instances'


def test_get_source_instances(client_ro, minimal_testuser, ro_headers, evidence, url, source_instances_for_evidence):
    '''test GET source instances for evidence'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        if evidence.exists:
            assert rv.status_code == 200, rv.data

            data = json.loads(rv.data)
            assert type(data) is list

            assert len(source_instances_for_evidence) == len(data)

            for ev in source_instances_for_evidence:
                _e = list(filter(lambda x: x['id'] == ev.id, data))
                assert len(_e) == 1
                e = _e[0]

                for k, v in ev._asdict().items():
                    assert k in e
                    assert e[k] == v

        else:
            assert rv.status_code == 404

    else:
        assert rv.status_code == 403


@pytest.fixture(params=[
    '/rest/evidence/1/source-instances',
    '/rest/evidence/20/source-instances',
    '/rest/evidence/4346/source-instances'])
def minimal_url(request):
    return request.param


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'DELETE', 'PUT', 'PATCH'])
def test_method_not_allowed(client_ro, minimal_testuser, method, ro_headers, minimal_url):
    '''check method not allowed with login'''
    rv = client_ro.open(path=minimal_url, headers=ro_headers, method=method)

    assert rv.status_code == 405, rv.data


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, minimal_url, method):
    '''test without login'''
    rv = client_ro.open(path=minimal_url, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
