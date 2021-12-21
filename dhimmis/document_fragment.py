import html5lib
from xml.dom.minidom import Text
import re

def extract_fragment(content, start, end):
    '''
    Extract the text between `start` and `end` from the HTML document
    `content`, including all tags this range overlaps with, but excluding
    others as well as text in those tags not in the range.
    '''
    document = html5lib.parse(content, treebuilder='dom')
    offset, node = _handle(document, document, 0, start, end)

    walker = html5lib.getTreeWalker("dom")
    stream = walker(node)
    s = html5lib.serializer.HTMLSerializer(omit_optional_tags=False)
    output = ''.join(s.serialize(stream))
    return output


WORD = re.compile('\\b\\w+\\b')
def tokenize_html_document(content):
    document = html5lib.parse(content, treebuilder='dom')
    _, tokens = _tokenize(document, 0)
    return tokens


def tokenize_text_document(content):
    tokens = []
    for tok in re.finditer(WORD, content):
        text = tok.group(0)
        start = tok.span()[0] + offset
        end = tok.span()[1] + offset

        tokens.append((text,start,end))

    return tokens


def _tokenize(node, offset):
    inner_offset = 0
    inner_tokens = []

    if type(node) == Text:
        for tok in re.finditer(WORD, node.data):
            text = tok.group(0)
            start = tok.span()[0] + offset
            end = tok.span()[1] + offset

            inner_tokens.append((text,start,end))

        return len(node.data), inner_tokens

    else:
        for child in node.childNodes:
            l,t = _tokenize(child, offset + inner_offset)
            inner_offset += l
            inner_tokens.extend(t)

        return inner_offset, inner_tokens



def _handle(root, node, offset, start, end):
    if type(node) == Text:
        if offset <= start and offset + len(node.data) <= start:
            return len(node.data), None
        elif offset <= start and offset + len(node.data) > start:
            text = node.data[start-offset:end-offset]
            return len(node.data), root.createTextNode(text)
        elif offset > start and offset <= end:
            text = node.data[:end-offset]
            return len(node.data), root.createTextNode(text)
        else:
            return len(node.data), None

    else:
        length = 0
        startOffset = offset
        toRemove = []

        for n in node.childNodes:
            delta, newNode = _handle(root, n, offset + length, start, end)
            length += delta
            if newNode is None:
                toRemove.append(n)
            else:
                node.replaceChild(newNode, n)

        for r in toRemove:
            node.removeChild(r)

        endOffset = offset + length

        if startOffset > end or endOffset <= start:
            return length, None
        else:
            return length, node


def document_length(content):
    '''
    Return the character length of an HTML document.
    '''
    document = html5lib.parse(content, treebuilder='dom')
    return _doclen(document)

def _doclen(node):
    if type(node) == Text:
        return len(node.data)
    return sum(map(_doclen, node.childNodes))


def inner_text(content):
    '''
    Return only concatenated text nodes.
    '''
    document = html5lib.parse(content, treebuilder='dom')
    return _docstr(document)

def _docstr(node):
    if type(node) == Text:
        return node.data
    return ''.join(map(_docstr, node.childNodes))



