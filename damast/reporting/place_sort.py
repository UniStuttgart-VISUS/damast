import re
import locale
from functools import cmp_to_key
from psycopg2.extras import NumericRange

from .filters import range_match

# characters to ignore before the sortable name, including apostrophe-like characters

_apostrophe_like = ''.join((
        '\'',        # U+0027 APOSTROPHE [used in simple transcription for both ʿain and hamza]
        '\u02BF',    # U+02BF ʿ MODIFIER LETTER LEFT HALF RING [used in scientific transcription for ʿain]
        '\u02BE',    # U+02BE ʾ MODIFIER LETTER RIGHT HALF RING [used in scientific transcription for hamza]
        ))

_ignore_name_prefixes = re.compile(F"^(a([tdrzsṣḍṭẓln]|[tds]h)-[{_apostrophe_like}]?|[{_apostrophe_like}])")

def core_name(name):
    return _ignore_name_prefixes.sub('', name)

def sort_placenames(places, keyfn=lambda entry: entry):
    locale.setlocale(locale.LC_COLLATE, 'en_US.UTF-8')
    comp = cmp_to_key(locale.strcoll)

    return sorted(places,
            key=lambda name: comp(core_name(keyfn(name))))


def sort_alternative_placenames(alt):
    locale.setlocale(locale.LC_COLLATE, 'en_US.UTF-8')
    comp = cmp_to_key(locale.strcoll)

    return sorted(alt,
            key=lambda a: (comp(a.language), comp(a.transcription if a.transcription is not None else a.name)))


def _get_total_timespan(ev):
    if len(ev.time_instances) == 0:
        return None, None

    tss = []
    for t in ev.time_instances:
        s = t['span']

        if s is None or s == 'empty':
            return None, None

        r = range_match.fullmatch(s)
        bounds = F'{r.group("open")}{r.group("close")}'
        start = None if r.group('start') == '' else int(r.group('start'))
        end = None if r.group('end') == '' else int(r.group('end'))

        span = NumericRange(start, end, bounds)

        if span.isempty:
            return None, None

        else:
            a = span.lower if span.lower_inc or span.lower_inf else span.lower + 1
            b = span.upper if span.upper_inc or span.upper_inf else span.upper - 1

            tss.append((a, b))

    if len(tss) == 0:
        return None, None

    return min(map(lambda x: x[0], tss)), max(map(lambda x: x[1], tss))


@cmp_to_key
def sort_evidence(ev1, ev2):
    '''sort evidences first by city name, then by religion name, then by start of first time span'''

    locale.setlocale(locale.LC_COLLATE, 'en_US.UTF-8')

    # city name
    name1 = core_name(ev1.evidence.place_name)
    name2 = core_name(ev2.evidence.place_name)

    c1 = locale.strcoll(name1, name2)

    if c1 != 0:
        return c1

    # religion name
    c2 = locale.strcoll(ev1.evidence.religion, ev2.evidence.religion)
    if c2 != 0:
        return c2

    # start of first time span
    start1, end1 = _get_total_timespan(ev1.evidence)
    start2, end2 = _get_total_timespan(ev2.evidence)

    if start1 is None:
        return -1
    if start2 is None:
        return 1

    if start1 == start2:
        return end1 - end2

    return start1 - start2

