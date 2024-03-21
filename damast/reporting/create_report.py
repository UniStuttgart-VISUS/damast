from postgres import Postgres
import urllib.parse
import os
import os.path
import json
import logging
import gzip
import traceback
import psycopg2
import operator
import psycopg2.extras
from psycopg2.extras import NumericRange
import math
from logging.handlers import TimedRotatingFileHandler
from io import BytesIO
from datetime import datetime
import dateutil.parser
from functools import lru_cache, namedtuple
import subprocess
import re
import tempfile

from .create_map import create_map
from .report_database import ReportTuple, get_report_database, start_report
from .datatypes import Evidence, Place
from .verbalize_filters import verbalize, get_filter_description
from .verbalize_filters_tex import get_filter_description as get_filter_description_tex
from .filters import blueprint as filter_blueprint

import sys
import pathlib
import flask
import shutil

from jinja2 import Template, Environment, FileSystemLoader, pass_context
import jinja2.exceptions

from .report_database import get_report_database, DatabaseVersion
from ..postgres_database import postgres_database
from .tex import render_tex_report
from .html import render_html_report
from .place_sort import sort_placenames, sort_alternative_placenames, sort_evidence
from .eviction import does_evict
from .collect_report_data import collect_report_data, create_filter_list

from ..config import get_config


conf = get_config()


def get_database_version_info(report_uuid):
    # if no eviction happens, we do not care about database version either
    if not does_evict():
        return None

    with get_report_database() as db:
        db.execute(F'SELECT {", ".join(DatabaseVersion._fields)} FROM database_version ORDER BY version ASC;')
        versions = list(map(lambda tpl: DatabaseVersion(*tpl), db.fetchall()))

        if len(versions) == 0:
            raise RuntimeError('Report eviction is turned on, but no database versions are given in the report database.')

        db.execute('SELECT R.database_version, V.date FROM reports R JOIN database_version V ON R.database_version = V.version WHERE uuid = ?;', (report_uuid,))
        (reportversion, date) = db.fetchone()

        # if the version is the last one, we can ignore it
        if reportversion == versions[-1].version:
            return None

        logging.getLogger('flask.error').warning('Report %s was originally generated with database version %d (%s), but the current version is %d (%s). Will add the appropriate disclaimers to the report contents.',
                report_uuid,
                reportversion,
                date.strftime('%Y-%m-%d'),
                versions[-1].version,
                versions[-1].date.strftime('%Y-%m-%d'))

        return dict(
                original_version=reportversion,
                versions=versions
                )



def create_report(pg, filter_json, current_user, started, report_uuid, report_url, map_url, directory):
    try:
        with pg.get_cursor(readonly=True) as cursor:
            filters = filter_json['filters']
            q_filters = create_filter_list(cursor, filters)

            evidence_ids = []
            evidence_data = collect_report_data(cursor, q_filters, filters['religion'])


            all_religions = evidence_data['all_religions']
            religions = evidence_data['religions']
            evidences = evidence_data['evidences']
            places = evidence_data['places']
            evidence_ids = evidence_data['evidence_ids']


            place_map, map_pdf = create_map(places, evidences, religions, all_religions)

            # metadata
            _fmt = '%A, %B %-d, %Y, at %H:%M %Z'
            current_time_ = started.astimezone()
            current_time = current_time_.strftime(_fmt)
            current_time_machine = current_time_.isoformat()
            current_time_short = current_time_.strftime('%B %-d, %Y')
            export_user = filter_json['metadata']['createdBy']
            export_time_ = dateutil.parser.parse(filter_json['metadata']['createdAt']).astimezone()
            export_time = export_time_.strftime(_fmt)
            export_time_machine = export_time_.isoformat()
            source = filter_json['metadata']['source']

            # filter info
            filter_desc = get_filter_description(filters, cursor)
            filter_desc_tex = get_filter_description_tex(filters, cursor)

            # check database versions
            dbversiondata = get_database_version_info(report_uuid)

            metadata = dict(current_user=current_user,
                    current_time=current_time,
                    current_time_short=current_time_short,
                    current_time_machine=current_time_machine,
                    export_user=export_user,
                    export_time=export_time,
                    export_time_machine=export_time_machine,
                    source=source,
                    evidence_count=filter_json['metadata']['evidenceCount'])

            context = dict(
                    **evidence_data,
                    metadata=metadata,
                    filter_desc=filter_desc,
                    report_id=report_uuid,
                    server_version=conf.version,
                    place_map=place_map,
                    map_url=map_url,
                    report_url=report_url,
                    dbversiondata=dbversiondata,
                    )

            content = render_html_report(context)
            context.update(dict(filter_desc=filter_desc_tex))
            tex_content = render_tex_report(context)
            pdf_report = generate_pdf(tex_content, map_pdf, directory)

            pdfmap = gzip.compress(map_pdf)
            reportpdf = gzip.compress(pdf_report)

            report_state = 'completed'

    except:
        logging.getLogger('flask.error').error("%s: %s\n\t%s", str(sys.exc_info()[0].__name__), sys.exc_info()[1], '\t'.join(traceback.format_exception(*sys.exc_info())))
        content = Template('<p class="error-message"><i class="fa fa-fw fa-exclamation-triangle fa-lg"></i> {{ tp }}: {{ msg }}</p>').render(tp=sys.exc_info()[0].__name__, msg=sys.exc_info()[1])
        pdfmap = None
        reportpdf = None
        report_state = 'failed'

    finally:
        now = datetime.now().replace(microsecond=0).astimezone().isoformat()
        content = gzip.compress(content.encode('utf-8'))

        with get_report_database() as db:
            db.execute('''UPDATE reports
                    SET content = :content,
                        pdf_map = :pdf_map,
                        pdf_report = :pdf_report,
                        completed = :completed,
                        evidence_count = :evidence_count,
                        report_state = :report_state
                    WHERE uuid = :uuid AND user = :user;''', dict(
                        content = content,
                        pdf_map = pdfmap,
                        pdf_report = reportpdf,
                        completed = now,
                        evidence_count = len(evidence_ids),
                        uuid = report_uuid,
                        user = current_user,
                        report_state = report_state,
                        ))


def generate_pdf(tex_content, map_pdf, directory):
    with open(os.path.join(directory, 'report.tex'), 'w') as f:
        f.write(tex_content)
    with open(os.path.join(directory, 'map.pdf'), 'wb') as f:
        f.write(map_pdf)

    for i in (1,2):
        proc = subprocess.run(['xelatex', '-interaction=nonstopmode', 'report.tex'],
                    cwd=directory,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    encoding='utf-8')

        if proc.returncode != 0:
            logging.getLogger('flask.error').error('Error compiling LaTeX:\n%s', proc.stdout)
            raise ChildProcessError('Error compiling LaTeX document.')

    with open(os.path.join(directory, 'report.pdf'), 'rb') as f:
        report = f.read()
        return report


def fail(msg):
    logging.getLogger('flask.error').error(msg)
    sys.exit(1)


if __name__ == '__main__':
    error_logger = logging.getLogger('flask.error')
    _err_handler = TimedRotatingFileHandler(
        conf.error_log,
        when='midnight',
        interval=1,
        backupCount=10)
    _err_handler.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] [PID %(process)s] %(message)s',
        datefmt='%Y-%m-%dT%H:%M:%S %z'))
    error_logger.addHandler(_err_handler)
    error_logger.setLevel(logging.INFO)

    if len(sys.argv) != 4:
        fail('Not the appropriate number of arguments: ' + ' '.join(sys.argv))

    directory = tempfile.mkdtemp()

    report_uuid = sys.argv[1]
    report_url = sys.argv[2]
    map_url = sys.argv[3]

    try:
        with get_report_database() as db:
            db.execute('SELECT user, filter, started FROM reports WHERE uuid = :u;', dict(u=report_uuid))
            username, filter_gzip, started = db.fetchone()
            filters = json.loads(gzip.decompress(filter_gzip))

            pg = postgres_database()
            create_report(pg, filters, username, started, report_uuid, report_url, map_url, directory)

    except Exception as err:
        now = datetime.now().replace(microsecond=0).astimezone().isoformat()
        content = Template('<p class="error-message"><i class="fa fa-fw fa-exclamation-triangle fa-lg"></i> {{ msg }}</p>').render(msg=str(err))
        content = gzip.compress(content.encode('utf-8'))
        with get_report_database() as db:
            db.execute('UPDATE reports SET content = :content, completed = :now, report_state = :state WHERE uuid = :uuid;', dict(content=content, now=now, state='failed', uuid=report_uuid))

        fail(F'Error occurred during report generation: {err}')

    finally:
        shutil.rmtree(directory)

