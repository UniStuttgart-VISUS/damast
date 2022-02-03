import re
import locale
from functools import cmp_to_key

_ignore_name_prefixes = re.compile("^(a([tdrzsṣḍṭẓln]|[tds]h)-[’']?|[’'])")

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
