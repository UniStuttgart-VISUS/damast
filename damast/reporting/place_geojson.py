import jinja2
import flask
import re
import operator
from psycopg2.extras import NumericRange
import logging
import sys
import traceback
import werkzeug.exceptions

from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .init_post import init_post
from .collect_report_data import collect_report_data, create_filter_list
from ..postgres_database import postgres_database

blueprint = AuthenticatedBlueprintPreparator('geojson', __name__, static_folder=None, template_folder=None)

@blueprint.route('/geojson', role=['reporting', 'dev', 'admin', 'vis'], methods=['POST'])
def get_geojson():
    filter_json, err = init_post()
    if err is not None:
        return err

    pg = postgres_database()
    try:
        with pg.get_cursor(readonly=True) as cursor:
            q_filters = create_filter_list(cursor, filter_json['filters'])
            evidence_data = collect_report_data(cursor, q_filters, filter_json['filters']['religion'])

            return flask.jsonify(evidence_data)

    except:
        logging.getLogger('flask.error').error("%s: %s\n\t%s", str(sys.exc_info()[0].__name__), sys.exc_info()[1], '\t'.join(traceback.format_exception(*sys.exc_info())))
        raise werkzeug.exceptions.InternalServerError(F'{ sys.exc_info()[0].__name__ }: { sys.exc_info()[1] }')