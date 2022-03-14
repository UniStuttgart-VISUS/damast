import re
import locale
from functools import cmp_to_key

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

