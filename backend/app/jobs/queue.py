import json
from dataclasses import dataclass
from typing import Any, Callable
from uuid import UUID, uuid4

from app.config import Config
from app.utils.db import get_cursor

STATUS_QUEUED = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_CANCELED = "canceled"
TERMINAL_STATUSES = {STATUS_COMPLETED, STATUS_FAILED, STATUS_CANCELED}

JOB_TYPE_ICS = "ics_schedule_import"
JOB_TYPE_CRN = "crn_schedule_import"

_JOB_COLUMNS = """
    id, user_id, job_type, status, year, term, payload, object_path,
    original_filename, result, last_error, attempts, max_attempts,
    available_at, claimed_at, lease_token, lease_expires_at, worker_id,
    superseded_by, cleanup_after, created_at, updated_at
"""


@dataclass(frozen=True)
class Lease:
    job_id: str
    lease_token: str
    worker_id: str


def _json_value(value):
    if value is None or isinstance(value, (dict, list)):
        return value
    return json.loads(value)


def _serialize(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, separators=(",", ":"), sort_keys=True)


class PostgresJobQueue:
    """Durable PostgreSQL queue with short transactions and leased claims."""

    def _decode_job(self, row) -> dict[str, Any] | None:
        if not row:
            return None
        keys = [
            "job_id", "user_id", "job_type", "status", "year", "term", "payload",
            "object_path", "original_filename", "result", "last_error", "attempts",
            "max_attempts", "available_at", "claimed_at", "lease_token",
            "lease_expires_at", "worker_id", "superseded_by", "cleanup_after",
            "created_at", "updated_at",
        ]
        job = dict(zip(keys, row))
        job["job_id"] = str(job["job_id"])
        job["user_id"] = str(job["user_id"])
        job["lease_token"] = str(job["lease_token"]) if job["lease_token"] else ""
        job["superseded_by"] = str(job["superseded_by"]) if job["superseded_by"] else ""
        job["payload"] = _json_value(job["payload"]) or {}
        job["result"] = _json_value(job["result"])
        return job

    @staticmethod
    def _scope(user_id: str, job_type: str, year: int | None, term: str | None) -> str:
        return f"schedule-job:{user_id}:{job_type}:{year if year is not None else 'pending'}:{term or 'pending'}"

    def enqueue_job(self, job_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
        year = metadata.get("year")
        term = metadata.get("term")
        if year == 0:
            year, term = None, None
        scope = self._scope(metadata["user_id"], metadata["job_type"], year, term)

        with get_cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (scope,))
            cur.execute(
                f"""
                INSERT INTO schedule_import_jobs ({_JOB_COLUMNS})
                VALUES (%s, %s, %s, 'queued', %s, %s, %s::jsonb, %s, %s, NULL, NULL,
                        0, %s, now(), NULL, NULL, NULL, NULL, NULL, NULL, now(), now())
                RETURNING id
                """,
                (job_id, metadata["user_id"], metadata["job_type"], year, term,
                 metadata.get("payload_json") or "{}", metadata.get("object_path") or None,
                 metadata.get("original_filename") or None, metadata["max_attempts"]),
            )
            cur.fetchone()
            cur.execute(
                """
                UPDATE schedule_import_jobs
                SET status = 'canceled', superseded_by = %s,
                    cleanup_after = now() + (%s * interval '1 second'), updated_at = now()
                WHERE id <> %s AND user_id = %s AND job_type = %s
                  AND year IS NOT DISTINCT FROM %s AND term IS NOT DISTINCT FROM %s
                  AND status IN ('queued', 'processing')
                """,
                (job_id, Config.JOB_RESULT_TTL_SECONDS, job_id, metadata["user_id"], metadata["job_type"], year, term),
            )
            cur.execute(f"SELECT {_JOB_COLUMNS} FROM schedule_import_jobs WHERE id = %s", (job_id,))
            return self._decode_job(cur.fetchone())

    def reclaim_expired_jobs(self, max_jobs: int = 20) -> list[str]:
        with get_cursor() as cur:
            cur.execute(
                """
                WITH expired AS (
                    SELECT id, attempts, max_attempts FROM schedule_import_jobs
                    WHERE status = 'processing' AND lease_expires_at <= now()
                    ORDER BY lease_expires_at FOR UPDATE SKIP LOCKED LIMIT %s
                )
                UPDATE schedule_import_jobs job
                SET status = CASE WHEN expired.attempts < expired.max_attempts THEN 'queued' ELSE 'failed' END,
                    available_at = CASE WHEN expired.attempts < expired.max_attempts
                        THEN now() + ((%s * power(2, greatest(expired.attempts - 1, 0))) * interval '1 second')
                        ELSE job.available_at END,
                    last_error = 'Job lease expired before completion.',
                    lease_token = NULL, worker_id = NULL, claimed_at = NULL, lease_expires_at = NULL,
                    cleanup_after = CASE WHEN expired.attempts < expired.max_attempts THEN NULL
                        ELSE now() + (%s * interval '1 second') END,
                    updated_at = now()
                FROM expired WHERE job.id = expired.id RETURNING job.id
                """,
                (max_jobs, Config.JOB_RETRY_BASE_DELAY_SECONDS, Config.JOB_RESULT_TTL_SECONDS),
            )
            return [str(row[0]) for row in cur.fetchall()]

    def claim_next_job(self, worker_id: str) -> dict[str, Any] | None:
        lease_token = uuid4()
        with get_cursor() as cur:
            cur.execute(
                f"""
                WITH candidate AS (
                    SELECT id FROM schedule_import_jobs
                    WHERE status = 'queued' AND available_at <= now()
                    ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1
                )
                UPDATE schedule_import_jobs job
                SET status = 'processing', attempts = job.attempts + 1,
                    worker_id = %s, lease_token = %s, claimed_at = now(),
                    lease_expires_at = now() + (%s * interval '1 second'), updated_at = now()
                FROM candidate WHERE job.id = candidate.id AND job.status = 'queued'
                RETURNING {_JOB_COLUMNS}
                """,
                (worker_id, str(lease_token), Config.JOB_LEASE_SECONDS),
            )
            return self._decode_job(cur.fetchone())

    def heartbeat(self, lease: Lease) -> bool:
        with get_cursor() as cur:
            cur.execute(
                """
                UPDATE schedule_import_jobs
                SET lease_expires_at = now() + (%s * interval '1 second'), updated_at = now()
                WHERE id = %s AND status = 'processing' AND worker_id = %s
                  AND lease_token = %s AND lease_expires_at > now()
                """,
                (Config.JOB_LEASE_SECONDS, lease.job_id, lease.worker_id, lease.lease_token),
            )
            return cur.rowcount == 1

    def complete_with_schedule(self, lease: Lease, result_payload: dict[str, Any], persist_schedule: Callable[[Any], None]) -> str:
        with get_cursor() as cur:
            cur.execute(
                """SELECT status, lease_token, worker_id, lease_expires_at
                   FROM schedule_import_jobs WHERE id = %s FOR UPDATE""",
                (lease.job_id,),
            )
            row = cur.fetchone()
            if not row or row[0] != STATUS_PROCESSING or str(row[1] or "") != lease.lease_token or row[2] != lease.worker_id:
                return "superseded" if row and row[0] == STATUS_CANCELED else "stale_lease"
            cur.execute("SELECT now()")
            if row[3] <= cur.fetchone()[0]:
                return "stale_lease"
            persist_schedule(cur)
            cur.execute(
                """
                UPDATE schedule_import_jobs
                SET status = 'completed', result = %s::jsonb, lease_token = NULL,
                    worker_id = NULL, lease_expires_at = NULL,
                    cleanup_after = now() + (%s * interval '1 second'), updated_at = now()
                WHERE id = %s
                """,
                (_serialize(result_payload), Config.JOB_RESULT_TTL_SECONDS, lease.job_id),
            )
            return "completed"

    def fail_or_retry_job(self, lease: Lease, error_message: str) -> str:
        with get_cursor() as cur:
            cur.execute(
                """SELECT status, attempts, max_attempts, lease_token, worker_id
                   FROM schedule_import_jobs WHERE id = %s FOR UPDATE""", (lease.job_id,)
            )
            row = cur.fetchone()
            if not row or str(row[3] or "") != lease.lease_token or row[4] != lease.worker_id:
                return "stale_lease"
            if row[0] == STATUS_CANCELED:
                return "superseded"
            if row[0] != STATUS_PROCESSING:
                return "stale_lease"
            attempts, max_attempts = row[1], row[2]
            if attempts < max_attempts:
                cur.execute(
                    """
                    UPDATE schedule_import_jobs
                    SET status = 'queued', available_at = now() + ((%s * power(2, %s)) * interval '1 second'),
                        last_error = %s, lease_token = NULL, worker_id = NULL, claimed_at = NULL,
                        lease_expires_at = NULL, updated_at = now() WHERE id = %s
                    """, (Config.JOB_RETRY_BASE_DELAY_SECONDS, attempts - 1, error_message, lease.job_id)
                )
                return "retried"
            cur.execute(
                """
                UPDATE schedule_import_jobs
                SET status = 'failed', last_error = %s, lease_token = NULL, worker_id = NULL,
                    claimed_at = NULL, lease_expires_at = NULL,
                    cleanup_after = now() + (%s * interval '1 second'), updated_at = now() WHERE id = %s
                """, (error_message, Config.JOB_RESULT_TTL_SECONDS, lease.job_id)
            )
            return "failed"

    def cleanup_terminal_jobs(self, max_jobs: int = 100) -> list[dict[str, Any]]:
        with get_cursor() as cur:
            cur.execute(
                f"""
                DELETE FROM schedule_import_jobs WHERE id IN (
                    SELECT id FROM schedule_import_jobs WHERE cleanup_after <= now()
                    ORDER BY cleanup_after FOR UPDATE SKIP LOCKED LIMIT %s
                ) RETURNING {_JOB_COLUMNS}
                """, (max_jobs,)
            )
            return [self._decode_job(row) for row in cur.fetchall()]

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        try:
            parsed_id = UUID(str(job_id))
        except ValueError:
            return None
        with get_cursor() as cur:
            cur.execute(f"SELECT {_JOB_COLUMNS} FROM schedule_import_jobs WHERE id = %s", (str(parsed_id),))
            return self._decode_job(cur.fetchone())

    @staticmethod
    def build_lease(job: dict[str, Any]) -> Lease:
        return Lease(job_id=job["job_id"], lease_token=job["lease_token"], worker_id=job["worker_id"])


def job_terminal(job: dict[str, Any] | None) -> bool:
    return bool(job and job.get("status") in TERMINAL_STATUSES)
