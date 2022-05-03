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
from .config import get_config

_databases = {
    'PRODUCTION': 'ocn',
    'TESTING': 'testing'
        }

def postgres_database():
    cfg = get_config()
    pg_user = cfg.pguser
    pg_host = cfg.pghost
    pg_port = cfg.pgport
    if cfg.environment == 'PYTEST':
        pg_db = os.environ.get('PGDATABASE', 'none')
    else:
        pg_db = _databases.get(cfg.environment)
    pg_pass = cfg.pgpassword

    pg_url = F"postgres://{pg_user}:{urllib.parse.quote(pg_pass, safe='')}@{pg_host}:{pg_port}/{pg_db}"

    return Postgres(url=pg_url)

