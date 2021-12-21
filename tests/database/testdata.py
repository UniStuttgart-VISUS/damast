from functools import namedtuple
import datetime
import json

def print_value(val):# {{{
    if type(val) is int:
        return str(val)
    elif val is None:
        return '\\N'
    elif type(val) is bool:
        return 't' if val else 'f'
    elif type(val) is str:
        return val
    elif type(val) is bytes:
        return '\\\\x' + ''.join('%02x'%c for c in val)
    elif type(val) is datetime.datetime:
        return val.astimezone().isoformat()
    elif type(val) is dict:
        return json.dumps(val)
    else:
        raise TypeError('unsupported type: ' + str(type(val)))
# }}}

def write_table(out, rowtype, data):# {{{
    tablename = rowtype.__name__
    out.write('\n')
    out.write(F'COPY public.{tablename} ({", ".join(rowtype._fields)}) FROM stdin;\n')

    for datum in data:
        line = '\t'.join(map(print_value, datum))
        out.write(line)
        out.write('\n')

    out.write(F"\\.\n\nSELECT pg_catalog.setval('public.{tablename}_id_seq', {len(data)+1}, false);\n\n")# }}}


ActionType = namedtuple('action_type', ['id', 'name'])# {{{
action_type_table = [
        ActionType(1, 'CREATE'),
        ActionType(2, 'UPDATE'),
        ActionType(3, 'REVIEW'),
        ActionType(4, 'DELETE'),
        ]

# }}}
Document = namedtuple('document', ['id', 'source_id', 'version', 'comment', 'content_type', 'content_length', 'content'])# {{{
document_table = [
        Document(1, 1, 1, None, 'text/plain;charset=utf-8', 21, b'testtext of length 21'),
        Document(2, 1, 2, 'test comment', 'text/html;charset=utf-8', 30, b'<h1>Heading</h2>\n<p>testtext of length 46</p>\n'),
        Document(3, 3, 1, 'this is a simple alphabet sequence of length 26', 'text/plain', 26, b'abcdefghijklmnopqrstuvwxyz'),
        Document(4, 4, 1, 'Some longer HTML', 'text/html;charset=UTF-8', 163, b'''<p id="foo">
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
</p>'''),
        Document(5, 1, 3, 'this will be a document type that does not accept ranges', 'application/octet-stream', 6, b'\x00\x00\xdf\xa0Z\x11'),
        ]

# }}}
Annotation = namedtuple('annotation', ['id', 'document_id', 'span', 'comment'])# {{{
annotation_table = [
        Annotation(1, 1, '[0, 10]', 'Annotation from 0 to 10'),
        Annotation(2, 1, '[0, 12]', None),
        Annotation(3, 1, '[14, 20]', 'Comment'),
        Annotation(4, 2, '[4, 24]', 'Annotation from 0 to 10'),
        Annotation(5, 2, '[9, 29]', 'Content of <p>'),
        Annotation(6, 3, '[0, 25]', None),
        Annotation(7, 4, '[25, 35]', 'another comment'),
        Annotation(8, 4, '[16, 49]', None),
        Annotation(9, 1, '[0, 10]', 'Annotation from 0 to 10'),
        Annotation(10, 1, '[0, 12]', None),
        Annotation(11, 1, '[14, 20]', 'Comment'),
        Annotation(12, 2, '[4, 24]', 'Annotation from 0 to 10'),
        Annotation(13, 2, '[21, 22]', 'Content of <p>'),
        Annotation(14, 3, '[0, 25]', None),
        Annotation(15, 4, '[25, 35]', 'another comment'),
        Annotation(16, 4, '[16, 49]', None),
        Annotation(17, 1, '[0, 10]', 'Annotation from 0 to 10'),
        Annotation(18, 1, '[0, 12]', None),
        Annotation(19, 1, '[14, 20]', 'Comment'),
        Annotation(20, 2, '[4, 10]', 'Annotation from 0 to 10'),
        Annotation(21, 2, '[19, 23]', 'Content of <p>'),
        Annotation(22, 3, '[0, 25]', None),
        Annotation(23, 4, '[25, 35]', 'another comment'),
        Annotation(24, 4, '[16, 49]', None),
        Annotation(25, 1, '[0, 10]', 'Annotation from 0 to 10'),
        Annotation(26, 1, '[0, 12]', None),
        Annotation(27, 1, '[14, 20]', 'Comment'),
        Annotation(28, 2, '[4, 24]', 'Annotation from 0 to 10'),
        Annotation(29, 2, '[10, 20]', 'Content of <p>'),
        Annotation(30, 3, '[0, 25]', None),
        Annotation(31, 4, '[25, 35]', 'another comment'),
        Annotation(32, 4, '[16, 49]', None),
        Annotation(33, 1, '[0, 10]', 'Annotation from 0 to 10'),
        Annotation(34, 1, '[0, 12]', None),
        Annotation(35, 1, '[14, 20]', 'Comment'),
        Annotation(36, 2, '[4, 23]', 'Annotation from 0 to 10'),
        Annotation(37, 2, '[21, 30]', 'Content of <p>'),
        Annotation(38, 3, '[0, 25]', None),
        Annotation(39, 4, '[25, 35]', 'another comment'),
        Annotation(40, 4, '[16, 49]', None),
        ]

# }}}
Religion = namedtuple('religion', ['id', 'name', 'abbreviation', 'color', 'parent_id'])# {{{
religion_table = [
        Religion(1, 'Religion 1', 'R1', 'red', None),
        Religion(2, 'Religion 2', 'R2', 'red', None),
        Religion(3, 'Religion 3', 'R3', 'red', None),
        Religion(4, 'Religion 4', 'R4', 'red', None),
        Religion(5, 'Religion 5', 'R5', 'red', None),
        Religion(6, 'Religion 6', 'R6', 'red', 3),
        Religion(7, 'Religion 7', 'R7', 'red', 3),
        Religion(8, 'Religion 8', 'R8', 'red', 4),
        Religion(9, 'Religion 9', 'R9', 'red', 4),
        Religion(10, 'Religion 10', 'R10', 'red', 5),
        Religion(11, 'Religion 11', 'R11', 'red', 5),
        Religion(12, 'Religion 12', 'R12', 'red', 6),
        Religion(13, 'Religion 13', 'R13', 'red', 6),
        Religion(14, 'Religion 14', 'R14', 'red', 7),
        Religion(15, 'Religion 15', 'R15', 'red', 7),
        Religion(16, 'Religion 16', 'R16', 'red', 8),
        Religion(17, 'Religion 17', 'R17', 'red', 8),
        Religion(18, 'Religion 18', 'R18', 'red', 9),
        Religion(19, 'Religion 19', 'R19', 'red', 9),
        Religion(20, 'Religion 20', 'R20', 'red', 10),
        Religion(21, 'Religion 21', 'R21', 'red', 10),
        Religion(22, 'Religion 22', 'R22', 'red', 11),
        Religion(23, 'Religion 23', 'R23', 'red', 11),
        Religion(24, 'Religion 24', 'R24', 'red', 12),
        Religion(25, 'Religion 25', 'R25', 'red', 12),
        ]

# }}}
ReligionInstance = namedtuple('religion_instance', ['id', 'religion_id', 'annotation_id', 'confidence', 'comment'])# {{{
religion_instance_table = [
        ReligionInstance(1, 9, 1, 'false', 'bulldozing whetting jed repeal'),
        ReligionInstance(2, 2, None, 'false', 'tulle cousin evolving'),
        ReligionInstance(3, 2, None, 'certain', 'likelier phoning sustain pupils stardust dawns'),
        ReligionInstance(4, 23, 2, None, 'benchmarks quietly smalltime inflammatory mirth warranties'),
        ReligionInstance(5, 14, None, 'probable', None),
        ReligionInstance(6, 20, None, 'certain', None),
        ReligionInstance(7, 5, 3, 'uncertain', None),
        ReligionInstance(8, 17, 4, 'uncertain', None),
        ReligionInstance(9, 16, 5, 'certain', 'barbiturates arrangements eventfully plainfield sliding monumental generically'),
        ReligionInstance(10, 16, None, 'probable', None),
        ReligionInstance(11, 19, None, 'contested', None),
        ReligionInstance(12, 9, None, 'false', 'betrayed instant adjournment moriarty jogging'),
        ReligionInstance(13, 3, None, 'uncertain', None),
        ReligionInstance(14, 22, 6, 'certain', 'dangled jolts pilewort blip denominator salacious amalgamates'),
        ReligionInstance(15, 13, None, 'false', None),
        ReligionInstance(16, 20, None, 'certain', None),
        ReligionInstance(17, 23, None, 'uncertain', 'deep peanut'),
        ReligionInstance(18, 17, 7, 'probable', 'minerals fostering'),
        ReligionInstance(19, 10, None, 'probable', None),
        ReligionInstance(20, 17, 8, 'contested', '741852'),
        ReligionInstance(21, 20, None, 'certain', None),
        ReligionInstance(22, 23, None, 'uncertain', 'deep peanut'),
        ReligionInstance(23, 17, None, 'probable', 'minerals fostering'),
        ReligionInstance(24, 10, None, 'probable', None),
        ReligionInstance(25, 17, None, 'contested', '741852'),
        ]

# }}}
PlaceType = namedtuple('place_type', ['id', 'type', 'visible'])#{{{
place_type_table = [
    PlaceType(1, 'Unknown', True),
    PlaceType(2, 'Monastery', True),
    PlaceType(3, 'Settlement', True),
    PlaceType(4, 'Region', False),
        ]

# }}}
Place = namedtuple('place', ['id', 'name', 'comment', 'geoloc', 'confidence', 'visible', 'place_type_id'])# {{{
place_table = [
        Place(1, "Place A", "protestors subsidies tradesmen december", "(65.85915864575666,93.15693616171887)", "certain", True, 3),
        Place(2, "Place B", None, "(65.47205044625794,-79.79638909259997)", "certain", True, 4),
        Place(3, "Place C", None, "(58.56256228740186,174.61354826387196)", "false", False, 3),
        Place(4, "Place D", "hedgehogs balancing restart edgar", "(7.830058141210841,-59.14926390423511)", "probable", False, 4),
        Place(5, "Place E", "awn", None, "probable", False, 3),
        Place(6, "Place F", None, "(61.789414195438994,-63.950859463702415)", "false", True, 2),
        Place(7, "Place G", "interacted yeoman safeguards altruistic werent treaty", "(-48.83851037319642,20.363131612414122)", "false", True, 2),
        Place(8, "Place H", "", "(-60.206244709467285,-109.90326072943215)", None, True, 3),
        Place(9, "Place I", "burrower wading adages", "(23.97282603543374,119.82009550553767)", None, False, 3),
        Place(10, "Place J", None, "(9.970398890634527,44.42532571858851)", "false", False, 1),
        Place(11, "Place K", "modify penetratingly deities resists grafts insurers", "(16.853037059358314,156.07092414137702)", None, False, 2),
        Place(12, "Place L", "localized mink inspire pins persistently distrusted flabbergast persists", "(31.420587545195104,-37.80439523417368)", "uncertain", False, 2),
        Place(13, "Place M", "additives succeeding", "(-40.026393145135046,-41.66184589166184)", "contested", True, 4),
        Place(14, "Place N", "constructively familiarness inquisitiveness tuners", "(86.15817321571318,139.55599326170392)", "false", False, 3),
        Place(15, "Place O", "undiscovered", None, "certain", True, 1),
        Place(16, "Place P", "punctures", None, None, True, 3),
        Place(17, "Place Q", None, "(-65.00024497422861,-9.910080527471223)", "certain", True, 2),
        Place(18, "Place R", None, "(84.35095933285622,15.008071796467505)", None, True, 1),
        Place(19, "Place S", "peculate aesthetic pamphlet territorys", "(-47.52411049561632,174.10260816949693)", "certain", False, 3),
        Place(20, "Place T", None, "(-66.10255866811343,-90.88171110587253)", "certain", False, 2),
        Place(21, "Place U", None, "(88.28539555771626,70.79126916140717)", "probable", True, 2),
        Place(22, "Place V", "degrease burrito nanette williamsburg", "(87.35064942131235,-96.88002011171282)", "false", True, 4),
        Place(23, "Place W", None, "(-11.948892153155938,-56.73195279433534)", "uncertain", False, 1),
        Place(24, "Place X", "aqueduct sedulous lilacs peas", "(-72.0064484047158,166.76884699417434)", None, True, 4),
        Place(25, "Place Y", "nightcap tramp seder pyle flashers bator abstaining", "(-26.904011433642225,-116.70599778970515)", "contested", True, 3),
        Place(26, "Place Z", "bandlimits puppeteer", "(7.556835152451043,156.32258778959147)", "false", True, 4),
        ]

# }}}
PlaceInstance = namedtuple('place_instance', ['id', 'place_id', 'annotation_id', 'confidence', 'comment'])# {{{
place_instance_table = [
    PlaceInstance(1, 1, 9, 'probable', 'test comment 1'),
    PlaceInstance(2, 1, 10, 'certain', 'comment'),
    PlaceInstance(3, 1, None, 'false', None),
    PlaceInstance(4, 1, None, 'contested', 'morphemic higher casually'),
    PlaceInstance(5, 2, 11, 'probable', None),
    PlaceInstance(6, 3, None, 'certain', 'Tattooed explosion ruler'),
    PlaceInstance(7, 4, None, 'false', None),
    PlaceInstance(8, 5, 12, 'contested', 'divulging interactions polemics'),
    PlaceInstance(9, 6, None, 'probable', 'hayden newsweek aerators'),
    PlaceInstance(10, 7, None, 'certain', None),
    PlaceInstance(11, 8, None, 'false', None),
    PlaceInstance(12, 9, 13, 'contested', 'endurance widowed chippendale'),
    PlaceInstance(13, 10, None, 'probable', None),
    PlaceInstance(14, 11, None, 'certain', 'camp reservoirs reconstructed'),
    PlaceInstance(15, 12, 14, 'false', 'notifications apprentices oppress'),
    PlaceInstance(16, 13, None, 'contested', 'fluorite reactor untouchables'),
    PlaceInstance(17, 14, 15, 'probable', 'baptize barrymore quasiparticle'),
    PlaceInstance(18, 15, None, 'certain', None),
    PlaceInstance(19, 16, None, 'false', 'surveyors reefer kneecap'),
    PlaceInstance(20, 17, None, 'contested', 'sneak resurrecting eigenvalues'),
    PlaceInstance(21, 18, None, 'probable', None),
    PlaceInstance(22, 19, 16, 'certain', None),
    PlaceInstance(23, 20, None, 'false', None),
        ]

# }}}
TimeGroup = namedtuple('time_group', ['id', 'annotation_id'])# {{{
time_group_table = [
        TimeGroup(1, 17),
        TimeGroup(2, None),
        TimeGroup(3, None),
        TimeGroup(4, 18),
        TimeGroup(5, 19),
        TimeGroup(6, None),
        TimeGroup(7, 20),
        TimeGroup(8, None),
        TimeGroup(9, None),
        TimeGroup(10, None),
        TimeGroup(11, 21),
        TimeGroup(12, None),
        TimeGroup(13, 22),
        TimeGroup(14, None),
        TimeGroup(15, None),
        TimeGroup(16, None),
        TimeGroup(17, 23),
        TimeGroup(18, None),
        TimeGroup(19, None),
        TimeGroup(20, None),
        TimeGroup(21, None),
        TimeGroup(22, None),
        TimeGroup(23, None),
        TimeGroup(24, 24),
        TimeGroup(25, None),
        TimeGroup(26, None),
        ]

# }}}
TimeInstance = namedtuple('time_instance', ['id', 'time_group_id', 'span', 'confidence', 'comment'])# {{{
time_instance_table = [
        TimeInstance(1, 1, '[1679,1784)', 'uncertain', None),
        TimeInstance(2, 1, '[626,)', 'certain', None),
        TimeInstance(3, 1, '[1640,1850)', 'certain', None),
        TimeInstance(4, 1, '[1311,)', 'false', 'workshops mired designated'),
        TimeInstance(5, 2, '[,925)', 'false', None),
        TimeInstance(6, 2, '[1798,)', None, None),
        TimeInstance(7, 2, 'empty', 'contested', None),
        TimeInstance(8, 2, '[849,1294)', 'false', None),
        TimeInstance(9, 3, '[,1609)', 'contested', None),
        TimeInstance(10, 3, '[1277,1493)', 'uncertain', None),
        TimeInstance(11, 3, '[1415,1889)', 'uncertain', 'registering temples paragon hawkwind scrapper extractors'),
        TimeInstance(12, 3, '[201,1529)', None, 'testdata'),
        TimeInstance(13, 4, '[865,1367)', 'false', 'cottage clocker catherin'),
        TimeInstance(14, 4, '[1031,1869)', 'contested', None),
        TimeInstance(15, 4, '[,1649)', 'uncertain', None),
        TimeInstance(16, 4, '[1021,1242)', 'false', None),
        TimeInstance(17, 5, '[432,906)', 'certain', None),
        TimeInstance(18, 6, '[1666,)', 'certain', None),
        TimeInstance(19, 6, '[960,1566)', 'uncertain', 'apparitions jabs methanol accredit deliverable configurable'),
        TimeInstance(20, 6, '[1203,1598)', 'uncertain', 'fried eggs'),
        TimeInstance(21, 7, '[1598,1680)', 'certain', 'interconnected'),
        TimeInstance(22, 7, '[463,1404)', 'false', None),
        TimeInstance(23, 7, '[1888,)', 'certain', 'benchmarks'),
        TimeInstance(24, 7, '[278,1077)', 'probable', None),
        TimeInstance(25, 9, '[825,1851)', 'contested', None),
        TimeInstance(26, 9, '[,1257)', 'false', None),
        TimeInstance(27, 9, '[,1969)', 'certain', 'receptive cursory'),
        TimeInstance(28, 9, '[1122,)', 'uncertain', None),
        TimeInstance(29, 10, '[1822,1835)', 'contested', None),
        TimeInstance(30, 10, '[905,1106)', None, ''),
        TimeInstance(31, 10, '[890,)', 'false', 'sdmf sdg '),
        TimeInstance(32, 12, '[1273,1476)', None, 'confirmations delineate filtrate blitzs bizkit shes'),
        TimeInstance(33, 12, '[269,684)', 'false', 'prerogatives'),
        TimeInstance(34, 13, 'empty', 'false', 'siderite palmed jaws shorting partridges'),
        TimeInstance(35, 13, '[,690)', 'probable', 'trappings fittings casteth sheehan software forges delving'),
        TimeInstance(36, 13, '[442,596)', 'certain', 'radiochemical invective permit presumptions whitehorse holocene'),
        TimeInstance(37, 13, '[1473,1673)', 'certain', 'dried plums'),
        TimeInstance(38, 14, '[954,1530)', None, 'beaters downpour reevaluating spangle trundle hes slops'),
        TimeInstance(39, 14, '[1391,)', 'contested', None),
        TimeInstance(40, 14, '[428,775)', 'probable', None),
        TimeInstance(41, 15, '[593,755)', 'contested', 'surroundings merriment roof forbes sermon sported'),
        TimeInstance(42, 15, '[1543,)', 'contested', 'trachea evoking flair competitors brainstems victor initialed'),
        TimeInstance(43, 15, '[789,1132)', 'contested', None),
        TimeInstance(44, 15, '[659,1865)', None, 'property'),
        TimeInstance(45, 15, '[1710,)', 'certain', None),
        TimeInstance(46, 15, '[1729,)', 'certain', 'idling communicates deify necromancer aqua'),
        TimeInstance(47, 21, '[1371,1808)', 'false', 'juan churchyard asymptotes landings winifred flooring'),
        TimeInstance(48, 22, '[329,673)', 'probable', None),
        TimeInstance(49, 23, '[,1478)', 'contested', None),
        TimeInstance(50, 24, '[449,893)', 'uncertain', None),
        TimeInstance(51, 25, '[1572,1573)', 'uncertain', None),
        ]

# }}}
PersonType = namedtuple('person_type', ['id', 'type'])# {{{
person_type_table = [
        PersonType(1, 'Person type 1'),
        ]

# }}}
Person = namedtuple('person', ['id', 'name', 'time_range', 'comment', 'person_type'])# {{{
person_table = [
        Person(1, 'Person 1', '', 'comment 1', 1),
        Person(2, 'Person 2', '', 'comment 2', 1),
        Person(3, 'Person 3', '5th century', 'comment 3', 1),
        Person(4, 'Person 4', '519-572', None, 1),
        Person(5, 'Person 5', '', 'comment 5', 1),
        Person(6, 'Person 6', 'first of his name', 'comment 6', 1),
        Person(7, 'Person 6', 'second of his name', None, 1),
        Person(8, 'Person 8', '', None, 1),
        Person(9, 'Person 9', '14th century', 'comment 9', 1),
        Person(10, 'Person 10', 'last decade of the 15th century', 'comment 10', 1),
        ]

# }}}
PersonInstance = namedtuple('person_instance', ['id', 'person_id', 'annotation_id', 'confidence', 'comment'])# {{{
person_instance_table = [
        PersonInstance(1, 1, None, 'probable', 'comment 1'),
        PersonInstance(2, 2, None, 'certain', 'comment 2'),
        PersonInstance(3, 3, 25, None, 'comment 3'),
        PersonInstance(4, 4, None, 'false', None),
        PersonInstance(5, 5, 26, None, 'comment 5'),
        PersonInstance(6, 6, 27, 'probable', 'comment 6'),
        PersonInstance(7, 7, None, 'uncertain', None),
        PersonInstance(8, 8, None, 'false', None),
        PersonInstance(9, 8, 28, 'contested', 'comment 9'),
        PersonInstance(10, 8, None, 'uncertain', 'comment 10'),
        PersonInstance(11, 1, None, None, None),
        PersonInstance(12, 2, 29, 'probable', 'comment 12'),
        PersonInstance(13, 3, None, 'false', 'comment 13'),
        PersonInstance(14, 4, None, 'contested', 'comment 14'),
        PersonInstance(15, 5, None, 'uncertain', 'comment 15'),
        PersonInstance(16, 6, None, None, 'comment 16'),
        PersonInstance(17, 7, None, 'probable', None),
        PersonInstance(18, 8, 30, 'false', 'comment 18'),
        PersonInstance(19, 8, None, 'contested', 'comment 19'),
        PersonInstance(20, 1, None, 'probable', 'comment 20'),
        PersonInstance(21, 4, 31, None, 'comment 21'),
        PersonInstance(22, 5, None, None, None),
        PersonInstance(23, 7, None, 'uncertain', 'comment 23'),
        PersonInstance(24, 8, None, 'contested', None),
        PersonInstance(25, 7, 32, 'uncertain', 'comment 25'),
        ]

# }}}
Evidence = namedtuple('evidence', ['id', 'place_instance_id', 'time_group_id', 'religion_instance_id', 'person_instance_id',  'interpretation_confidence', 'visible', 'comment'])# {{{
evidence_table = [
        Evidence(1, 1, 1, 1, 1, None, True, 'zapper footing slippery blondes'),
        Evidence(2, 2, 2, 2, 2, 'contested', True, None),
        Evidence(3, 3, 3, 3, 3, 'uncertain', False, 'maidservant amulet postmen'),
        Evidence(4, 4, 4, 4, 4, 'contested', True, 'pansys shagbark technologist reinstating airstrips chopped'),
        Evidence(5, 5, 5, 5, 5, 'uncertain', True, None),
        Evidence(6, 6, 6, 6, 6, None, False, 'speculator scirocco crafts scull dished streamliner unnoticed'),
        Evidence(7, 7, 7, 7, 7, 'contested', True, 'sicker smokin graduates herpes patently'),
        Evidence(8, 8, 8, 8, 8, 'uncertain', False, 'phialpha redstart divans ethical laidlaw truants'),
        Evidence(9, 9, 9, 9, 9, 'false', False, 'reorder ownership weighing averted snuff'),
        Evidence(10, 10, 10, 10, 10, None, False, 'biconnected nonspecialists bootlegs perchlorate uncompromising ferreira chinaman'),
        Evidence(11, 11, 11, 11, 11, 'probable', False, 'livre wailed tarheel revving attuning'),
        Evidence(12, 12, 12, 12, 12, 'certain', False, 'guidebooks fireplaces abscond'),
        Evidence(13, 13, 13, 13, 13, None, True, None),
        Evidence(14, 14, 14, 14, 14, 'contested', False, 'spaceman gareth secretaries hera'),
        Evidence(15, 15, 15, 15, 15, 'false', True, 'missiles antipodes hawker horseflesh'),
        Evidence(16, 16, 16, 16, 16, 'uncertain', True, 'anisotropy'),
        Evidence(17, 17, 17, 17, 17, 'false', False, None),
        Evidence(18, 18, 18, 18, 18, 'contested', True, 'confiscations fleshes phon boron cowry bases'),
        Evidence(19, 19, 19, 19, 19, 'contested', False, 'everlastingly reverent worktable stimulants readies leak guyer'),
        Evidence(20, 20, 20, 20, 20, 'probable', True, 'fortin anise chattel longitude gayer perpendicular'),
        Evidence(21, 1, 1, 1, 1, 'false', False, 'test comment'),
        Evidence(22, 1, 2, 2, 3, 'uncertain', False, None),
        Evidence(23, 1, 3, 3, 4, 'probable', True, None),
        Evidence(24, 1, 4, 4, 5, 'probable', True, 'icicle reformulating shell carob burglar matriculation log feigned'),
        Evidence(25, 1, 5, 5, 6, 'contested', True, None),
        Evidence(26, 20, 20, 20, 20, 'contested', True, None),
        Evidence(27, 20, 20, 20, None, 'contested', True, None),
        Evidence(28, 20, None, 20, 20, 'contested', True, None),
        Evidence(29, 20, 20, 20, 20, 'contested', True, None),
]

# }}}
Language = namedtuple('language', ['id', 'name'])# {{{
language_table = [
        Language(1, 'Language 1'),
        Language(2, 'Language 2'),
        Language(3, 'Language 3'),
        Language(4, 'Language 4'),
        Language(5, 'Language 5'),
        Language(6, 'Language 6'),
        Language(7, 'Language 7'),
        Language(8, 'Language 8'),
        Language(9, 'Language 9'),
        Language(10, 'Language 10'),
        Language(11, 'Language 11'),
        Language(12, 'Language 12'),
        ]

# }}}
NameVar = namedtuple('name_var', ['id', 'name', 'transcription', 'simplified', 'main_form', 'comment', 'place_id', 'language_id'])# {{{
name_var_table = [
        NameVar(1, 'Unique name 1', None, None, True, 'Testcomment', 1, 1),
        NameVar(2, 'zzzz', None, None, True, 'Matches \'z\'', 1, 2),
        NameVar(3, 'Unique name 2', None, None, False, None, 2, 3),
        NameVar(4, 'Raspberry', None, None, False, 'ends in y', 2, 4),
        NameVar(5, 'unique name 3', None, None, True, None, 3, 5),
        NameVar(6, 'Raid', None, None, True, None, 3, 6),
        NameVar(7, 'match with tee at start of word', None, None, False, None, 3, 7),
        NameVar(8, 'Starts with s', None, None, True, None, 4, 1),
        NameVar(9, 'raided', None, None, False, None, 4, 2),
        NameVar(10, 'Ends with t', None, None, True, None, 5, 3),
        NameVar(11, '3LT', None, None, False, None, 6, 4),
        NameVar(12, '3l_', None, None, False, None, 7, 5),
        NameVar(13, 'graph', None, None, True, None, 7, 6),
        NameVar(14, 'Last name', None, None, False, 'For place 8', 8, 7),
        NameVar(15, 'primarynamedoesnotmatch', 'unique transcription', None, True, 'Testcomment', 15, 2),
        NameVar(16, 'csaAwer2332', 'silly name', 'place, z, Z', True, 'Testcomment', 16, 2),
        NameVar(17, 'foobar', None, 'te, et', True, 'Starts or ends with T', 17, 4),
        NameVar(18, 'برقة', 'Barqa', 'Barca, Barqa, Barka', True, None, 18, 3),
        ]

# }}}
SourceType = namedtuple('source_type', ['id', 'name'])# {{{
source_type_table = [
        SourceType(1, 'unknown'),
        SourceType(2, 'Primary source'),
        SourceType(3, 'Literature'),
        ]

# }}}
Source = namedtuple('source', ['id', 'name', 'source_type_id', 'default_confidence', 'short'])# {{{
source_table = [
        Source(1, 'Source 1', 2, None, 'SRC01'),
        Source(2, 'Source 2', 2, None, 'SRC02'),
        Source(3, 'Source 3', 3, 'contested', 'SRC03'),
        Source(4, 'Source 4', 3, 'contested', 'SRC04'),
        Source(5, 'Source 5', 3, 'false', 'SRC05'),
        Source(6, 'Source 6', 2, None, 'SRC06'),
        Source(7, 'Source 7', 2, 'contested', 'SRC07'),
        Source(8, 'Source 8', 3, 'certain', 'SRC08'),
        Source(9, 'Source 9', 3, None, 'SRC09'),
        Source(10, 'Source 10', 2, 'contested', 'SRC10'),
        Source(11, 'Source 11', 1, None, 'SRC11'),
        Source(12, 'Source 12', 2, 'probable', 'SRC12'),
        Source(13, 'Source 13', 3, 'contested', 'SRC13'),
        Source(14, 'Source 14', 3, None, 'SRC14'),
        Source(15, 'Source 15', 1, None, 'SRC15'),
        Source(16, 'Source 16', 2, 'probable', 'SRC16'),
        Source(17, 'Source 17', 3, 'certain', 'SRC17'),
        Source(18, 'Source 18', 2, 'probable', 'SRC18'),
        Source(19, 'Source 19', 2, 'probable', 'SRC19'),
        Source(20, 'Source 20', 1, 'uncertain', 'SRC20'),
        Source(21, 'Source 21', 2, 'probable', 'SRC21'),
        Source(22, 'Source 22', 3, 'contested', 'SRC22'),
        Source(23, 'Source 23', 3, None, 'SRC23'),
        Source(24, 'Source 24', 2, 'false', 'SRC24'),
        Source(25, 'Source 25', 2, 'contested', 'SRC25'),
        Source(26, 'Source 26', 2, None, 'SRC26'),
        Source(27, 'Source 27', 2, 'certain', 'SRC27'),
        Source(28, 'Source 28', 1, 'contested', 'SRC28'),
        Source(29, 'Source 29', 1, 'certain', 'SRC29'),
        Source(30, 'Source 30', 3, 'contested', 'SRC30'),
        Source(31, 'Source 31', 3, 'probable', 'SRC31'),
        ]

# }}}
SourceInstance = namedtuple('source_instance', ['id', 'source_id', 'evidence_id', 'source_page', 'source_confidence', 'comment'])# {{{
source_instance_table = [
        SourceInstance( 1,  1,  1, '3934-3999', 'false', 'Comment 1'),
        SourceInstance( 2,  2,  2, '479', 'uncertain', 'Comment 2'),
        SourceInstance( 3,  3,  3, None, None, 'Comment 3'),
        SourceInstance( 4,  4,  4, '80', 'probable', None),
        SourceInstance( 5,  5,  5, '3334', 'false', 'Comment 5'),
        SourceInstance( 6,  6,  6, '3355', 'probable', 'Comment 6'),
        SourceInstance( 7,  7,  7, '2168', None, 'Comment 7'),
        SourceInstance( 8,  8,  8, '1383', 'contested', None),
        SourceInstance( 9,  9,  9, '56', None, 'Comment 9'),
        SourceInstance(10, 10, 10, '1202', None, 'Comment 10'),
        SourceInstance(11, 11, 11, '1878', 'probable', 'Comment 11'),
        SourceInstance(12, 12, 12, '1515', 'certain', 'Comment 12'),
        SourceInstance(13, 13, 13, '3174', 'uncertain', 'Comment 13'),
        SourceInstance(14, 14, 14, '509', None, None),
        SourceInstance(15, 15, 15, '2126', 'false', 'Comment 15'),
        SourceInstance(16, 16, 16, None, None, 'Comment 16'),
        SourceInstance(17, 17, 17, '1865', 'probable', 'Comment 17'),
        SourceInstance(18, 18, 18, '2730', 'probable', 'Comment 18'),
        SourceInstance(19, 19, 19, '2757', 'probable', 'Comment 19'),
        SourceInstance(20, 20, 20, '499', 'certain', None),
        SourceInstance(21, 21,  1, None, 'probable', None),
        SourceInstance(22, 22,  1, '1209', 'false', 'Comment 22'),
        SourceInstance(23, 23,  1, '1488', 'certain', 'Comment 23'),
        SourceInstance(24, 24,  2, '3335', 'false', 'Comment 24'),
        SourceInstance(25, 25,  2, '2204', 'false', 'Comment 25'),
        SourceInstance(26, 26,  2, '400', None, None),
        SourceInstance(27, 27,  2, '522', 'probable', 'Comment 27'),
        SourceInstance(28, 28,  2, None, 'uncertain', 'Comment 28'),
        SourceInstance(29, 29,  3, '2573', 'certain', None),
        SourceInstance(30,  1,  3, '3191', 'contested', 'Comment 30'),
        SourceInstance(31,  1,  3, None, None, None),
        SourceInstance(32,  2,  3, '1885', 'false', 'Comment 32'),
        SourceInstance(33,  3,  3, None, 'uncertain', 'Comment 33'),
        SourceInstance(34,  4,  3, None, 'uncertain', 'Comment 34'),
        ]

# }}}
Tag = namedtuple('tag', ['id', 'tagname', 'comment'])# {{{
tag_table = [
        Tag(1, 'tag1', 'test comment'),
        Tag(2, 'tag2', 'test comment 2'),
        Tag(3, 'tag3', 'test comment 3'),
        Tag(4, 'tag4', 'test comment 4'),
        Tag(5, 'tag5', None),
        Tag(6, 'tag6', 'lorem'),
        Tag(7, 'tag7', 'ipsum'),
        Tag(8, 'tag8', None),
        Tag(9, 'tag9', None),
        Tag(10, 'tag10', 'test'),
        ]

# }}}
TagEvidence = namedtuple('tag_evidence', ['id', 'tag_id', 'evidence_id'])# {{{
tag_evidence_table = [
        TagEvidence(1, 1, 1),
        TagEvidence(2, 2, 1),
        TagEvidence(3, 4, 2),
        TagEvidence(4, 7, 2),
        TagEvidence(5, 8, 2),
        TagEvidence(6, 1, 3),
        TagEvidence(7, 2, 5),
        TagEvidence(8, 4, 6),
        TagEvidence(9, 5, 7),
        TagEvidence(10, 5, 8),
        TagEvidence(11, 6, 9),
        TagEvidence(12, 8, 9),
        TagEvidence(13, 2, 10),
        TagEvidence(14, 3, 10),
        TagEvidence(15, 4, 10),
        TagEvidence(16, 1, 13),
        TagEvidence(17, 1, 17),
        TagEvidence(18, 7, 17),
        TagEvidence(19, 2, 18),
        TagEvidence(20, 1, 19),
        TagEvidence(21, 2, 19),
        TagEvidence(22, 8, 19),
        TagEvidence(23, 9, 19),
        TagEvidence(24, 10, 19),
        TagEvidence(25, 1, 20),
        TagEvidence(26, 2, 20),
        TagEvidence(27, 2, 22),
        TagEvidence(28, 3, 22),
        TagEvidence(29, 3, 23),
        TagEvidence(30, 4, 23),
        TagEvidence(31, 5, 24),
        TagEvidence(32, 7, 24),
        ]

# }}}
UserAction = namedtuple('user_action', ['id', 'evidence_id', 'action_type_id', 'user_id', 'timestamp', 'description', 'old_value', 'comment'])# {{{
user_action_table = [
        UserAction(1, 1, 1, 4, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 1', None, None),
        UserAction(2, 2, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 2', None, None),
        UserAction(3, 3, 1, 3, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 3', None, 'comment'),
        UserAction(4, 4, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 4', None, None),
        UserAction(5, 5, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 5', None, None),
        UserAction(6, 6, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 6', None, None),
        UserAction(7, 7, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 7', None, 'comment'),
        UserAction(8, 8, 1, 4, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 8', None, None),
        UserAction(9, 9, 1, 3, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 9', None, None),
        UserAction(10, 10, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 10', None, None),
        UserAction(11, 11, 1, 3, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 11', None, 'comment'),
        UserAction(12, 12, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 12', None, None),
        UserAction(13, 13, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 13', None, 'comment'),
        UserAction(14, 14, 1, 3, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 14', None, None),
        UserAction(15, 15, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 15', None, None),
        UserAction(16, 16, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 16', None, 'comment'),
        UserAction(17, 17, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 17', None, 'comment'),
        UserAction(18, 18, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 18', None, None),
        UserAction(19, 19, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 19', None, 'comment'),
        UserAction(20, 20, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 20', None, None),
        UserAction(21, 21, 1, 4, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 21', None, None),
        UserAction(22, 22, 1, 3, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 22', None, 'comment'),
        UserAction(23, 23, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 23', None, 'comment'),
        UserAction(24, 24, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 24', None, None),
        UserAction(25, 25, 1, 3, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 25', None, None),
        UserAction(26, 26, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 26', None, 'comment'),
        UserAction(27, 27, 1, 2, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 27', None, 'comment'),
        UserAction(28, 28, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 28', None, None),
        UserAction(29, 29, 1, 1, datetime.datetime(2020, 4, 20, 14, 0, 0), 'Create evidence 29', None, None),

        UserAction(30, 7, 4, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=9), 'Modify ', {"foo": 1}, 'comment'),
        UserAction(31, 5, 2, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=45), 'Modify ', {"a": "b"}, 'comment'),
        UserAction(32, 15, 4, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=227), 'Modify ', {"x": True, "y": 12}, 'comment'),
        UserAction(33, 28, 3, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=380), 'Modify ', {"val": 12}, None),
        UserAction(34, 4, 2, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=523), 'Modify ', {"val": 13}, 'comment'),
        UserAction(35, 12, 3, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=702), 'Modify ', {"val": 14}, None),
        UserAction(36, 11, 4, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=814), 'Modify ', {"val": 15}, 'comment'),
        UserAction(37, 17, 2, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=911), 'Modify ', {"val": 16}, 'comment'),
        UserAction(38, 23, 2, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1027), 'Modify ', {"val": 17}, None),
        UserAction(39, 15, 2, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1250), 'Modify ', {"val": 18}, 'comment'),
        UserAction(40, 24, 2, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1331), 'Modify ', {"val": 19}, None),
        UserAction(41, 2, 4, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1517), 'Modify ', {"val": 20}, None),
        UserAction(42, 12, 4, 1, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1522), 'Modify ', {"val": 21}, None),
        UserAction(43, 11, 2, 1, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1696), 'Modify ', {"val": 22}, 'comment'),
        UserAction(44, 5, 2, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1803), 'Modify ', {"val": 23}, None),
        UserAction(45, 25, 3, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1850), 'Modify ', {"val": 24}, 'comment'),
        UserAction(46, 5, 3, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1958), 'Modify ', {"val": 25}, 'comment'),
        UserAction(47, 4, 4, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=1987), 'Modify ', {}, None),
        UserAction(48, 9, 3, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2035), 'Modify ', {"val": 27}, None),
        UserAction(49, 25, 3, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2257), 'Modify ', {"val": 28}, None),
UserAction(50, 18, 3, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2334), 'Modify ', {"val": 29}, 'comment'),
        UserAction(51, 29, 3, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2407), 'Modify ', {"val": 30}, None),
        UserAction(52, 5, 3, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2538), 'Modify ', {"val": 31}, 'comment'),
        UserAction(53, 28, 4, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2550), 'Modify ', None, None),
        UserAction(54, 22, 3, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2646), 'Modify ', {"val": 33}, 'comment'),
        UserAction(55, 16, 4, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2695), 'Modify ', {"val": 34}, 'comment'),
        UserAction(56, 5, 4, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2732), 'Modify ', {"val": 35}, None),
        UserAction(57, 15, 3, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2846), 'Modify ', {"val": 36}, None),
        UserAction(58, 26, 2, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=2971), 'Modify ', {"val": 37}, 'comment'),
        UserAction(59, 9, 4, 1, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=3197), 'Modify ', {"xyz": 38, "testval": 11.623, "d": None}, None),
        UserAction(60, 7, 3, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=3304), 'Modify ', {"val": 39}, 'comment'),
        UserAction(61, 19, 3, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=3450), 'Modify ', {"val": 40}, 'comment'),
        UserAction(62, 14, 4, 1, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=3555), 'Modify ', {"val": 41}, 'comment'),
        UserAction(63, 1, 4, 1, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=3681), 'Modify ', {"val": 42}, None),
        UserAction(64, 27, 4, 1, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=3684), 'Modify ', {"val": 43}, None),
        UserAction(65, 5, 2, 1, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=3921), 'Modify ', {"val": 44}, None),
        UserAction(66, 21, 2, 3, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=4007), 'Modify ', {"val": 45}, None),
        UserAction(67, 10, 2, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=4111), 'Modify ', {"val": 46}, None),
        UserAction(68, 17, 4, 2, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=4347), 'Modify ', {"val": 47}, None),
        UserAction(69, 1, 4, 4, datetime.datetime(2020, 4, 20, 14, 0, 0) + datetime.timedelta(minutes=4503), 'Modify ', {"val": 48}, 'comment'),
        ]

# }}}
ExternalDatabase = namedtuple('external_database', ['id', 'name', 'short_name', 'url', 'comment']) # {{{
external_database_table = [
    ExternalDatabase(1, 'The first external database: An example', 'First DB', 'https://first.db/', None),
    ExternalDatabase(2, 'The second external database: An example', 'Second DB', 'https://x.second.db/', 'comment'),
    ExternalDatabase(3, 'The third', 'Third', None, None),
        ]
# }}}
UriNamespace = namedtuple('uri_namespace', ['id', 'external_database_id', 'uri_pattern', 'short_name', 'comment']) # {{{
uri_namespace_table = [
    UriNamespace(1, 1, 'https://first.db/place/%s', 'first:%s', 'Place URIs in first DB'),
    UriNamespace(2, 1, 'https://first.db/person/%s', 'first:%s', 'Person URIs in first DB'),
    UriNamespace(3, 2, 'https://x.second.db/place/%s', 'second:%s', 'Place URIs in second DB'),
    UriNamespace(4, 3, '%s', 'third:%s', 'General URIs in third DB (URI is whole URL)'),
        ]
# }}}
ExternalPlaceUri = namedtuple('external_place_uri', ['id', 'place_id', 'uri_namespace_id', 'uri_fragment', 'comment'])
external_place_uri_table = [
    ExternalPlaceUri(1, 1, 1, '26211', 'URI in first: .../place/26211'),
    ExternalPlaceUri(2, 1, 3, '711', 'URI in second: .../place/711'),
    ExternalPlaceUri(3, 1, 4, 'http://place.of.interest/foo/bar', None),
    ExternalPlaceUri(4, 2, 1, '26212', None),
    ExternalPlaceUri(5, 3, 1, '26314', None),
    ExternalPlaceUri(6, 4, 1, '26416', None),
    ExternalPlaceUri(7, 5, 1, '26518', None),
    ExternalPlaceUri(8, 6, 1, '26610', None),
    ExternalPlaceUri(9, 6, 3, '6', 'comment'),
    ExternalPlaceUri(10, 7, 1, '26712', None),
    ExternalPlaceUri(11, 8, 1, '26814', None),
    ExternalPlaceUri(12, 9, 1, '26916', None),
    ExternalPlaceUri(13, 10, 4, 'http://foo.bar/baz', None),
    ExternalPlaceUri(14, 11, 4, 'http://goo/x', None),
    ExternalPlaceUri(15, 12, 4, 'http://x.y.z/f', None),
        ]
# }}}
ExternalPersonUri = namedtuple('external_person_uri', ['id', 'person_id', 'uri_namespace_id', 'uri_fragment', 'comment'])
external_person_uri_table = [
    ExternalPersonUri(1, 1, 2, '411', 'URI in first'),
    ExternalPersonUri(2, 3, 2, '412', 'URI in first'),
    ExternalPersonUri(3, 5, 2, '413', 'URI in first'),
    ExternalPersonUri(4, 7, 2, '414', 'URI in first'),
    ExternalPersonUri(5, 7, 4, 'http://uris.org/first.db/414', 'URI in third'),
        ]
# }}}



if __name__ == '__main__':
    import re, sys
    m = re.fullmatch(R'(\d+)-(.*)', sys.argv[1])
    assert m, sys.argv[1]

    num, tablename = m[1], m[2]
    data = globals()[F'{tablename}_table']

    t = type(data[0])
    fname = F'sql-data.d/{num}-{t.__name__}-data.generated.sql'
    with open(fname, 'w') as f:
        write_table(f, t, data)


