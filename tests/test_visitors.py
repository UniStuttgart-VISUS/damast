import os
import pytest
import dhimmis
import flask
import urllib.parse
import base64
import sqlite3
from functools import namedtuple
from passlib.hash import sha256_crypt, sha512_crypt, bcrypt
from passlib.context import CryptContext

from conftest import get_headers

Roles = namedtuple('Roles', 'roles,valid')
_visitor_roles = [
        Roles(
            None,
            [],
        ),
        Roles(
            ['user'],
            ['visitor', 'user'],
        ),
        Roles(
            ['user', 'readdb'],
            ['visitor', 'user', 'readdb'],
        ),
        Roles(
            ['user', 'readdb', 'vis'],
            ['visitor', 'user', 'readdb', 'vis'],
        ),
        Roles(
            ['user', 'readdb', 'writedb', 'vis', 'geodb'],
            ['visitor', 'user', 'readdb', 'vis', 'geodb'],
        ),
        Roles(
            ['user', 'readdb', 'vis', 'reporting'],
            ['visitor', 'user', 'readdb', 'vis', 'reporting'],
        ),
        Roles(
            ['user', 'readdb', 'annotator', 'dev'],
            ['visitor', 'user', 'readdb', 'vis', 'annotator'],
        ),
        Roles(
            ['user', 'writedb', 'admin'],
            ['visitor', 'user'],
        ),
        Roles(
            ['foo'],
            ['visitor'],
        ),
        ]


# this needs to be run before the `client` fixture. function scope and autouse should ensure that
@pytest.fixture(params=_visitor_roles, scope='function', autouse=True)
def visitor_roles(request):
    if request.param.roles is None:
        if 'DHIMMIS_VISITOR_ROLES' in os.environ:
            os.environ.pop('DHIMMIS_VISITOR_ROLES')
    else:
        os.environ['DHIMMIS_VISITOR_ROLES'] = ','.join(request.param.valid)

    return request.param


TryPath = namedtuple('TryPath', 'path,roles,nologin')
_try_paths = [
    TryPath('/', ('user',), False),
    TryPath('/impressum.html', None, True),
    TryPath('/cookie-preferences', None, True),
    TryPath('/login', None, True),
    TryPath('/vis/', ('vis','readdb'), False),
    TryPath('/place/', ('readdb','user'), False),
    TryPath('/GeoDB-Editor/places', ('readdb','geodb'), False),
    TryPath('/annotator/', ('readdb','annotator'), False),
    TryPath('/reporting/', ('readdb','user','reporting'), False),
    TryPath('/docs/', ('user',), False),
    TryPath('/docs/annotator', ('user','annotator'), False),
    TryPath('/docs/changelog', ('user',), False),
    TryPath('/rest/dump/', ('user','readdb','NEVER_ALLOWED'), False),  # dump should not be possible for visitors
    TryPath('/docs/schema', ('user','NEVER_ALLOWED'), False),
    TryPath('/change-password', ('user','NEVER_ALLOWED'), False),
    TryPath('/rest/place-type-list', ('user','readdb'), False),
    TryPath('/rest/religions', ('user','readdb'), False),
    TryPath('/rest/uri/uri-namespace-list', ('user','readdb'), False),
    ]

@pytest.fixture(params=_try_paths)
def try_path(request):
    return request.param


def test_can_use(client, visitor_roles, try_path):
    rv = client.get(try_path.path)

    allowed = try_path.nologin or set(visitor_roles.valid).issuperset(set(try_path.roles))

    if allowed:
        assert rv.status_code >= 200, rv.data
        assert rv.status_code <= 300, rv.data

    else:
        assert rv.status_code >= 400, rv.data

