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

    details = 'details' in flask.request.args

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

                uripath = flask.url_for('uri.place.get_place', place_id=place.place.id)
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
                        coordinates=[coordinates['lng'], coordinates['lat']],
                    ) if coordinates is not None else None,
                )

                geojson_places.append(feature)


            if details:
                evidence_lut = { e.evidence.id: e.evidence for e in evidence_data['evidences'] }

                for place_data in evidence_data['places']:
                    properties = geojson_place_properties[place_data.place.id]

                    properties['external_uris'] = [ d.uri for d in place_data.external_uris ]
                    properties['alternative_names'] = [ d._asdict() for d in place_data.alternative_names ]

                    # religious groups present (evidence)
                    evidences = []
                    for eid in place_data.place.evidence_ids:
                        e = evidence_lut[eid]
                        evidence = dict(
                            id=e.id,
                            comment=e.evidence_comment,
                            interpretation_confidence=e.interpretation_confidence,
                            place_attribution_confidence=e.place_attribution_confidence,
                            place_instance_comment=e.place_instance_comment,
                            religion=e.religion,
                            religion_confidence=e.religion_confidence,
                            religion_instance_comment=e.religion_instance_comment,
                            time_spans=[
                                dict(
                                    span=v['span'],
                                    confidence=v['confidence'],
                                    comment=v['comment'],
                                ) for v in e.time_instances
                            ],
                        )

                        evidences.append(evidence)

                    properties['evidence'] = evidences


            current_user = flask.current_app.auth.current_user()
            username = current_user.name if not current_user.visitor else 'visitor'

            _url = urlparse(flask.request.base_url)
            _path = flask.url_for('root-app.root')
            base_url = _url._replace(query='', fragment='', path=_path).geturl()

            geojson = dict(
                type='FeatureCollection',
                properties=dict(
                    data_license='''Creative Commons By-Attribution 4.0 (CC BY 4.0)''',
                    data_citation='''Weltecke, Dorothea; Koch, Steffen; Barczok, Ralph; Franke, Max; Vest, Bernd Andreas, 2022, "Data Collected During the Digital Humanities Project 'Dhimmis & Muslims - Analysing Multireligious Spaces in the Medieval Muslim World'", https://doi.org/10.18419/darus-2318, DaRUS, V1.''',
                    how_to_cite=F'''Weltecke, Dorothea, Steffen Koch, Ralph Barczok, Max Franke, Florian Jäckel, and Bernd A. Vest, eds. Damast – A Research System to Analyze Multi-Religious Constellations in the Islamicate World. April 2022. Accessed {datetime.date.today():%B %_d, %Y}. {base_url}, data deposited at DaRUS, https://doi.org/10.18419/darus-2318.''',
                    how_to_cite_see_also=F'{base_url}#how-to-cite',

                    damast_version=config.version,
                    user=username,
                    time=datetime.datetime.utcnow().isoformat(sep='T'),
                    base_url=base_url,
                    query_filter=filter_json['filters'],
                    requested_details=details,
                ),
                features=geojson_places,
            )

            return flask.jsonify(geojson)

    except:
        logging.getLogger('flask.error').error("%s: %s\n\t%s", str(sys.exc_info()[0].__name__), sys.exc_info()[1], '\t'.join(traceback.format_exception(*sys.exc_info())))
        raise werkzeug.exceptions.InternalServerError(F'{ sys.exc_info()[0].__name__ }: { sys.exc_info()[1] }')