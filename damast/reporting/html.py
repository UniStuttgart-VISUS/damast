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
from .verbalize_filters import verbalize
import subprocess
import re

from .create_map import create_map
from .report_database import ReportTuple, get_report_database, start_report
from .datatypes import Evidence, Place
from .verbalize_filters import verbalize, get_filter_description
from .filters import blueprint as filter_blueprint

import sys
import pathlib
import flask
import shutil

from jinja2 import Template, Environment, FileSystemLoader, pass_context

from .filters import render_int4range, render_geoloc, sort_int4range


def render_html_report(context):
    environment = Environment(
            loader=FileSystemLoader(os.path.join(pathlib.Path(__file__).parent.absolute(), 'templates')),
            )

    environment.filters['render_int4range'] = render_int4range
    environment.filters['render_geoloc'] = render_geoloc
    environment.filters['sort_int4range'] = sort_int4range

    template = environment.get_template('reporting/report_content.html')
    content = template.render(**context)
    return content
