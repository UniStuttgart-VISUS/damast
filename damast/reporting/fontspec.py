import re
import unicodedata

_WORD = re.compile('\\b\\w+\\b')
def _strip(word):
    return ''.join(re.findall(_WORD, word))

_classes = [
        ('HEBREW', 'hebrew'),
        ('SYRIAC', 'syriac'),
        ('ARABIC', 'arabic'),
        ]

def get_fontspec(word):
    word = _strip(word)
    counts = { cl: 0 for _,cl in _classes }
    other = 0

    for c in word:
        n = unicodedata.name(c)
        found = False
        for cl,cln in _classes:
            if n.startswith(cl):
                counts[cln] += 1
                found = True
                break

        if not found:
            other += 1

    most, count = sorted(counts.items(), key=lambda x: x[1], reverse=True)[0]

    if count >= other:
        return most

    return None
