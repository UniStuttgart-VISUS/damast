import pytest
import damast

from database.testdata import evidence_table
from conftest import get_headers


_static = [
    ('/annotator/', 'text/html'),
    ('/annotator/add-document', 'text/html'),
    ('/annotator/bundle.js', 'application/javascript'),
    ('/annotator/annotator.css', 'text/css'),
    ('/annotator/document-selection.css', 'text/css'),
    ('/annotator/document-creation.css', 'text/css'),
        ]
@pytest.fixture(params=_static)
def static_file(request):
    return request.param


def test_static_files(client_ro, testuser, static_file):
    '''Check if static files are available for users'''
    user,password = testuser
    path,content_type = static_file
    headers=get_headers(client_ro, user.name, password)

    rv = client_ro.get(path, headers=headers)

    if 'admin' in user.roles or 'annotator' in user.roles:
        assert content_type in rv.content_type
        assert rv.status_code == 200, rv.data

    else:
        assert rv.status_code == 403


def test_nouser(client_ro, static_file):
    '''Check if static files are not available without logging in'''
    path,content_type = static_file
    rv = client_ro.get(path)

    assert rv.status_code == 401


