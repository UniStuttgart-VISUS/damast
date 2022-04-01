import datetime
import mimetypes
import flask
import json
import jwt
import logging
import os
import re
import subprocess
import sys
import urllib.parse
from postgres import Postgres

_databases = {
    'PRODUCTION': 'ocn',
    'TESTING': 'testing'
        }

def postgres_database():
    pg_user = os.environ.get('PGUSER', 'api')
    pg_host = os.environ.get('PGHOST', 'localhost')
    pg_port = os.environ.get('PGPORT', '5432')
    if os.environ.get('DAMAST_ENVIRONMENT') == 'PYTEST':
        pg_db = os.environ.get('PGDATABASE', 'none')
    else:
        pg_db = _databases.get(os.environ.get('DAMAST_ENVIRONMENT'))
    pg_pass = os.environ.get('PGPASSWORD', None)

    if pg_pass is None:
        raise RuntimeError(F'No password is set for the PostgreSQL database user ({pg_user}). Pass the password via the PGPASSWORD environment variable.')

    pg_url = F"postgres://{pg_user}:{urllib.parse.quote(pg_pass, safe='')}@{pg_host}:{pg_port}/{pg_db}"

    return Postgres(url=pg_url)

