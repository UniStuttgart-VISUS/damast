import re
import json
import psycopg2

class NumericRangeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, psycopg2.extras.NumericRange):
            return [
                    None if o.lower is None else o.lower if o.lower_inc else o.lower + 1,
                    None if o.upper is None else o.upper if o.upper_inc else o.upper - 1
                    ]
        return json.JSONEncoder.default(self, o)


geoloc = re.compile(R"\((.*),\s*(.*)\)", re.ASCII)
def parse_geoloc(s):
    if s is None:
        return None
    else:
        m = geoloc.fullmatch(s)
        return dict(lat=float(m[1]), lng=float(m[2]))

def parse_place(place):
    d = dict(id=place.id, location_confidence=place.location_confidence, name=place.name, place_type=place.place_type)
    d['geoloc'] = parse_geoloc(place.geoloc)

    return d

def format_geoloc(g):
    return None if g is None else F'({g["lat"]},{g["lng"]})'

def parse_evidence(record):
    d = dict(
            tuple_id=record.tuple_id,
            place_id=record.place_id,
            religion_id=record.religion_id,
            time_confidence=record.time_confidence,
            location_confidence=record.location_confidence,
            place_attribution_confidence=record.place_attribution_confidence,
            source_confidences=record.source_confidences,
            interpretation_confidence=record.interpretation_confidence,
            religion_confidence=record.religion_confidence,
            source_ids=record.source_ids
            )
    ts = record.time_span
    start_time = None if ts is None else ts.lower if (ts.lower is None or ts.lower_inc) else ts.lower+1
    end_time = None if ts is None else ts.upper if (ts.upper is None or ts.upper_inc) else ts.upper-1
    d['time_span'] = dict(start=start_time, end=end_time)

    return d


def istime(t):
    if isinstance(t, psycopg2.extras.NumericRange):
        if t.isempty:
            return False

        if t.lower_inf and t.upper_inf:
            return False

        return True

    return False
