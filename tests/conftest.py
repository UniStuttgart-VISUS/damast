import pytest
import os
import time
import yaml
import subprocess
import flask
import sqlite3
from passlib.hash import bcrypt
from client_fixture import create_client

from damast.user import User

testusers = []
with open('tests/testusers.yaml') as f:
    tu = yaml.safe_load(f)
    for username, props in tu.items():
        testusers.append((User(username, props['roles']), props['password']))


def get_workerid_offset(id_):
    if id_ == 'master':
        return 0
    else:
        # gw<number>
        return int(id_[2:])


@pytest.fixture(scope='session')
def cleanup_old_docker_containers(worker_id):
    '''
    Remove any conflicting docker containers from previous runs before
    launching the new ones.
    '''
    # get all container IDs for worker
    containers = subprocess.check_output([
        'docker',
        'container',
        'list',
        '--filter', F'name={worker_id}',
        '--filter', 'status=exited',
        '--filter', 'status=dead',
        '--filter', 'status=created',
        '--format', '{{.ID}}'
        ], encoding='utf-8').split()

    processes = [
            subprocess.Popen(['docker', 'container', 'rm', cid]) for cid in containers
            ]
    processes.append(subprocess.Popen(['docker', 'network', 'disconnect', '-f', 'bridge', F'postgres-{worker_id}']))
    processes.append(subprocess.Popen(['docker', 'network', 'disconnect', '-f', 'bridge', F'postgres-ro-{worker_id}']))


    for p in processes:
        p.wait()

    return


@pytest.fixture(scope='module')
def ro_database(worker_id, cleanup_old_docker_containers):
    '''
    Launch a docker container with a database for each pytest-xdist worker. The
    database should not be written to as it is only created once for the
    testing session.
    '''
    offset = get_workerid_offset(worker_id)
    port = 15432 - offset

    docker = subprocess.Popen(['docker',
        'run',
        '--rm',
        '--name', F'postgres-ro-{worker_id}',
        '-p', F'{port}:5432',
        'damast-pytest-testdb'
        ], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)

    # wait for docker to be up
    env = os.environ.copy()
    env['PGPASSWORD'] = 'docker'
    while True:
        if docker.poll() != None:
            break

        pc = subprocess.run(['psql',
            '-h', 'localhost',
            '-p', F'{port}',
            '-U', 'docker',
            '-w',
            '-d', 'ocn',
            '-c', 'select 1'
            ], env=env, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)

        if pc.returncode == 0:
            break
        time.sleep(1)

    yield

    # clean up docker
    pc = subprocess.run(['docker', 'kill', F'postgres-ro-{worker_id}'], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    docker.wait()


@pytest.fixture(scope='function')
def database(worker_id, cleanup_old_docker_containers, autouse=True):
    '''
    Get a connection to a writable, fresh database. The database is reverted to
    initial state after each test. One database per pytest-xdist worker.
    '''
    offset = get_workerid_offset(worker_id)
    port = 15433 + offset

    docker = subprocess.Popen(['docker',
        'run',
        '--rm',
        '--name', F'postgres-{worker_id}',
        '-p', F'{port}:5432',
        'damast-pytest-testdb'
        ], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)

    # wait for docker to be up
    env = os.environ.copy()
    env['PGPASSWORD'] = 'docker'
    while True:
        if docker.poll() != None:
            break

        pc = subprocess.run(['psql',
            '-h', 'localhost',
            '-p', F'{port}',
            '-U', 'docker',
            '-w',
            '-d', 'ocn',
            '-c', 'select 1'
            ], env=env, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)

        if pc.returncode == 0:
            break
        time.sleep(1)

    yield

    # clean up docker
    pc = subprocess.run(['docker', 'kill', F'postgres-{worker_id}'], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
    docker.wait()


@pytest.fixture(scope='function')
def client_ro(ro_database, worker_id, user_db_content):
    '''
    Create a Flask app that is connected to a readonly database instance. One
    client per test, per pytest-xdist worker.
    '''
    offset = get_workerid_offset(worker_id)
    port = 15432 - offset
    yield from create_client(testusers, port, user_db_content, readonly=True)


@pytest.fixture(params=[pytest.param(None, marks=pytest.mark.slow)], scope='function')
def client(request, database, worker_id, user_db_content):
    '''
    Create a Flask app that is connected to a writable database instance. One
    client per test, per pytest-xdist worker.
    '''
    offset = get_workerid_offset(worker_id)
    port = 15433 + offset
    yield from create_client(testusers, port, user_db_content, readonly=False)


@pytest.fixture(params=testusers)
def testuser(request):
    return request.param


_testusers_minimal = [
        # no user
        next(filter(lambda x: 'user' not in x[0].roles, testusers)),
        # readonly
        next(filter(lambda x: 'user' in x[0].roles and 'readdb' in x[0].roles and 'writedb' not in x[0].roles, testusers)),
        # read and write
        next(filter(lambda x: 'user' in x[0].roles and 'readdb' in x[0].roles and 'writedb' in x[0].roles, testusers)),
        ]
@pytest.fixture(params=_testusers_minimal)
def minimal_testuser(request):
    return request.param


@pytest.fixture
def normal_user():
    user, password = next(filter(lambda x: 'user' in x[0].roles and 'dev' in x[0].roles and 'admin' in x[0].roles and 'readdb' in x[0].roles and 'writedb' in x[0].roles, testusers))
    return user, password


@pytest.fixture
def cursor(client):
    with flask.current_app.pg.get_cursor(autocommit=True) as c:
        yield c


@pytest.fixture
def ro_cursor(client_ro):
    with flask.current_app.pg.get_cursor(readonly=True) as c:
        yield c


def get_headers(client, username, password):
    client.set_cookie('cookieConsent', 'essential')
    rv = client.post('/login', data=dict(username=username, password=password))
    print(rv.request.headers, rv.status, rv.headers)

    # No need to set any extra headers, as the client will do that
    # automatically with the Set-Cookie header. However, all tests manually
    # handle the headers returned by this method, so we cannot ignore it
    # completely here.
    # TODO: clean up header management

    return dict()


@pytest.fixture
def headers(client, minimal_testuser):
    user, password = minimal_testuser
    return get_headers(client, user.name, password)


@pytest.fixture
def ro_headers(client_ro, minimal_testuser):
    user, password = minimal_testuser
    return get_headers(client_ro, user.name, password)


@pytest.fixture
def ro_headers_full(client_ro, testuser):
    user, password = testuser
    return get_headers(client_ro, user.name, password)


@pytest.fixture
def headers_full(client, testuser):
    user, password = testuser
    return get_headers(client, user.name, password)


@pytest.fixture(scope='session')
def user_db_content():
    # populate user database file
    conn = sqlite3.connect(':memory:')
    cur = conn.cursor()

    cur.execute('''CREATE TABLE users (
        id TEXT PRIMARY KEY,
        password TEXT,
        expires DATE,
        roles TEXT DEFAULT '',
        comment TEXT DEFAULT ''
        );''')

    for user, password in testusers:
        roles = '' if user.roles is None else ','.join(user.roles)
        pwhash = bcrypt.hash(password)
        cur.execute('INSERT INTO users (id, password, expires, roles) VALUES (?, ?, ?, ?);',
                (user.name, pwhash, None, roles))
    conn.commit()
    dump = '\n'.join(conn.iterdump())
    conn.close()

    return dump


def pytest_configure(config):
    config.addinivalue_line(
            "markers", "slow: marks tests as  slow (deselect with '-m \"not slow\"')"
            )
