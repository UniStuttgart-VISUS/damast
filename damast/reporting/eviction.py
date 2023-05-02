import os

from ..config import get_config

def get_eviction_params():
    conf = get_config()
    return conf.report_eviction_deferral, conf.report_eviction_maxsize


def does_evict():
    d, m = get_eviction_params()
    return (d is not None) or (m is not None)
