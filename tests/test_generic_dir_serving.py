import pytest
import dhimmis
import os
import os.path
import tempfile
import shutil


@pytest.fixture(scope='module', params=[
    #('/annotator', 'DHIMMIS_ANNOTATOR_DIR', ['annotator', 'dev', 'admin']),
    ])
def environment(request):
    return request.param


@pytest.fixture(scope='module')
def url_prefix(environment):
    return environment[0]


@pytest.fixture(scope='module')
def env_variable(environment):
    return environment[1]


@pytest.fixture(scope='module')
def roles(environment):
    return environment[2]


filecontents = [
        ('index.html', b'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>title</title>
</head>
<body>
  Hello World!
</body>
</html>'''),
        ('testfile_a', b'iO4kXS3KNh4lugLJMW1pOZrDpY'),
        ('dir1/dir2/test.css', b'a { color: red; }'),
        ('dir1/dir2/t.css', b'b { color: blue; }'),
        ('dir1/field', b'b { color: blue; }'),
        ]

def create(path):
    for fname, content in filecontents:
        d = os.path.join(path, os.path.dirname(fname))
        if d != '':
            os.makedirs(d, exist_ok=True)
        with open(os.path.join(path, fname), 'xb') as f:
            f.write(content)


@pytest.fixture(scope='module')
def testdir(env_variable):
    os.environ[env_variable] = tempfile.mkdtemp(dir='/dev/shm')
    create(os.environ[env_variable])

    yield

    shutil.rmtree(os.environ[env_variable])


_testpaths = []
for _path, content in filecontents:
    if _path == 'index.html':
        _testpaths.append(('', content, 200))
    else:
        _testpaths.append((_path, content, 200))
_testpaths.append(('nonexistent-file/path', None, 404))
_testpaths.append(('dir1/dir2/testfile.conf', None, 404))


@pytest.fixture(params=_testpaths)
def testfile(request):
    return request.param


@pytest.fixture
def url(url_prefix, testfile):
    path, _, __ = testfile
    return F'{url_prefix}/{path}'


def test_file(testdir, url, client, headers_full, testuser, testfile, roles, environment):
    user,_ = testuser
    path,content,retcode = testfile

    # test page
    r2 = client.get(url, headers=headers_full)
    if any(map(lambda r: r in user.roles, roles)):
        assert r2.status_code == retcode, r2.data
        if retcode == 200:
            assert r2.data == content, r2.data
    else:
        assert r2.status_code == 403, r2.data


@pytest.mark.parametrize('method', ['POST', 'TRACE', 'CONNECT', 'PUT', 'PATCH', 'DELETE'])
def test_method_not_allowed(testdir, url, client, testuser, roles, headers_full, testfile, method, environment):
    user,_ = testuser
    path,content,retcode = testfile

    # test page
    r2 = client.open(url, method=method, headers=headers_full)
    if any(map(lambda r: r in user.roles, roles)):
        assert r2.status_code == 405, r2.data
    else:
        assert r2.status_code == 405


def test_file_nologin(testdir, client, testfile, environment, url):
    path,content,retcode = testfile

    # test page
    r2 = client.get(url)
    assert r2.status_code == 401, r2.data
