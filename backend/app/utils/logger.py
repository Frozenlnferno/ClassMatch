import logging
import os

from flask import g, has_request_context, request
from pythonjsonlogger import jsonlogger


class RequestContextFilter(logging.Filter):
    def filter(self, record):
        record.request_id = "-"
        record.endpoint = "-"
        record.method = "-"
        if not hasattr(record, "status_code"):
            record.status_code = "-"
        if not hasattr(record, "response_time_ms"):
            record.response_time_ms = "-"
        if not hasattr(record, "error"):
            record.error = ""
        if not hasattr(record, "db_operation"):
            record.db_operation = ""
        if not hasattr(record, "query"):
            record.query = ""

        if has_request_context():
            record.request_id = getattr(g, "request_id", "-")
            record.endpoint = request.path
            record.method = request.method

        return True


def _is_production_mode():
    flask_env = os.getenv("FLASK_ENV", "").lower()
    return flask_env == "production"


def configure_logging():
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(logging.INFO)

    stream_handler = logging.StreamHandler()
    stream_handler.addFilter(RequestContextFilter())

    if _is_production_mode():
        formatter = jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s %(method)s %(endpoint)s %(status_code)s %(response_time_ms)s %(error)s %(db_operation)s %(query)s"
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | request_id=%(request_id)s | %(method)s %(endpoint)s | status=%(status_code)s | duration_ms=%(response_time_ms)s | %(message)s"
        )

    stream_handler.setFormatter(formatter)
    root_logger.addHandler(stream_handler)

    # Avoid duplicate per-request access logs when app-level request logging is enabled.
    werkzeug_logger = logging.getLogger("werkzeug")
    werkzeug_logger.setLevel(logging.WARNING)


def get_logger(name):
    return logging.getLogger(name)