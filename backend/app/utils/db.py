from contextlib import contextmanager
from psycopg2 import DatabaseError, InterfaceError, OperationalError
from app import extensions
from app.utils.logger import get_logger

logger = get_logger(__name__)

_CONNECTION_LOSS_MESSAGES = (
    "server closed the connection unexpectedly",
    "connection already closed",
    "ssl syscall error",
    "eof detected",
    "terminating connection",
)


class _LoggingCursor:
    def __init__(self, cursor):
        self._cursor = cursor
        self.last_query = None
        self.last_operation = None

    def execute(self, query, params=None):
        self.last_query = query
        self.last_operation = "execute"
        if params is None:
            return self._cursor.execute(query)
        return self._cursor.execute(query, params)

    def executemany(self, query, params_seq):
        self.last_query = query
        self.last_operation = "executemany"
        return self._cursor.executemany(query, params_seq)

    def __getattr__(self, item):
        return getattr(self._cursor, item)


def _sanitize_query(query):
    if not query:
        return None
    query = " ".join(str(query).split())
    return query[:500]


def _should_discard_connection(conn, exc=None):
    if conn is None:
        return False
    if getattr(conn, "closed", False):
        return True
    if exc is None or not isinstance(exc, (OperationalError, InterfaceError, DatabaseError)):
        return False

    error = str(exc).lower()
    return any(message in error for message in _CONNECTION_LOSS_MESSAGES)

# Use "with get_cursor() as cur:" to write/read to postgres
@contextmanager
def get_cursor():
    conn = None
    cur = None
    raw_cursor = None
    discard_conn = False

    conn = extensions.db_pool.getconn() # Finds avaliable slot to init connection
    try:
        raw_cursor = conn.cursor() # Create cursor instance
        cur = _LoggingCursor(raw_cursor)
        yield cur
        conn.commit() # Commits Postgres write (won't do anything on reads)
    except Exception as exc:
        logger.exception(
            "Database operation failed",
            extra={
                "db_operation": getattr(cur, "last_operation", None),
                "query": _sanitize_query(getattr(cur, "last_query", None)),
                "error": str(exc),
            },
        )
        discard_conn = _should_discard_connection(conn, exc)
        if conn and not conn.closed:
            try:
                conn.rollback() # Undo any writes if error
            except (DatabaseError, InterfaceError, OperationalError) as rollback_exc:
                discard_conn = True
                logger.warning(
                    "Failed to roll back database connection",
                    extra={"error": str(rollback_exc)},
                )
        raise
    finally:
        if raw_cursor is not None:
            try:
                raw_cursor.close()
            except Exception as close_exc:
                discard_conn = True
                logger.warning(
                    "Failed to close database cursor",
                    extra={"error": str(close_exc)},
                )
        if conn is not None:
            discard_conn = discard_conn or _should_discard_connection(conn)
            extensions.db_pool.putconn(conn, close=discard_conn) # Marks slot as free to use again
