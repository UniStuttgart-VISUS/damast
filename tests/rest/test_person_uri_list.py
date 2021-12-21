import pytest
import re
import dhimmis
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from dhimmis.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import uri_namespace_table, external_person_uri_table, person_table

@pytest.fixture
def url():
    return F'/rest/uri/external-person-uri-list'


def test_get(client_ro, minimal_testuser, ro_headers, url):
    '''test GET list'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 200, rv.data

        data = json.loads(rv.data)
        assert type(data) is list
        assert len(data) == len(external_person_uri_table)

        for datum in data:
            id_ = datum['id']
            px = list(filter(lambda x: x.id == id_, external_person_uri_table))
            assert len(px) == 1
            p = px[0]._asdict()

            reply_str = json.dumps(datum, sort_keys=True)
            data_str = json.dumps(p, sort_keys=True)

            assert data_str == reply_str

    else:
        assert rv.status_code == 403, rv.data


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, url, method):
    '''test without login'''
    rv = client_ro.open(path=url, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401


_disallowed_methods = [ 'POST', 'TRACE', 'CONNECT', 'PATCH', 'PUT', 'DELETE' ]
@pytest.mark.parametrize('method', _disallowed_methods)
def test_method_not_allowed(client_ro, url, method, ro_headers):
    '''test method not allowed'''
    rv = client_ro.open(path=url, method=method, headers=ro_headers)
    assert rv.status_code == 405
