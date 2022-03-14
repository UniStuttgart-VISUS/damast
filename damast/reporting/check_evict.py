import os
from datetime import date
import logging
import traceback

from .report_database import get_report_database, evict_report, ReportTuple
from .eviction import get_eviction_params, does_evict

def register_scheduler(sched):
    if 'DAMAST_REPORT_EVICTION_DEFERRAL' in os.environ or 'DAMAST_REPORT_EVICTION_MAXSIZE' in os.environ:
        logging.getLogger('flask.error').info('Registering report eviction job to run each day at 3AM.')
        sched.add_job(check_for_evictable, trigger='cron', hour='3', minute='0')
    else:
        logging.getLogger('flask.error').info('Reports will not be evicted regularly.')


def check_for_evictable():
    '''
    Check the report database for reports that can be evicted, and do so with those.

    Reports can be evicted if they have not been accessed for
    ${DAMAST_REPORT_EVICTION_DEFERRAL} days. Alternatively, if the report
    database size (cumulative size of report contents) exceeds
    ${DAMAST_REPORT_EVICTION_MAXSIZE} MB, reports are also evicted in
    ascending order of last access time.
    '''
    deferral, maxsize = get_eviction_params()

    if deferral is None and maxsize is None:
        logging.getLogger('flask.error').warning('Report eviction is not turned on, but the eviction check function was called.')
        return

    logging.getLogger('flask.error').info('Checking for evictable reports.')

    try:
        # get all reports
        with get_report_database() as db:
            db.execute(F'SELECT {", ".join(ReportTuple._fields)} FROM reports WHERE report_state <> ? ORDER BY last_access ASC;', ('evicted',))
            reports = list(map(lambda row: ReportTuple(*row), db.fetchall()))
            to_evict_deferral = list()
            to_evict_maxsize = list()
            today = date.today()

            if deferral is not None:
                for r in reports:
                    days = (today - r.last_access.date()).days
                    if days > deferral:
                        to_evict_deferral.append(r.uuid)

                logging.getLogger('flask.error').info('%d report%s will be evicted because they have not been accessed for %d days.',
                        len(to_evict_deferral),
                        '' if len(to_evict_deferral) == 1 else 's',
                        deferral)


            if maxsize is not None:
                maxsize = 1000000 * maxsize  # in bytes
                # get total size
                totalsize = 0
                candidates = []
                for r in filter(lambda r: r.uuid not in to_evict_deferral, reports):
                    size = 0
                    if r.content is not None:
                        size += len(bytes(r.content))
                    if r.pdf_map is not None:
                        size += len(bytes(r.pdf_map))
                    if r.pdf_report is not None:
                        size += len(bytes(r.pdf_report))

                    candidates.append((r, size))
                    totalsize += size

                rmsize = 0
                if totalsize > maxsize:
                    exceed = totalsize - maxsize
                    for r, size in candidates:
                        if exceed - rmsize <= 0:
                            break

                        rmsize += size
                        to_evict_maxsize.append(r.uuid)

                logging.getLogger('flask.error').info('%d report%s (%.1fMB) will be evicted to reduce database size below %dMB.',
                        len(to_evict_maxsize),
                        '' if len(to_evict_maxsize) == 1 else 's',
                        rmsize / 1000000, maxsize // 1000000)


            for uuid in [*to_evict_deferral, *to_evict_maxsize]:
                evict_report(uuid)

            db.execute('VACUUM;')


    except:
        tb = traceback.format_exc()
        logging.getLogger('flask.error').error('Something went wrong while checking for report evictions: %s', tb)

