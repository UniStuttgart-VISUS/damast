import flask
import werkzeug.exceptions
import os.path
import json
import jsonschema
import subprocess
import psycopg2.extras
import math
import sqlite3
import uuid
import logging
import traceback
import sys
import os
import gzip
from io import BytesIO
from datetime import datetime
import dateutil.parser
from functools import lru_cache, namedtuple
from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from ..postgres_rest_api.decorators import rest_endpoint
from .verbalize_filters import verbalize, get_filter_description

from .filters import blueprint as filter_blueprint
from .place_geojson import blueprint as geojson_blueprint
from .report_database import ReportTuple, get_report_database, start_report, update_report_access, recreate_report_after_evict, evict_report as do_evict_report
from .datatypes import Evidence, Place
from .init_post import init_post


static = __path__[0] + '/static'
template = './templates'
app = AuthenticatedBlueprintPreparator('reporting', __name__, template_folder=template, static_folder=None)
app.register_blueprint(filter_blueprint)
app.register_blueprint(geojson_blueprint)

@app.route('/', role=['reporting', 'dev', 'admin'], methods=['GET'])
def root():
    return flask.render_template('reporting/index.html')




def _start_report(filter_json):
    current_user = flask.current_app.auth.current_user()
    username = current_user.name if not current_user.visitor else 'visitor'
    u = start_report(username, flask.current_app.version, filter_json)
    response = flask.redirect(flask.url_for('reporting.get_report', report_id=u))

    return response


@app.route('/', role=['reporting', 'dev', 'admin'], methods=['POST'])
def create_report():
    filter_json, err = init_post()
    if err is not None:
        return err

    return _start_report(filter_json)


@app.route('/redirect-to-report-from-uuid', role=['reporting', 'dev', 'admin'], methods=['GET'])
def report_by_uuid():
    report_id = flask.request.args.get('uuid', '')

    # check if valid UUID
    try:
        u = uuid.UUID(report_id)
        return flask.redirect(flask.url_for('reporting.get_report', report_id=str(u)))

    except ValueError:
        raise werkzeug.exceptions.BadRequest('Request must have a uuid parameter that is a valid UUID.')


@app.route('/static/<path:path>', role=['reporting', 'dev', 'admin'])
def file(path):
    return flask.current_app.serve_static_file(static, path)


@app.route('/describe-filters', methods=['POST'], role=['reporting', 'dev', 'admin', 'vis'])
@rest_endpoint(['POST'])
def describe_filters(cursor):
    filter_json, err = init_post()
    if err is not None:
        return err

    filters = filter_json['filters']
    desc = get_filter_description(filters, cursor)

    return flask.render_template('reporting/describe-filters.html',
            filter_desc=desc,
            evidence_count=filter_json['metadata']['evidenceCount'])


def get_report_data(report_id):
    current_user = flask.current_app.auth.current_user()
    username = current_user.name if not current_user.visitor else 'visitor'
    with get_report_database() as db:
        db.execute(F'SELECT {", ".join(ReportTuple._fields)} FROM reports WHERE uuid = ?;', (report_id,))
        row = db.fetchone()
        if row is None:
            flask.abort(404)
        tpl = ReportTuple(*row)

        if 'admin' not in current_user.roles and username != tpl.user:
            flask.abort(404)

        return tpl


def _wait_for_report(endpoint, report_id):
    try:
        delay = int(flask.request.args.get('t'))
    except:
        delay = 5

    next_delay = min(60, int(1.5*delay))
    url = flask.url_for(endpoint, report_id=report_id)

    return flask.render_template('reporting/wait.html', delay=delay, next_delay=next_delay, url=url)

@app.route('/<string:report_id>.html', role=['reporting', 'dev', 'admin'], methods=['GET'])
def get_report(report_id):
    report = get_report_data(report_id)

    if report.report_state == 'started':
        return _wait_for_report('reporting.get_report', report_id)
    elif report.report_state == 'evicted':
        recreate_report_after_evict(report_id)
        return _wait_for_report('reporting.get_report', report_id)
    elif report.report_state in ('failed', 'completed'):
        if report.report_state == 'completed':
            errorcode = 200
        else:
            errorcode = 410

        content = gzip.decompress(report.content).decode('utf-8')
        has_pdf = (report.pdf_report is not None)

        update_report_access(report_id)

        return flask.render_template('reporting/report.html', content=content, report_id=report_id, has_pdf=has_pdf), errorcode
    else:
        flask.abort(500, F'Unknown report state reached: {report.report_state}')



@app.route('/map_<string:report_id>.pdf', role=['reporting', 'dev', 'admin'], methods=['GET'])
def get_map(report_id):
    report = get_report_data(report_id)

    if report.report_state == 'started':
        return _wait_for_report('reporting.get_map', report_id)
    elif report.report_state == 'evicted':
        recreate_report_after_evict(report_id)
        return _wait_for_report('reporting.get_map', report_id)
    elif report.report_state in ('failed', 'completed'):
        if report.pdf_map is None:
            flask.abort(404)
        elif report.report_state == 'failed':
            flask.abort(410, 'The report could not be completed.')

        pdf = BytesIO(report.pdf_map)

        response = flask.send_file(pdf, mimetype='application/pdf')
        response.headers['Content-Encoding'] = 'gzip'
        response.direct_passthrough = False

        update_report_access(report_id)

        return response

    else:
        flask.abort(500, F'Unknown report state reached: {report.report_state}')



@app.route('/<string:report_id>.pdf', role=['reporting', 'dev', 'admin'], methods=['GET'])
def get_pdf_report(report_id):
    report = get_report_data(report_id)

    if report.report_state == 'started':
        return _wait_for_report('reporting.get_pdf_report', report_id)
    elif report.report_state == 'evicted':
        recreate_report_after_evict(report_id)
        return _wait_for_report('reporting.get_pdf_report', report_id)
    elif report.report_state in ('failed', 'completed'):
        if report.pdf_report is None:
            flask.abort(404)
        elif report.report_state == 'failed':
            flask.abort(410, 'The report could not be completed.')

        pdf = BytesIO(report.pdf_report)

        response = flask.send_file(pdf, mimetype='application/pdf')
        response.headers['Content-Encoding'] = 'gzip'
        response.direct_passthrough = False

        update_report_access(report_id)

        return response

    else:
        flask.abort(500, F'Unknown report state reached: {report.report_state}')


## routes for old URLs, so that they still work for older bookmarks
@app.route('/<string:report_id>', role=['reporting', 'dev', 'admin'], methods=['GET'])
def _get_report_old(report_id):
    return flask.redirect(flask.url_for('reporting.get_report', report_id=report_id), 301)

@app.route('/<string:report_id>/pdf', role=['reporting', 'dev', 'admin'], methods=['GET'])
def _get_pdf_old(report_id):
    return flask.redirect(flask.url_for('reporting.get_pdf_report', report_id=report_id), 301)

@app.route('/<string:report_id>/map', role=['reporting', 'dev', 'admin'], methods=['GET'])
def _get_map_old(report_id):
    return flask.redirect(flask.url_for('reporting.get_map', report_id=report_id), 301)


@app.route('/list', role=['reporting', 'dev', 'admin'])
def list_available_reports():
    current_user = flask.current_app.auth.current_user()
    if current_user.visitor:
        flask.abort(401)

    with get_report_database() as db:
        restriction = '' if 'admin' in current_user.roles else 'WHERE user = :user'
        db.execute(F'SELECT count(*) FROM reports {restriction};', dict(user=current_user.name))
        (count,) = db.fetchone()

        limit = 20
        offset = int(flask.request.args.get('offset', 0))
        if count > 0 and offset > count-1:
            return flask.redirect(flask.url_for('.list_available_reports'))
        if offset < 0:
            offset = 0

        has_next_page = (offset + limit) < count
        has_prev_page = offset > 0

        next_page_offset = offset + limit
        prev_page_offset = max(0, offset - limit)

        last_page_offset = count - (count % limit)

        query = F'SELECT {", ".join(ReportTuple._fields)} FROM reports {restriction} ORDER BY started DESC LIMIT :limit OFFSET :offset;'

        reports_ = map(lambda x: ReportTuple(*x), db.execute(query, dict(user=current_user.name, limit=limit, offset=offset)))

        reports = []
        for r in reports_:
            report = r._asdict()
            started = r.started.astimezone().strftime('%Y-%m-%d')
            acc = r.last_access.astimezone().strftime('%Y-%m-%d')

            filt = json.loads(gzip.decompress(r.filter))
            original_evidence_count = filt['metadata']['evidenceCount']

            report.update(dict(started_fmt=started,
                last_access=acc,
                original_evidence_count=original_evidence_count,
                ))
            reports.append(report)


        return flask.render_template('reporting/report_list.html',
                reports=reports,
                offset=offset,
                has_next_page = has_next_page,
                has_prev_page = has_prev_page,
                next_page_offset = next_page_offset,
                prev_page_offset = prev_page_offset,
                last_page_offset = last_page_offset,
                )


def _get_report_filter_json(report_id):
    report = get_report_data(report_id)

    filt = json.loads(gzip.decompress(report.filter))
    filt['metadata'].update(dict(
        createdAt=report.started.astimezone().isoformat(),
        createdBy=report.user,
        evidenceCount=report.evidence_count,
        source=report.uuid,
        ))

    return filt


@app.route('/<string:report_id>/filter', role=['reporting', 'dev', 'admin'], methods=['GET'])
def get_report_filter(report_id):
    filt = _get_report_filter_json(report_id)
    return flask.jsonify(filt)


@app.route('/<string:report_id>/rerun', role=['reporting', 'dev', 'admin'], methods=['GET'])
def rerun_report(report_id):
    filt = _get_report_filter_json(report_id)
    return _start_report(filt)


@app.route('/<string:report_id>/evict', role=['admin'], methods=['GET'])
def evict_report(report_id):
    do_evict_report(report_id)
    return flask.redirect(flask.url_for('reporting.list_available_reports'))
