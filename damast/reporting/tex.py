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
from .fontspec import get_fontspec

import sys
import pathlib
import flask
import shutil

from jinja2 import Template, Environment, FileSystemLoader, pass_context

from .filters import range_match, geoloc_regex


@pass_context
def render_int4range(context, value):
    if value is None or value == 'empty':
        return '\emph{empty range}'

    r = range_match.fullmatch(value)
    bounds = F'{r.group("open")}{r.group("close")}'
    start = None if r.group('start') == '' else int(r.group('start'))
    end = None if r.group('end') == '' else int(r.group('end'))

    span = NumericRange(start, end, bounds)

    if span.isempty:
        return '\emph{empty range}'

    a = span.lower if span.lower_inc or span.lower_inf else span.lower + 1
    b = span.upper if span.upper_inc or span.upper_inf else span.upper - 1

    if a is None and b is None:
        return '\emph{empty range}'
    elif a == b:
        return 'in \\textbf{%d}' % a
    elif span.upper_inf:
        return 'from \\textbf{%d} on' % a
    elif span.lower_inf:
        return 'until \\textbf{%d} on' % b
    else:
        return 'from \\textbf{%d} until \\textbf{%d}' % (a, b)


@pass_context
def sort_int4range(context, value):
    empties = []
    vals = []
    for v in value:
        s = v['span']

        if s is None or s == 'empty':
            empties.append(v)
            continue

        r = range_match.fullmatch(s)
        bounds = F'{r.group("open")}{r.group("close")}'
        start = None if r.group('start') == '' else int(r.group('start'))
        end = None if r.group('end') == '' else int(r.group('end'))

        span = NumericRange(start, end, bounds)

        if span.isempty:
            empties.append(v)
        else:
            a = span.lower if span.lower_inc or span.lower_inf else span.lower + 1
            b = span.upper if span.upper_inc or span.upper_inf else span.upper - 1

            vals.append((v, a, b))

    vals = sorted(vals, key=operator.itemgetter(1,2))
    return [ *empties, *map(operator.itemgetter(0), vals) ]


@pass_context
def render_geoloc(context, value):
    if value is None:
        return '\emph{an unknown location}'

    r = geoloc_regex.fullmatch(value)
    if not r:
        raise ValueError(F'Value "{value}" is not a valid geolocation for rendering.')

    lat = float(r.group('lat'))
    lng = float(r.group('lng'))

    ns_hemi = 'N' if lat >= 0 else 'S'
    ew_hemi = 'E' if lng >= 0 else 'W'
    lat = abs(lat)
    lng = abs(lng)

    return '\\textbf{%s\\,%s$^{\\circ}$ %s\\,%s$^{\\circ}$}' % (ns_hemi, F'{lat:g}', ew_hemi, F'{lng:g}')

LATEX_SUBS = (
    (re.compile(r'\\'), r'\\textbackslash{}'),
    (re.compile(r'([{}_#%&$])'), r'\\\1'),
    (re.compile(r'~'), r'\~{}'),
    (re.compile(r'\^'), r'\^{}'),
    (re.compile(r'"'), r"''"),
    (re.compile(r'\.\.\.+'), r'\\ldots{}'),
    (re.compile(r'\s+$'), r' '),  # clean up trailing whitespace
    # (re.compile(r'/'), r'\/')
)

def texsafe(value):
    newval = value
    for pattern, replacement in LATEX_SUBS:
        newval = pattern.sub(replacement, newval)
    return newval


def placename(value):
    fs = get_fontspec(value)
    v = texsafe(value)
    if fs is None:
        return v

    else:
        return F'\\text{fs}{"{"}{v}{"}"}'



def render_tex_report(context):
    tex_environment = Environment(
            block_start_string='<%',
            block_end_string='%>',
            variable_start_string='<<',
            variable_end_string='>>',
            trim_blocks=True,
            loader=FileSystemLoader(os.path.join(pathlib.Path(__file__).parent.absolute(), 'templates')),
            )

    tex_environment.filters['render_int4range'] = render_int4range
    tex_environment.filters['render_geoloc'] = render_geoloc
    tex_environment.filters['sort_int4range'] = sort_int4range
    tex_environment.filters['texsafe'] = texsafe
    tex_environment.filters['placename'] = placename

    tex_template = tex_environment.get_template('reporting/tex/report_content.tex')
    tex_content = tex_template.render(**context)
    return tex_content
