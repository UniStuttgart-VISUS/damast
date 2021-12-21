import re
import locale
from functools import cmp_to_key

_ignore_name_prefixes = re.compile("^(a([tdrzsṣḍṭẓln]|[tds]h)-[’']?|[’'])")

def core_name(name):
    return _ignore_name_prefixes.sub('', name)

def sort_placenames(places):
    locale.setlocale(locale.LC_COLLATE, 'en_US.UTF-8')
    comp = cmp_to_key(locale.strcoll)

    return sorted(places,
            key=lambda name: comp(core_name(name)))
