import pytest
import damast
import os
import time
import tempfile
import logging
import yaml
import sqlite3
from passlib.hash import bcrypt
import subprocess

import damast.reporting.report_database

def create_client(testusers, port, user_db_content, readonly=True):
    # create dummy files
    access_fd, access_fname = tempfile.mkstemp('.log', 'access_', dir='/dev/shm')
    os.environ['FLASK_ACCESS_LOG'] = access_fname
    error_fd, error_fname = tempfile.mkstemp('.log', 'error_', dir='/dev/shm')
    os.environ['FLASK_ERROR_LOG'] = error_fname
    users_fd, users_fname = tempfile.mkstemp('', 'users_', dir='/dev/shm')
    os.environ['DAMAST_USER_FILE'] = users_fname
    reports_fd, reports_fname = tempfile.mkstemp('', 'reports_', dir='/dev/shm')
    os.environ['DAMAST_REPORT_FILE'] = reports_fname

    os.environ['DAMAST_ENVIRONMENT'] = 'PYTEST'
    os.environ['PGHOST'] = 'localhost'
    os.environ['PGPORT'] = F'{port}'
    os.environ['PGDATABASE'] = 'ocn'
    os.environ['PGUSER'] = 'api'
    os.environ['PGPASSWORD'] = 'apipassword'

    # populate user database file
    conn = sqlite3.connect(users_fname)
    conn.executescript(user_db_content)
    conn.commit()
    conn.close()

    conn = sqlite3.connect(reports_fname)
    cur = conn.cursor()

    cur.executescript(damast.reporting.report_database._database_schema)

    conn.commit()
    conn.close()

    app = damast.create_app()
    app.config['testing'] = True

    with app.test_client() as client:
        with app.app_context():
            yield client

    # clean connection pool
    pool = app.pg.pool
    del app
    pool.clear()

    # clean up log handlers
    for log in (logging.getLogger('flask.access'), logging.getLogger('flask.error')):
        for handler in log.handlers:
            handler.close()
            log.removeHandler(handler)

    logging.shutdown()

    # clean up temporary files
    for fd,path in [(access_fd, access_fname),
            (error_fd, error_fname),
            (users_fd, users_fname),
            (reports_fd, reports_fname),
            ]:
        os.close(fd)
        os.unlink(path)

