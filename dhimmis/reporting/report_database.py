import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime
from functools import namedtuple
import uuid
import json
import gzip
import subprocess
import logging
import flask

_database_schema = '''
CREATE TABLE reports (
      uuid TEXT NOT NULL PRIMARY KEY,
      user TEXT NOT NULL,
      started DATETIME NOT NULL,
      completed DATETIME DEFAULT NULL,
      report_state TEXT NOT NULL DEFAULT 'started',
      last_access DATETIME NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 1,
      server_version TEXT NOT NULL,
      filter BLOB DEFAULT NULL,
      content BLOB DEFAULT NULL,
      pdf_map BLOB DEFAULT NULL,
      pdf_report BLOB DEFAULT NULL,
      evidence_count INTEGER NOT NULL DEFAULT 0
  );
'''

def _convert_datetime(val):
    if type(val) is bytes:
        return datetime.fromisoformat(val.decode('utf-8'))
    return None
sqlite3.register_converter('DATETIME', _convert_datetime)

@contextmanager
def get_report_database():
    filepath = os.environ.get('DHIMMIS_REPORT_FILE', '/data/reports.db')
    if not os.path.exists(filepath):
        con = sqlite3.connect(filepath, detect_types=sqlite3.PARSE_DECLTYPES)
        con.execute(_database_schema)
        cur = con.cursor()
        yield cur
        con.commit()
        con.close()

    else:
        con = sqlite3.connect(filepath, detect_types=sqlite3.PARSE_DECLTYPES)
        cur = con.cursor()
        yield cur
        con.commit()
        con.close()


ReportTuple = namedtuple('ReportTuple', ['uuid', 'user', 'server_version', 'report_state', 'started', 'completed', 'content', 'pdf_map', 'pdf_report', 'filter', 'evidence_count', 'last_access', 'access_count'])


def start_report(username, server_version, filter_json):
    u = str(uuid.uuid1())
    now = datetime.now().replace(microsecond=0).astimezone().isoformat()

    filter_content = gzip.compress(json.dumps(filter_json).encode('utf-8'))

    with get_report_database() as db:
        db.execute('''INSERT INTO reports (uuid, user, started, server_version, filter, report_state, last_access, access_count)
            VALUES (:uuid, :user, :started, :server_version, :filter, :report_state, :last_access, :access_count);''',
            {
                "uuid": u,
                "user": username,
                "server_version": server_version,
                "filter": filter_content,
                "started": now,
                "report_state": "started",
                "last_access": now,
                "access_count": 1,
                })

        # run subprocess
        sub_args = [
            'python', '-m', 'dhimmis.reporting.create_report',
            u,       # uuid
            flask.url_for('reporting.get_report', report_id=u, _external=True),  # absolute URL to report
            flask.url_for('reporting.get_map', report_id=u),  # relative URL to map
                ]
        p = subprocess.Popen(sub_args)
        logging.getLogger('flask.error').info(F'Starting report generation of {u} (PID {p.pid}).')

        return u
