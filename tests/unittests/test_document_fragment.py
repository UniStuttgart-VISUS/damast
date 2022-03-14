from damast.document_fragment import extract_fragment
from functools import namedtuple
import pytest
import html5lib
from xml.dom.minidom import Text

def inner_text(node):
    if type(node) == Text:
        return node.data
    else:
        return ''.join(map(inner_text, node.childNodes))


_complex_document = '''<p id="foo">
  <span>This is a <em>span,</em> some of it is highlighted</span>
  Foo bar.
</p>

<p>
  Hello World!
  This is more text.
  Foo bar baz.
</p>

<p>
  <span><em>Double starting</em> tags, and</span>
  <span>double <strong class="foo">ending tags.</strong></span>
</p>'''


Case = namedtuple('Case', ['content', 'start', 'end', 'expected'])
_testcases = [
    Case('', 0, 0, ''),
    Case('<p>Heyyy</p>', 0, 1, 'H'),
    Case('<p>Heyyy</p>', 1, 6, 'eyyy'),
    Case(_complex_document, 0, 20, '\n  This is a span, s'),
    Case(_complex_document, 20, 21, 'o'),
    Case(_complex_document, 20, 110, 'ome of it is highlighted\n  Foo bar.\n\n\n\n  Hello World!\n  This is more text.\n  Foo bar baz.\n'),
    ]

alltext = inner_text(html5lib.parse(_complex_document, treebuilder='dom'))
for i in range(len(alltext) + 1):
    for j in range(i, len(alltext) + 1):
        expected = alltext[i:j]
        _testcases.append(Case(_complex_document, i, j, expected))


@pytest.fixture(params=_testcases)
def testcase(request):
    return request.param


def test(testcase):
    out = extract_fragment(testcase.content, testcase.start, testcase.end)
    alltext = html5lib.parse(testcase.content, treebuilder='dom')
    expected = inner_text(alltext)[testcase.start:testcase.end]

    document = html5lib.parse(out, treebuilder='dom')
    text = inner_text(document)

    assert expected == testcase.expected
    assert text == testcase.expected, (out, testcase.expected)
