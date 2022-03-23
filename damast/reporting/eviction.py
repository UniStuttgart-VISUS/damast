import os

def get_eviction_params():
    try:
        deferral = int(os.environ.get('DAMAST_REPORT_EVICTION_DEFERRAL'))
    except (TypeError, ValueError):
        deferral = None

    try:
        maxsize = int(os.environ.get('DAMAST_REPORT_EVICTION_MAXSIZE'))
    except (TypeError, ValueError):
        maxsize = None

    return deferral, maxsize


def does_evict():
    d,m = get_eviction_params()
    return (d is not None) or (m is not None)
