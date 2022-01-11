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
from .report_database import ReportTuple, get_report_database, start_report
from .datatypes import Evidence, Place


static = __path__[0] + '/static'
template = './templates'
app = AuthenticatedBlueprintPreparator('reporting', __name__, template_folder=template, static_folder=None)
app.register_blueprint(filter_blueprint)

@app.route('/', role=['reporting', 'dev', 'admin'], methods=['GET'])
def root():
    return flask.render_template('reporting/index.html')

def load_schema(uri):
    root_path = 'https://www2.visus.uni-stuttgart.de/damast/vis/schemas/'
    if uri.startswith(root_path):
        path = uri.replace(root_path, '')
        schema_path = os.path.join(flask.current_app.root_path, 'vis/static/schemas', path)

        with open(schema_path) as f:
            schema = json.load(f)
            return schema

    raise UserError(F'Could not load schema at {uri}')


def init_post():
    if flask.request.content_type is None:
        raise werkzeug.exceptions.BadRequest('Request must have either a JSON payload or a JSON file attached as multipart/form-data.')

    if 'application/json' in flask.request.content_type:
        filter_json = flask.request.json
    elif 'multipart/form-data' in flask.request.content_type:
        filter_json = json.load(flask.request.files['filter_file'])
    else:
        raise werkzeug.exceptions.BadRequest('Request must have either a JSON payload or a JSON file attached as multipart/form-data.')

    schema = load_schema('https://www2.visus.uni-stuttgart.de/damast/vis/schemas/exportable-filters.json')
    r = jsonschema.RefResolver('https://www2.visus.uni-stuttgart.de/damast/vis/schemas/',
        'https://www2.visus.uni-stuttgart.de/damast/vis/schemas/exportable-filters.json',
        handlers=dict(http=load_schema, https=load_schema), cache_remote=False)
    v = jsonschema.Draft7Validator(schema, resolver=r)

    if not v.is_valid(filter_json):
        errors = [ ( '/' + '/'.join(map(str, e.path)), e.message ) for e in v.iter_errors(filter_json) ]
        return None, (flask.render_template('reporting/422.html', errors=errors), 422)

    return filter_json, None


def _start_report(filter_json):
    current_user = flask.current_app.auth.current_user().name
    u = start_report(current_user, flask.current_app.version, filter_json)
    response = flask.redirect(flask.url_for('reporting.get_report', report_id=u))

    return response


@app.route('/', role=['reporting', 'dev', 'admin'], methods=['POST'])
def create_report():
    filter_json, err = init_post()
    if err is not None:
        return err

    return _start_report(filter_json)


@app.route('/static/<path:path>', role=['reporting', 'dev', 'admin'])
def file(path):
    return flask.current_app.serve_static_file(static, path)


@app.route('/describe-filters', methods=['POST'], role=['reporting', 'dev', 'admin', 'vis'])
@rest_endpoint
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
    with get_report_database() as db:
        db.execute(F'SELECT {", ".join(ReportTuple._fields)} FROM reports WHERE uuid = ?;', (report_id,))
        row = db.fetchone()
        if row is None:
            flask.abort(404)
        tpl = ReportTuple(*row)

        if 'admin' not in current_user.roles and current_user.name != tpl.user:
            flask.abort(404)

        return tpl


@app.route('/<string:report_id>', role=['reporting', 'dev', 'admin'], methods=['GET'])
def get_report(report_id):
    report = get_report_data(report_id)
    if report.content is None:
        # wait
        time_passed = (datetime.now().astimezone() - report.started).total_seconds()
        if time_passed < 15:
            delay = 3
        elif time_passed < 120:
            delay = 20
        else:
            delay = 60

        return flask.render_template('reporting/wait.html', delay=delay)

    else:
        if report.report_state == 'completed':
            errorcode = 200
        elif report.report_state == 'failed':
            errorcode = 410
        else:
            errorcode = 500

        content = gzip.decompress(report.content).decode('utf-8')
        has_pdf = (report.pdf_report is not None)
        return flask.render_template('reporting/report.html', content=content, report_id=report_id, has_pdf=has_pdf), errorcode


@app.route('/<string:report_id>/map', role=['reporting', 'dev', 'admin'], methods=['GET'])
def get_map(report_id):
    report = get_report_data(report_id)
    if report.pdf_map is None:
        flask.abort(404)

    if report.report_state == 'failed':
        flask.abort(410, 'The report could not be completed.')

    pdf = BytesIO(report.pdf_map)
    fname = F'map_{report_id}.pdf'

    response = flask.send_file(pdf, mimetype='application/pdf', as_attachment=True, attachment_filename=fname)
    response.headers['Content-Encoding'] = 'gzip'
    response.direct_passthrough = False

    return response


@app.route('/<string:report_id>/pdf', role=['reporting', 'dev', 'admin'], methods=['GET'])
def get_pdf_report(report_id):
    report = get_report_data(report_id)
    if report.pdf_report is None:
        flask.abort(404)

    if report.report_state == 'failed':
        flask.abort(410, 'The report could not be completed.')

    pdf = BytesIO(report.pdf_report)
    fname = F'{report_id}.pdf'

    response = flask.send_file(pdf, mimetype='application/pdf', as_attachment=True, attachment_filename=fname)
    response.headers['Content-Encoding'] = 'gzip'
    response.direct_passthrough = False

    return response


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

            if r.completed is None:
                started = r.started.astimezone().strftime('%Y-%m-%d %H:%M')
                completed = None
                duration = None
                duration_fmt = None
            else:
                started = None
                completed = r.completed.astimezone().strftime('%Y-%m-%d %H:%M')
                delta = r.completed - r.started

                secs = delta.total_seconds()
                dur = []
                dur2 = []
                t = secs % 60
                dur.append(F'{t:.0f}&thinsp;s')
                dur2.append(F'{t:.0f}S')
                secs //= 60
                if secs > 0:
                    t = secs % 60
                    dur.append(F'{t:.0f}&thinsp;min')
                    dur2.append(F'{t:.0f}M')

                    secs //= 60
                    if secs > 0:
                        t = secs
                        dur.append(F'{t:.0f}&thinsp;h')
                        dur2.append(F'{t:.0f}H')

                duration_fmt = ' '.join(dur[::-1])
                duration = 'P' + ''.join(dur2[::-1])


            filt = json.loads(gzip.decompress(r.filter))
            original_evidence_count = filt['metadata']['evidenceCount']

            report.update(dict(started_fmt=started,
                completed_fmt=completed,
                duration=duration,
                duration_fmt=duration_fmt,
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
