import pytest
import re
import damast
import flask
import json
from functools import namedtuple

from database.testdata import document_table as docdata
from conftest import get_headers

_routes = [
        '/rest/document/list',
        '/rest/document/1',
        '/rest/document/2',
        '/rest/document/3',
        '/rest/document/4',
        '/rest/document/5',
        '/rest/document/1/metadata',
        '/rest/document/2/metadata',
        '/rest/document/3/metadata',
        '/rest/document/4/metadata',
        '/rest/document/5/metadata',
        ]

@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
@pytest.mark.parametrize('route', _routes)
def test_method_not_allowed(client_ro, minimal_testuser, method, route):
    '''check method not allowed with login'''
    user,password = minimal_testuser

    headers = get_headers(client_ro, user.name, password)
    rv = client_ro.open(path=route, headers=headers, method=method)

    assert rv.status_code == 405, rv.data


def test_document_list(client_ro, minimal_testuser):
    '''test getting the list of document metadata'''
    user,password = minimal_testuser

    with flask.current_app.pg.get_cursor(readonly=True) as c:
        headers = get_headers(client_ro, user.name, password)
        route = '/rest/document/list'
        rv = client_ro.get(route, headers=headers)

        if 'user' in user.roles and 'readdb' in user.roles:
            data = json.loads(rv.data)

            assert rv.status_code == 200
            assert type(data) is list
            assert len(data) == len(docdata)

            for doc in data:
                assert 1 == c.one('select count(*) from document where id = %s;', (doc['id'],))

        else:
            assert rv.status_code == 403


@pytest.mark.parametrize('document', docdata)
def test_document_metadata(client_ro, minimal_testuser, document):
    '''test getting the metadata for a document'''
    user,password = minimal_testuser
    headers = get_headers(client_ro, user.name, password)

    route = F'/rest/document/{document[0]}/metadata'
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        data = json.loads(rv.data)

        assert rv.status_code == 200
        assert type(data) is dict

        assert data['source_id'] == document.source_id
        assert data['document_version'] == document.version
        assert data['comment'] == document.comment
        assert data['content_type'] == document.content_type
        assert data['content_length'] == document.content_length

    else:
        assert rv.status_code == 403


@pytest.mark.parametrize('document', [6,600,1272])
def test_document_metadata_notfound(client_ro, minimal_testuser, document):
    '''test getting the metadata for a document that does not exist'''
    user,password = minimal_testuser
    headers = get_headers(client_ro, user.name, password)

    route = F'/rest/document/{document}/metadata'
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == 404

    else:
        assert rv.status_code == 403


DocumentTest = namedtuple('DocumentTest', ['id', 'range', 'success', 'status_code'])
_document_tests = [
    DocumentTest(1, None, True, 200),
    DocumentTest(1, 'bytes=0-4', True, 206),
    DocumentTest(1, 'bytes=0-19', True, 206),
    DocumentTest(1, 'bytes=0-20', True, 200),
    DocumentTest(1, 'bytes=-20', True, 200),
    DocumentTest(1, 'bytes=0-', True, 200),
    DocumentTest(1, 'bytes=-', True, 200),
    DocumentTest(1, 'bytes=-4', True, 206),
    DocumentTest(1, 'bytes=1-1', True, 206),
    DocumentTest(1, 'bytes=-15-2', False, 416),
    DocumentTest(1, 'bytes=14-1', False, 416),
    DocumentTest(1, 'bytes=-25', False, 416),
    DocumentTest(1, 'bytes=0-5, 14-20', False, 416),
    DocumentTest(1, 'chunks=1-2', False, 416),

    DocumentTest(2, None, True, 200),
    DocumentTest(2, 'document-characters=0-29', True, 200),
    DocumentTest(2, 'document-characters=0-', True, 200),
    DocumentTest(2, 'document-characters=0-28', True, 206),
    DocumentTest(2, 'document-characters=6-7', True, 206),
    DocumentTest(2, 'document-characters=0-291', False, 416),
    DocumentTest(2, 'document-characters=0-30', False, 416),
    DocumentTest(2, 'document-characters=56-58', False, 416),
    DocumentTest(2, 'bytes=0-10', False, 416),

    DocumentTest(3, None, True, 200),
    DocumentTest(3, 'bytes=-', True, 200),
    DocumentTest(3, 'bytes=4-25', True, 206),
    DocumentTest(3, 'bytes=6-7', True, 206),
    DocumentTest(3, 'bytes=0-291', False, 416),
    DocumentTest(3, 'bytes=56-58', False, 416),

    DocumentTest(4, None, True, 200),
    DocumentTest(4, 'document-characters=-', True, 200),
    DocumentTest(4, 'document-characters=4-26', True, 206),
    DocumentTest(4, 'document-characters=40-47', True, 206),
    DocumentTest(4, 'bytes=40-47', False, 416),
    DocumentTest(4, 'document-characters=220-291', False, 416),
    DocumentTest(4, 'erroneous value', False, 416),

    DocumentTest(5, None, True, 200),
    DocumentTest(5, 'bytes=0-3', False, 416),

    DocumentTest(6, None, False, 404),
    DocumentTest(35, None, False, 404),
    DocumentTest(211, 'bytes=1-4', False, 404),
    DocumentTest(15, 'dummy', False, 404),
        ]


@pytest.mark.parametrize('document', _document_tests)
def test_document(client_ro, minimal_testuser, document):
    '''test getting a document, or part of a document'''
    user,password = minimal_testuser
    headers = get_headers(client_ro, user.name, password)

    route = F'/rest/document/{document.id}'
    if document.range is not None:
        headers['Range'] = document.range
    rv = client_ro.get(route, headers=headers)

    if 'user' in user.roles and 'readdb' in user.roles:
        assert rv.status_code == document.status_code

        if document.success:
            doc = next(filter(lambda x: x[0] == document.id, docdata))
            if document.range is None:
                assert rv.data == doc.content

            else:
                is_bytes = 'bytes' in document.range

                if is_bytes:
                    _range_spec = re.compile('bytes=(\\d*)-(\\d*)')
                    m = _range_spec.fullmatch(document.range)
                else:
                    # document characters
                    _range_spec = re.compile('document-characters=(\\d*)-(\\d*)')
                    m = _range_spec.fullmatch(document.range)

                start = int(m[1]) if len(m[1]) > 0 else 0
                end = int(m[2]) if len(m[2]) > 0 else doc.content_length-1

                if is_bytes:
                    assert rv.data == doc.content[start:end+1]
                else:
                    inner_text_expected = damast.document_fragment.inner_text(doc.content)[start:end+1]
                    inner_text = damast.document_fragment.inner_text(rv.data)

                    assert inner_text_expected == inner_text, (start, end, doc.content_length, len(inner_text_expected))


    else:
        assert rv.status_code == 403


_nouser_methods = [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'TRACE', 'CONNECT', 'HEAD' ]
@pytest.mark.parametrize('route', _routes)
@pytest.mark.parametrize('method', _nouser_methods)
def test_nouser(client_ro, route, method):
    '''test without login'''
    rv = client_ro.open(path=route, method=method)
    if method not in ('GET', 'HEAD'):
        assert rv.status_code == 405
    else:
        assert rv.status_code == 401
