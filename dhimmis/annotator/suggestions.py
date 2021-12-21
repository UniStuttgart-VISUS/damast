import flask
import urllib.parse
import werkzeug.exceptions
import logging
import re
import os
import os.path
import pathlib
import sys
import datetime
import json
from io import BytesIO
from Levenshtein import ratio
from psycopg2.extras import NumericRange
from itertools import repeat
from multiprocessing import Pool
from functools import namedtuple, reduce
from logging.handlers import TimedRotatingFileHandler
import subprocess
import hashlib

from ..postgres_database import postgres_database
from ..document_fragment import tokenize_html_document, tokenize_text_document, inner_text

logger = logging.getLogger('flask.error')

def register_scheduler(sched):
    def run():
        p = subprocess.Popen(['python', '-m', 'dhimmis.annotator.suggestions'])
        logger.info(F'Starting annotation suggestion refresh (PID {p.pid}).')

    logger.info('Registering annotation suggestion refresh job to run each day at 1AM.')
    sched.add_job(run, trigger='cron', hour='1', minute='0')



SearchTerm = namedtuple('SearchTerm', ['terms', 'type', 'source', 'data'])
Place = namedtuple('Place', ['id', 'name'])
Person = namedtuple('Person', ['id', 'name', 'time_range'])
Religion = namedtuple('Religion', ['id', 'name'])
Result = namedtuple('Result', ['ratio', 'source', 'start', 'end'])
TextFragment = namedtuple('TextFragment', ['text', 'start', 'end'])


def get_all_places(c):
    c.execute('''SELECT id, name, (
        SELECT array_agg(name)
        FROM name_var
        WHERE place_id = P.id
        GROUP BY place_id
    ) AS alternate_names,
    (
        SELECT array_agg(transcription)
        FROM name_var
        WHERE place_id = P.id
        AND transcription IS NOT NULL
        GROUP BY place_id
    ) AS transcriptions
    FROM place P;''')
    places = []
    for p in c.fetchall():
        names = list(set([p.name, *(p.alternate_names or []), *(p.transcriptions or [])]))
        p = Place(p.id, p.name)
        places.append(SearchTerm(names, Place.__name__, 'name', p))

    logger.info('Found %d places with %d names.', len(places), reduce(lambda a,b: a + len(b.terms), places, 0))

    return places


def get_all_persons(c):
    c.execute(F'SELECT id, name, time_range FROM person;')
    persons = []
    for p in c.fetchall():
        names = [p.name]
        p = Person(p.id, p.name, p.time_range)
        persons.append(SearchTerm(names, Person.__name__, 'name', p))

    logger.info('Found %d persons with %d names.', len(persons), reduce(lambda a,b: a + len(b.terms), persons, 0))

    return persons


def get_all_religions(c):
    c.execute(F'SELECT id, name FROM religion;')
    religions = []
    for r in c.fetchall():
        names = [r.name]
        r = Religion(r.id, r.name)
        religions.append(SearchTerm(names, Religion.__name__, 'name', r))

    logger.info('Found %d religions with %d names.', len(religions), reduce(lambda a,b: a + len(b.terms), religions, 0))

    return religions


def get_other_annotation_content_data(c, text, document_id):
    text = inner_text(text)
    query = c.mogrify('select * from annotation_overview where document_id = %s;', (document_id,))
    c.execute(query)

    sts = []
    existing_by_type_id = dict()

    for t in c.fetchall():
        a = t.span.lower if t.span.lower_inc else t.span.lower + 1
        b = t.span.upper if t.span.upper_inc else t.span.upper - 1
        searchtext = ' '.join(text[a:b].split())

        p = None
        key = None

        if t.place_instance_id is not None:
            v = c.one('SELECT P.id, P.name FROM place P JOIN place_instance PI ON P.id = PI.place_id WHERE PI.id = %s;', (t.place_instance_id,))
            p = Place(v.id, v.name)
            key = (Place.__name__, v.id)

        elif t.person_instance_id is not None:
            v = c.one('SELECT P.id, P.name, P.time_range FROM person P JOIN person_instance PI ON P.id = PI.person_id WHERE PI.id = %s;', (t.person_instance_id,))
            p = Person(v.id, v.name, v.time_range)
            key = (Person.__name__, v.id)

        elif t.religion_instance_id is not None:
            v = c.one('SELECT R.id, R.name FROM religion R JOIN religion_instance RI ON R.id = RI.religion_id WHERE RI.id = %s;', (t.religion_instance_id,))
            p = Religion(v.id, v.name)
            key = (Religion.__name__, v.id)

        else:
            # do not (for now) handle time groups
            pass

        if p is not None:
            sts.append(SearchTerm([searchtext], type(p).__name__, 'annotation', p))

        if key is not None:
            if key in existing_by_type_id:
                existing_by_type_id[key].extend([(a,b)])
            else:
                existing_by_type_id[key] = [(a,b)]

    logger.info('Found %d annotations for document to preprocess.', len(sts))
    return sts, existing_by_type_id


def tokenize_text(text, doctype, ngrams=2):
    if 'text/html' in doctype:
        tokens = tokenize_html_document(text)
    elif 'text/plain' in doctype:
        tokens = tokenize_text_document(text)
    else:
        logger.error('Unknown document type for document: "%s".', doctype)
        tokens = []

    fragments = []
    for i in range(1, ngrams+1):
        for idx in range(len(tokens) + 1 - i):
            toks = tokens[idx:idx+i]
            text = ' '.join(map(lambda x: x[0], toks))
            start = toks[0][1]
            end = toks[-1][2]

            fragments.append(TextFragment(text, start, end))

    logger.info('Extracted %d tokens using n-grams up to n=%d.', len(fragments), ngrams)

    return fragments


def reduce_spans(result_set):
    if len(result_set) == 0:
        return []

    # sort result set ascending by start position, then by end position
    res = sorted(result_set, key=lambda r: (r.start, r.end))

    results = []
    current = res.pop(0)
    for r in res:
        if r.start <= current.end:
            current = Result(max(current.ratio, r.ratio), set([*current.source, *r.source]), current.start, r.end)

        else:
            results.append(current)
            current = r

    return results


def _overlaps(a0, a1, b0, b1):
    ''' Checks if two intervals [a0,a1] and [b0,b1] overlap. '''
    return (not (b0 > a1)) and (not (a0 > b1))


def prune_existing(results, existing):
    left = []
    for r in results:
        if not any(map(lambda ex: _overlaps(r.start, r.end, ex[0], ex[1]), existing)):
            left.append(r)

    return left



# Search by place names (and alt names) in database                                                     OK
# Search by religion names in database                                                                  OK
# Search by person names in database                                                                    OK
# (search for numbers?)                                                                                 OK
# Search by content of other annotations FROM THE SAME DOCUMENT                                         OK
# for each, store also type of annotation                                                               OK
# Group candidates by type and position (only one (best) of type at position)                           OK
# Prune candidates that are already present in the document (i.e., matching entity in same space)       OK


def search_with_term(document, frags, search_term):
    key = (type(search_term.data).__name__, search_term.data.id)
    vals = []

    for term in search_term.terms:
        for token in frags:
            rat = ratio(token.text, term)
            if rat >= 0.9:
                vals.append(Result(rat, set([search_term.source]), token.start, token.end))

    return key, vals


def refresh_annotation_suggestions():
    db = postgres_database()
    with db.get_cursor() as c:
        c.execute('SELECT * FROM document;')
        for doc in c.fetchall():
            _refresh_for_document(c, doc)


def _refresh_for_document(c, document):
    logger.info('Starting annotation suggestion refresh for document with ID %d.', document.id)
    doc = bytes(document.content).decode('utf-8')

    search_terms = get_all_places(c)
    search_terms.extend(get_all_persons(c))
    search_terms.extend(get_all_religions(c))
    annotations, existing_by_type_id = get_other_annotation_content_data(c, doc, document.id)
    search_terms.extend(annotations)

    # calculate hash
    vs = []
    for v in search_terms:
        vs.append(tuple([
            v.type,
            v.source,
            *sorted(map(lambda x: str(x), tuple(v.data))),
            *sorted(v.terms),
            ]))

    vs = sorted(map(lambda x: json.dumps(x), vs))
    stj = json.dumps(vs).encode('utf-8')
    newhash = hashlib.sha512(stj).hexdigest()

    oldhash = c.one('SELECT suggestion_hash FROM annotation_suggestion_document_state WHERE document_id = %s;', (document.id,))

    if oldhash == newhash:
        logger.info('Old and new hash of search terms match, skipping update for document with ID %d.', document.id)
        return


    matches = dict()
    frags = tokenize_text(doc, document.content_type, ngrams=3)

    with Pool() as p:
        for key, vals in p.starmap(search_with_term, zip(repeat(doc), repeat(frags), search_terms), 256):
            if len(vals) > 0:
                if key in matches:
                    matches[key].extend(vals)
                else:
                    matches[key] = vals

    matches = { k: reduce_spans(v) for k,v in matches.items() }
    matchcount = 0
    for v in matches.values():
        matchcount += len(v)
    logger.info('Reduced matches down to %d unique items.', matchcount)

    matchcount_old = matchcount
    matches = { k: prune_existing(v, existing_by_type_id.get(k, [])) for k,v in matches.items() }
    matchcount = 0
    for v in matches.values():
        matchcount += len(v)
    logger.info('Eliminated %d existing annotations, %d matches left.', matchcount_old - matchcount, matchcount)

    f = BytesIO()
    f.write(c.mogrify('DELETE FROM annotation_suggestion WHERE document_id = %s;\n\n', (document.id,)))

    insertions = []
    for (t, id_), vs in matches.items():
        for v in vs:
            insertions.append(c.mogrify('    (%(document_id)s, %(span)s, %(source)s, %(type)s, %(entity_id)s)',
                dict(
                    document_id=document.id,
                    span=NumericRange(v.start, v.end, '[]'),
                    source=list(v.source),
                    type=t.lower(),
                    entity_id=id_)))
    if len(insertions) > 0:
        f.write(b'INSERT INTO annotation_suggestion (document_id, span, source, type, entity_id) VALUES\n');
        f.write(b',\n'.join(insertions))
        f.write(b';\n')

        f.write(c.mogrify('''DELETE FROM annotation_suggestion_document_state WHERE document_id = %(document_id)s;
        INSERT INTO annotation_suggestion_document_state (document_id, suggestion_hash) VALUES (%(document_id)s, %(suggestion_hash)s);\n''', dict(document_id=document.id, suggestion_hash=newhash)))

    logger.info('Writing updated annotation suggestions for document with ID %d to the database.', document.id)
    c.execute(f.getvalue())


if __name__ == '__main__':
    _err_handler = TimedRotatingFileHandler(
        os.environ.get('FLASK_ERROR_LOG', 'error_log'),
        when='midnight',
        interval=1,
        backupCount=10)
    _err_handler.setFormatter(logging.Formatter('[%(asctime)s] [%(levelname)s] [PID %(process)s] %(message)s',
        datefmt='%Y-%m-%dT%H:%M:%S %z'))
    logger.addHandler(_err_handler)
    logger.setLevel(logging.INFO)

    refresh_annotation_suggestions()
