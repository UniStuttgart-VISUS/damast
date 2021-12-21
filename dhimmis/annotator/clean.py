import logging
import flask
from bs4 import BeautifulSoup, Comment, CData, ProcessingInstruction, Declaration, Doctype

_allowed_tags = [ 'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi',
        'bdo', 'blockquote', 'br', 'caption', 'cite', 'code',
        'col', 'colgroup', 'dd', 'del', 'details', 'dfn', 'div', 'dl',
        'dt', 'em', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3',
        'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'ins', 'kbd', 'li',
        'main', 'mark', 'nav', 'ol', 'p', 'picture', 'pre', 'q', 'rp',
        'rt', 'ruby', 's', 'samp', 'section', 'small', 'span', 'strong',
        'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot',
        'th', 'thead', 'time', 'title', 'tr', 'u', 'ul', 'wbr', ]

_allowed_attrs = {
        'a': ['href', 'title', 'hreflang'],
        'img': ['src', 'width', 'height', 'alt', 'title'],
        }

_disallowed_tags = ['script', 'style', 'head']
_disallowed_types = [ Comment, CData, Declaration, Doctype, ProcessingInstruction ]

_blind_text_attributes = [ 'data-virtual-text' ]

# adapted from https://gist.github.com/braveulysses/120193
def clean_html(html):
    soup = BeautifulSoup(html, features='html.parser')
    logger = logging.getLogger('flask.error')

    # strip comments, doctype etc.
    for comment in soup.findAll(text=lambda text: any(map(lambda x: isinstance(text, x), _disallowed_types))):
        logger.warn(F'Removing content of type {type(comment).__name__} from document.')
        comment.extract()

    # remove unwanted tags and attributes
    for tag in soup.findAll():
        if tag.name.lower() in _disallowed_tags:
            logger.warn(F'Removing disallowed tag {tag.name} from document.')
            # remove tag completely
            tag.extract()
        elif tag.name.lower() not in _allowed_tags:
            logger.warn(F'Removing surrounding tag {tag.name} from document, but keeping contents.')
            # remove tag, but keep content
            tag.hidden = True
        else:
            # find attributes that should be removed
            rm = []
            for attr in tag.attrs:
                if tag.name.lower() in _allowed_attrs and attr.lower() in _allowed_attrs[tag.name.lower()]:
                    pass
                elif attr.lower() in _blind_text_attributes:
                    pass
                elif attr.lower() == 'id':
                    pass
                else:
                    logger.warn(F'Removing attribute {attr} from tag {tag.name}.')
                    rm.append(attr)

            # remove attributes
            for r in rm:
                del tag.attrs[r]

    return str(soup)

