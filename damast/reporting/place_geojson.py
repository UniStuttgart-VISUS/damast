import jinja2
import flask
import re
import operator
from psycopg2.extras import NumericRange
import logging
import sys
import traceback
import werkzeug.exceptions
import datetime
from urllib.parse import urlparse
import os.path

from ..authenticated_blueprint_preparator import AuthenticatedBlueprintPreparator
from .init_post import init_post
from .collect_report_data import collect_report_data, create_filter_list
from ..postgres_database import postgres_database
from ..postgres_rest_api.place import parse_geoloc
from ..config import get_config

blueprint = AuthenticatedBlueprintPreparator('geojson', __name__, static_folder=None, template_folder=None)

@blueprint.route('/geojson', role=['reporting', 'dev', 'admin', 'vis'], methods=['POST'])
def get_geojson():
    filter_json, err = init_post()
    if err is not None:
        return err

    # TODO: as REST API parameter
    details = True

    pg = postgres_database()
    try:
        with pg.get_cursor(readonly=True) as cursor:
            q_filters = create_filter_list(cursor, filter_json['filters'])
            evidence_data = collect_report_data(cursor, q_filters, filter_json['filters']['religion'])

            geojson_places = []
            geojson_place_properties = dict()

            config = get_config()
            url = urlparse(flask.request.base_url)

            for place in evidence_data['places']:
                coordinates = parse_geoloc(place.place.geoloc)

                uripath = os.path.normpath(os.path.join(
                    config.proxyprefix,
                    './' + flask.url_for('uri.place.get_place', place_id=place.place.id),  # must be relative
                    ))
                uri = url._replace(query='', fragment='', path=uripath).geturl()

                properties = dict(
                    id=place.place.id,
                    name=place.place.name,
                    uri=uri,
                    comment=place.place.comment,
                    location_confidence=place.place.confidence,
                    type=place.place.place_type,
                )
                geojson_place_properties[place.place.id] = properties

                feature = dict(
                    type='Feature',
                    properties=properties,
                    geometry=dict(
                        type='Point',
                        coordinates=[0,0] if coordinates is None else [coordinates['lng'], coordinates['lat']],
                    ),
                )

                geojson_places.append(feature)


            current_user = flask.current_app.auth.current_user()
            username = current_user.name if not current_user.visitor else 'visitor'
            geojson = dict(
                type='FeatureCollection',
                properties=dict(
                    query_filter=filter_json['filters'],
                    damast_version=config.version,
                    user=username,
                    time=datetime.datetime.utcnow().isoformat(sep='T'),
                    base_url=flask.request.base_url.removesuffix(flask.url_for('reporting.geojson.get_geojson')),
                ),
                features=geojson_places,
            )

            return flask.jsonify(geojson)

    except:
        logging.getLogger('flask.error').error("%s: %s\n\t%s", str(sys.exc_info()[0].__name__), sys.exc_info()[1], '\t'.join(traceback.format_exception(*sys.exc_info())))
        raise werkzeug.exceptions.InternalServerError(F'{ sys.exc_info()[0].__name__ }: { sys.exc_info()[1] }')