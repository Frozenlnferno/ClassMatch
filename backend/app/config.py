import os
import posixpath
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


def _get_bool_env(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _validate_http_url(name: str, value: str | None):
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError(f"Invalid URL configured for {name}")


def _validate_database_url(name: str, value: str | None):
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    parsed = urlparse(value)
    if parsed.scheme not in {"postgresql", "postgres"} or not parsed.hostname:
        raise RuntimeError(f"Invalid database URL configured for {name}")


def _validate_positive_number(name: str, value, integer_only: bool = False):
    if value is None or value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    if integer_only and int(value) != value:
        raise RuntimeError(f"{name} must be an integer")


def _validate_redis_url(name: str, value: str | None):
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    parsed = urlparse(value)
    if parsed.scheme not in {"redis", "rediss"} or not parsed.hostname:
        raise RuntimeError(f"Invalid Redis URL configured for {name}")


class Config:
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
    SUPABASE_JWT_ISSUER = os.getenv("SUPABASE_JWT_ISSUER") or (
        f"{SUPABASE_URL.rstrip('/')}/auth/v1" if SUPABASE_URL else None
    )
    SUPABASE_JWT_AUDIENCE = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    SUPABASE_HTTP_TIMEOUT_SECONDS = float(os.getenv("SUPABASE_HTTP_TIMEOUT_SECONDS", "20"))
    SUPABASE_SCHEDULE_ICS_BUCKET = os.getenv("SUPABASE_SCHEDULE_ICS_BUCKET", "schedule-ics")
    SUPABASE_SCHEDULE_ICS_PREFIX = os.getenv("SUPABASE_SCHEDULE_ICS_PREFIX", "schedule-imports")
    UIUC_API_TIMEOUT_SECONDS = float(os.getenv("UIUC_API_TIMEOUT_SECONDS", "10"))
    MAX_IMAGE_UPLOAD_BYTES = int(os.getenv("MAX_IMAGE_UPLOAD_BYTES", str(5 * 1024 * 1024)))
    MAX_ICS_UPLOAD_BYTES = int(os.getenv("MAX_ICS_UPLOAD_BYTES", str(10 * 1024 * 1024)))
    MAX_MANUAL_COURSES_PER_REQUEST = int(os.getenv("MAX_MANUAL_COURSES_PER_REQUEST", "25"))
    DATABASE_URL = os.getenv("DATABASE_URL")
    DB_SSLMODE = os.getenv("DB_SSLMODE", "require")  # prod default
    LOG_OPTIONS_REQUESTS = _get_bool_env("LOG_OPTIONS_REQUESTS", False)
    REDIS_URL = os.getenv("REDIS_URL")
    REDIS_JOB_LEASE_SECONDS = int(os.getenv("REDIS_JOB_LEASE_SECONDS", "60"))
    REDIS_JOB_HEARTBEAT_SECONDS = int(os.getenv("REDIS_JOB_HEARTBEAT_SECONDS", "20"))
    REDIS_JOB_MAX_ATTEMPTS = int(os.getenv("REDIS_JOB_MAX_ATTEMPTS", "3"))
    REDIS_JOB_RETRY_BASE_DELAY_SECONDS = int(os.getenv("REDIS_JOB_RETRY_BASE_DELAY_SECONDS", "5"))
    REDIS_JOB_RESULT_TTL_SECONDS = int(os.getenv("REDIS_JOB_RESULT_TTL_SECONDS", str(24 * 60 * 60)))
    REDIS_JOB_POLL_INTERVAL_SECONDS = float(os.getenv("REDIS_JOB_POLL_INTERVAL_SECONDS", "1"))
    JWKS_URL = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else None

    @classmethod
    def build_schedule_ics_object_path(cls, user_id: str, filename: str, job_id: str) -> str:
        safe_filename = Path(filename or "schedule.ics").name or "schedule.ics"
        return posixpath.join(
            cls.SUPABASE_SCHEDULE_ICS_PREFIX.strip("/"),
            user_id,
            f"{job_id}-{safe_filename}",
        )

    @classmethod
    def validate(cls):
        _validate_http_url("FRONTEND_ORIGIN", cls.FRONTEND_ORIGIN)
        _validate_http_url("SUPABASE_URL", cls.SUPABASE_URL)
        _validate_http_url("SUPABASE_JWT_ISSUER", cls.SUPABASE_JWT_ISSUER)
        _validate_database_url("DATABASE_URL", cls.DATABASE_URL)
        _validate_redis_url("REDIS_URL", cls.REDIS_URL)

        if not cls.SUPABASE_SECRET_KEY:
            raise RuntimeError("Missing required environment variable: SUPABASE_SECRET_KEY")
        if not cls.SUPABASE_JWT_AUDIENCE:
            raise RuntimeError("Missing required environment variable: SUPABASE_JWT_AUDIENCE")
        if not cls.SUPABASE_SCHEDULE_ICS_BUCKET:
            raise RuntimeError("Missing required environment variable: SUPABASE_SCHEDULE_ICS_BUCKET")
        if not cls.SUPABASE_SCHEDULE_ICS_PREFIX:
            raise RuntimeError("Missing required environment variable: SUPABASE_SCHEDULE_ICS_PREFIX")

        _validate_positive_number("SUPABASE_HTTP_TIMEOUT_SECONDS", cls.SUPABASE_HTTP_TIMEOUT_SECONDS)
        _validate_positive_number("UIUC_API_TIMEOUT_SECONDS", cls.UIUC_API_TIMEOUT_SECONDS)
        _validate_positive_number("MAX_IMAGE_UPLOAD_BYTES", cls.MAX_IMAGE_UPLOAD_BYTES, integer_only=True)
        _validate_positive_number("MAX_ICS_UPLOAD_BYTES", cls.MAX_ICS_UPLOAD_BYTES, integer_only=True)
        _validate_positive_number("MAX_MANUAL_COURSES_PER_REQUEST", cls.MAX_MANUAL_COURSES_PER_REQUEST, integer_only=True)
        _validate_positive_number("REDIS_JOB_LEASE_SECONDS", cls.REDIS_JOB_LEASE_SECONDS, integer_only=True)
        _validate_positive_number("REDIS_JOB_HEARTBEAT_SECONDS", cls.REDIS_JOB_HEARTBEAT_SECONDS, integer_only=True)
        _validate_positive_number("REDIS_JOB_MAX_ATTEMPTS", cls.REDIS_JOB_MAX_ATTEMPTS, integer_only=True)
        _validate_positive_number("REDIS_JOB_RETRY_BASE_DELAY_SECONDS", cls.REDIS_JOB_RETRY_BASE_DELAY_SECONDS, integer_only=True)
        _validate_positive_number("REDIS_JOB_RESULT_TTL_SECONDS", cls.REDIS_JOB_RESULT_TTL_SECONDS, integer_only=True)
