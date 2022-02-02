import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime, date
from functools import namedtuple
import uuid
import json
import gzip
import subprocess
import logging
import flask
import traceback

_database_schema = '''
CREATE TABLE reports (
      uuid TEXT NOT NULL PRIMARY KEY,
      user TEXT NOT NULL,
      started DATETIME NOT NULL,
      completed DATETIME DEFAULT NULL,
      report_state TEXT NOT NULL DEFAULT 'started',
      last_access DATETIME NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0,
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


def _run_report_generation(report_id, rerun=False):
    # run subprocess
    sub_args = [
        'python', '-m', 'dhimmis.reporting.create_report',
        report_id,
        flask.url_for('reporting.get_report', report_id=report_id, _external=True),  # absolute URL to report
        flask.url_for('reporting.get_map', report_id=report_id),  # relative URL to map
            ]
    p = subprocess.Popen(sub_args)

    if rerun:
        logging.getLogger('flask.error').info(F'Restarting report generation of {report_id} after eviction (PID {p.pid}).')
    else:
        logging.getLogger('flask.error').info(F'Starting report generation of {report_id} (PID {p.pid}).')

    return report_id


def recreate_report_after_evict(report_id):
    with get_report_database() as db:
        db.execute('UPDATE reports SET report_state = :st WHERE uuid = :uuid;', dict(st='started', uuid=report_id))

    _run_report_generation(report_id, rerun=True)


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
                "access_count": 0,
                })

        _run_report_generation(u)
        return u



def update_report_access(report_id):
    now = datetime.now().replace(microsecond=0).astimezone().isoformat()
    with get_report_database() as db:
        db.execute('SELECT access_count FROM reports WHERE uuid = :uuid;', dict(uuid=report_id))
        (access, ) = db.fetchone()
        db.execute('UPDATE reports SET last_access = :now, access_count = :count WHERE uuid = :uuid;',
                dict(uuid=report_id, now=now, count=access+1))


def evict_report(report_id):
    try:
        with get_report_database() as db:
            db.execute('SELECT report_state, started, last_access, access_count, content, pdf_map, pdf_report FROM reports WHERE uuid = :uuid;', dict(uuid=report_id))
            report_state, started, last_access, access_count, content, pdf_map, pdf_report = db.fetchone()
            now = datetime.now().replace(microsecond=0).astimezone()

            upd = dict(report_state='evicted', content=None, pdf_map=None, pdf_report=None, last_access=now.isoformat(), uuid=report_id)

            size = ''
            age = (now - started).days
            age_accessed = (now - last_access).days

            if report_state == 'started':
                size = '0B'
                logging.getLogger('flask.error').warning('Report %s is getting evicted but still in started state.', report_id)
            elif report_state == 'evicted':
                size = '0B'
            elif report_state in ('completed', 'failed'):
                size = 0
                if content is not None:
                    size += len(bytes(content))
                if pdf_map is not None:
                    size += len(bytes(pdf_map))
                if pdf_report is not None:
                    size += len(bytes(pdf_report))

                if size > 1000000:
                    sizes = F'{size // 1000000}MB'
                elif size > 1000:
                    sizes = F'{size // 1000}kB'
                else:
                    sizes = F'{size}B'
                size = sizes
            else:
                logging.getLogger('flask.error').warning('Report %s is has unknown state: %s.', report_id, report_state)
                size = '?'

            db.execute('UPDATE reports SET report_state = :report_state, content = :content, pdf_report = :pdf_report, pdf_map = :pdf_map, last_access = :last_access WHERE uuid = :uuid;', upd)
            logging.getLogger('flask.error').info('Evicted %s report with UUID %s (created %d days ago, last accessed %d days ago). Freed %s.', report_state, report_id, age, age_accessed, size)

    except:
        tb = traceback.format_exc()
        logging.getLogger('flask.error').error('Something went wrong while evicting report %s: %s', report_id, tb)


def check_for_evictable():
    '''
    Check the report database for reports that can be evicted, and do so with those.

    Reports can be evicted if they have not been accessed for
    ${DHIMMIS_REPORT_EVICTION_DEFERRAL} days. Alternatively, if the report
    database size (cumulative size of report contents) exceeds
    ${DHIMMIS_REPORT_EVICTION_MAXSIZE} MB, reports are also evicted in
    ascending order of last access time.
    '''
    try:
        deferral = int(os.environ.get('DHIMMIS_REPORT_EVICTION_DEFERRAL'))
    except TypeError:
        deferral = None

    try:
        maxsize = int(os.environ.get('DHIMMIS_REPORT_EVICTION_MAXSIZE'))
    except TypeError:
        maxsize = None

    if deferral is None and maxsize is None:
        logging.getLogger('flask.error').warning('Report eviction is not turned on, but the eviction check function was called.')
        return

    try:
        # get all reports
        with get_report_database() as db:
            db.execute(F'SELECT {", ".join(ReportTuple._fields)} FROM reports WHERE report_state <> ? ORDER BY last_access ASC;', ('evicted',))
            reports = list(map(lambda row: ReportTuple(*row), db.fetchall()))
            to_evict_deferral = list()
            to_evict_maxsize = list()
            today = date.today()

            if deferral is not None:
                for r in reports:
                    days = (today - r.last_access.date()).days
                    if days > deferral:
                        to_evict_deferral.add(r.uuid)

                logging.getLogger('flask.error').info('%d report%s will be evicted because they have not been accessed for %d days.',
                        len(to_evict_deferral),
                        '' if len(to_evict_deferral) == 1 else 's',
                        deferral)


            if maxsize is not None:
                maxsize = 1000000 * maxsize  # in bytes
                # get total size
                totalsize = 0
                candidates = []
                for r in filter(lambda r: r.uuid not in to_evict_deferral, reports):
                    size = 0
                    if r.content is not None:
                        size += len(bytes(r.content))
                    if r.pdf_map is not None:
                        size += len(bytes(r.pdf_map))
                    if r.pdf_report is not None:
                        size += len(bytes(r.pdf_report))

                    candidates.append((r, size))
                    totalsize += size

                rmsize = 0
                if totalsize > maxsize:
                    exceed = totalsize - maxsize
                    for r, size in candidates:
                        if exceed - rmsize <= 0:
                            break

                        rmsize += size
                        to_evict_maxsize.add(r.uuid)

                logging.getLogger('flask.error').info('%d report%s (%.1fMB) will be evicted to reduce database size below %dMB.',
                        len(to_evict_maxsize),
                        '' if len(to_evict_maxsize) == 1 else 's',
                        rmsize / 1000000, maxsize // 1000000)


            for uuid in [*to_evict_deferral, *to_evict_maxsize]:
                evict_report(uuid)


    except:
        tb = traceback.format_exc()
        logging.getLogger('flask.error').error('Something went wrong while checking for report evictions: %s', tb)
