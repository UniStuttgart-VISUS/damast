import pytest
import re
import dhimmis
import flask
import json
from functools import namedtuple
from urllib.parse import quote
from dhimmis.postgres_rest_api.util import NumericRangeEncoder

from database.testdata import uri_namespace_table

@pytest.fixture
def url():
    return F'/rest/uri/uri-namespace-list'


def test_get(client_ro, minimal_testuser, ro_headers, url):
    '''test GET list'''
    user, _ = minimal_testuser

    rv = client_ro.get(url, headers=ro_headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 200, rv.data

        data = json.loads(rv.data)
        assert type(data) is list
        assert len(data) == len(uri_namespace_table)
        assert all(map(lambda x: any(map(lambda y: x['id'] == y.id, uri_namespace_table)), data))
        assert all(map(lambda x: any(map(lambda y: x.id == y['id'], data)), uri_namespace_table))

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
