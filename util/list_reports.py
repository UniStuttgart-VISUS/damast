#!/usr/bin/env python3

import datetime
import sqlite3
import argparse
import sys
import gzip
from functools import namedtuple
import re


_timezone = re.compile('\+(?P<hours>\d\d):(?P<minutes>\d\d)(:(?P<seconds>\d\d)(\.(?P<micros>\d+))?)?$')

def _decode_isoformat(val):
    if sys.version_info.major == 3 and sys.version_info.minor >= 7 and False:
        # >= 3.7
        return datetime.datetime.fromisoformat(val)

    m = _timezone.search(val)
    tzinfo = ''
    if m:
        tzinfo += '+'
        tzinfo += m['hours']
        tzinfo += m['minutes']

        if m['seconds'] is not None:
            tzinfo += m['seconds']

        if m['micros'] is not None:
            tzinfo += '.'
            tzinfo += m['micros']

    ts = val[:m.span()[0]] + tzinfo
    dt = datetime.datetime.strptime(ts, '%Y-%m-%dT%H:%M:%S%z')

    return dt


def _convert_datetime(val):
    if type(val) is bytes:
        return _decode_isoformat(val.decode('utf-8'))
    return None
sqlite3.register_converter('DATETIME', _convert_datetime)

ReportTuple = namedtuple('ReportTuple', ['uuid', 'user', 'server_version', 'report_state', 'started', 'completed', 'content', 'pdf_map', 'pdf_report', 'filter', 'evidence_count'])


def list_users(parsed, args, c):
    c.execute('SELECT  * FROM users;')
    print(F'{"USER ID":25s}  {"EXPIRES":>10s}  {"ROLES":40s}  {"COMMENT":20s}')
    for username, password, expires, roles, comment in c.fetchall():
        today = datetime.date.today()
        time_left = (expires - today).days if expires is not None else None
        _tls = F'{time_left:-5d}' if time_left is not None else '  inf'
        roles = roles or ''
        comment = comment or ''
        print(F'{username:30s}  {_tls}  {roles:40s}  {comment:20s}')


def fsize(b):
    if b is None:
        return ''

    sz = len(gzip.decompress(b))
    return _fsize(sz)

def _fsize(sz):
    pref = ['', 'k', 'M', 'G']
    i = 0
    while sz > 1000 and i < len(pref) - 1:
        sz /= 1000
        i += 1

    return F'{sz:.3g}{pref[i]}B'


def list_reports(parsed, cursor, replist):
    tbl = '{uuid:36s}  {user:12s}  {started:16s}  {report_state:9s}  {duration:>12s}  {count:>4s}  {html_size:>6s}  {pdf_size:>6s}  {map_size:>6s}'

    print(tbl.format(uuid='UUID', user='USER', started='STARTED', report_state='STATE',
        duration='DURATION', html_size='HTML', pdf_size='PDF', map_size='MAP', count='#EV'))

    for r in records:
        d = r._asdict()
        html_size = fsize(r.content)
        pdf_size = fsize(r.pdf_report)
        map_size = fsize(r.pdf_map)
        started = r.started.strftime('%Y-%m-%d %H:%M')

        if r.completed is None:
            duration = ''
        else:
            dur = int((r.completed - r.started).total_seconds())
            _d = []
            _d.append(F'{dur % 60}s')
            dur //= 60
            if dur > 1:
                t = dur % 60
                _d.append(F'{t}min')
                dur //= 60
                if dur > 1:
                    _d.append(F'{dur}h')
            duration = ' '.join(_d[::-1])

        count = str(r.evidence_count)

        d.update(dict(html_size=html_size, pdf_size=pdf_size,
            map_size=map_size, duration=duration, started=started,
            count=count))
        print(tbl.format(**d))

def delete_reports(parsed, cursor, replist):
    total = 0
    count = 0
    for r in replist:
        sz = 0
        for field in ('content', 'pdf_report', 'pdf_map'):
            if getattr(r, field) is not None:
                sz += len(gzip.decompress(getattr(r, field)))

        total += sz
        count += 1
        sz = _fsize(sz)

        cursor.execute('DELETE FROM reports WHERE uuid = :uuid;', dict(uuid=r.uuid))
        print(F'Delete report {r.uuid} ({sz}).')

    if count > 0:
        print()
    print(F'Deleted {count} reports ({_fsize(total)}).')


def backup_reports(parsed, cursor, replist):
    uuids = '(' + ','.join(map(lambda x: F"'{x.uuid}'", replist)) + ')'

    conn = sqlite3.connect(':memory:')
    cu = conn.cursor()
    cu.execute("ATTACH DATABASE '" + parsed.database.name + "' AS attached_db;")

    cu.execute('SELECT sql FROM attached_db.sqlite_master WHERE type=? and name=?;', ('table', 'reports'))
    sql_create_table = cu.fetchone()[0]
    cu.execute(sql_create_table)

    if len(replist) > 0:
        cu.execute(F'''INSERT INTO reports
                        SELECT * FROM attached_db.reports
                        WHERE uuid IN {uuids};''')

    conn.commit()
    cu.execute("DETACH DATABASE attached_db;")

    content = ('\n'.join(conn.iterdump())).encode('utf-8')

    if parsed.compress:
        content = gzip.compress(content, compresslevel=9)

    parsed.output.write(content)
    parsed.output.flush()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Manage users and passwords in a SQLite3 database')
    parser.add_argument('-d', '--database', type=argparse.FileType('r+b'), default='reports.db', help='SQLite3 database file')
    parser.add_argument('-u', '--user', help='Limit to user name', default=None, type=str)
    parser.add_argument('-s', '--state', help='Limit to report state', choices=['started', 'completed', 'failed'], default=None, type=str)


    subparsers = parser.add_subparsers(title='action', description='Action to do')

    p_list = subparsers.add_parser('list', help='List reports')
    p_list.set_defaults(func=list_reports)

    p_del = subparsers.add_parser('delete', help='Delete reports')
    p_del.set_defaults(func=delete_reports)

    p_backup = subparsers.add_parser('backup', help='Backup reports')
    p_backup.add_argument('output', help='Output file', type=argparse.FileType('wb'), default='-', nargs='?', action='store')
    p_backup.add_argument('-z', '--compress', help='Compress output', default=False, const=True, action='store_const')
    p_backup.set_defaults(func=backup_reports)

    parsed = parser.parse_args(sys.argv[1:])

    # by default, list
    if 'func' not in parsed:
        parsed = parser.parse_args([*sys.argv[1:], 'list'])

    if 'func' in parsed:
        filters = []
        if parsed.user is not None:
            filters.append('user = :user')

        if parsed.state is not None:
            filters.append('report_state = :state')

        if len(filters) > 0:
            filt = ' WHERE ' + ' AND '.join(filters) + ' '
        else:
            filt = ''

        query = F'SELECT {", ".join(ReportTuple._fields)} FROM reports{filt};'

        conn = sqlite3.connect(parsed.database.name, detect_types=sqlite3.PARSE_DECLTYPES)
        c = conn.cursor()

        c.execute(query, dict(user=parsed.user, state=parsed.state))

        records = [ ReportTuple(*v) for v in c.fetchall() ]

        parsed.func(parsed, c, records)

        conn.commit()
        conn.close()

    else:
        parser.print_help()
        sys.exit(1)
