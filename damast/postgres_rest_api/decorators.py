from functools import wraps
import flask
import psycopg2
import werkzeug.exceptions

def rest_endpoint(func_or_verbs):
    '''
    Wrapper for REST API endpoint functions.

    This wrapper handles database exceptions and provides an extra argument to
    the wrapped function, which contains the database cursor. The decorator
    optionally takes a list or tuple of HTTP verbs that are considered okay for
    read-only access of that endpoint.
    '''
    if not callable(func_or_verbs):
        # func_or_verbs is a list/tuple of HTTP verbs
        def doublewrapped(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                return _inner(func, func_or_verbs, *args, **kwargs)

            return wrapper

        return doublewrapped

    # func_or_verbs is decorated function
    @wraps(func_or_verbs)
    def wrapper(*args, **kwargs):
        return _inner(func_or_verbs, ('GET', 'HEAD'), *args, **kwargs)

    return wrapper


def _inner(wrapped_func, readonly_http_verbs, *args, **kwargs):
    try:
        user = flask.current_app.auth.current_user()

        # fail if not logged in
        if user is None:
            raise werkzeug.exceptions.Unauthorized('Not logged in.')

        if 'admin' not in user.roles and 'readdb' not in user.roles:
            raise werkzeug.exceptions.Forbidden('User may not read database.')
        readwrite = 'admin' in user.roles or 'writedb' in user.roles

        # check if method allows for readonly
        if not readwrite and flask.request.method not in readonly_http_verbs:
            raise werkzeug.exceptions.Forbidden('User may not write to database.')

        with flask.current_app.pg.get_cursor(readonly=(not readwrite)) as c:
            # actual REST endpoint call, with db cursor
            return wrapped_func(c, *args, **kwargs)


    except psycopg2.Error as err:
        if type(err) is psycopg2.ProgrammingError:
            msg = str(err)
        elif type(err) is psycopg2.DatabaseError:
            msg = 'Database error {}:\n{}'.format(err.pgcode, err.pgerror)
        elif type(err) in ( \
                psycopg2.errors.UniqueViolation, \
                psycopg2.errors.ForeignKeyViolation, \
                psycopg2.errors.RestrictViolation, \
                psycopg2.errors.NotNullViolation, \
                psycopg2.errors.CheckViolation, \
                ):
            msg = '{}: {}: {}'.format(err.diag.severity, err.pgcode, err.diag.message_primary)
            return msg, 409
        elif type(err) in ( \
                psycopg2.errors.DataException, \
                psycopg2.errors.InvalidTextRepresentation, \
                ):
            msg = '{}: {}: {}'.format(err.diag.severity, err.pgcode, err.diag.message_primary)
            return msg, 422
        elif type(err) in ( \
                psycopg2.errors.DatatypeMismatch, \
                ):
            msg = '{}: {}: {}'.format(err.diag.severity, err.pgcode, err.diag.message_primary)
            return msg, 400
        elif type(err) in ( \
                psycopg2.errors.InsufficientResources, \
                psycopg2.errors.DiskFull, \
                psycopg2.errors.OutOfMemory, \
                psycopg2.errors.TooManyConnections, \
                ):
            msg = '{}: {}: {}'.format(err.diag.severity, err.pgcode, err.diag.message_primary)
            return msg, 507
        elif type(err) in ( \
                psycopg2.errors.NoData, \
                psycopg2.errors.ConnectionException, \
                psycopg2.errors.SqlclientUnableToEstablishSqlconnection, \
                psycopg2.errors.ConnectionDoesNotExist, \
                psycopg2.errors.SqlserverRejectedEstablishmentOfSqlconnection, \
                psycopg2.errors.ConnectionFailure, \
                psycopg2.errors.TransactionResolutionUnknown, \
                psycopg2.errors.ProtocolViolation, \
                ):
            msg = '{}: {}: {}'.format(err.diag.severity, err.pgcode, err.diag.message_primary)
            return msg, 503
        else:
            msg = '{}: {}: {}'.format(err.diag.severity, err.pgcode, err.diag.message_primary)
        flask.abort(500, msg)

    except werkzeug.exceptions.HTTPException as err:
        return err.get_response()
