from __future__ import annotations

import json
from uuid import uuid4

from app.config import Config
from app.jobs.queue import JOB_TYPE_CRN, JOB_TYPE_ICS, RedisJobQueue
from app.utils.supabase_admin import upload_private_file


def _build_job_response(job: dict) -> dict:
    response = {
        "job_id": job["job_id"],
        "job_type": job["job_type"],
        "status": job["status"],
        "attempts": job["attempts"],
        "max_attempts": job["max_attempts"],
        "year": job["year"],
        "term": job["term"],
    }
    if job.get("last_error"):
        response["last_error"] = job["last_error"]
    if job.get("result") is not None:
        response["result"] = job["result"]
    return response


def create_ics_import_job(user_id: str, ics_bytes: bytes, filename: str, content_type: str) -> dict:
    job_id = str(uuid4())
    object_path = Config.build_schedule_ics_object_path(user_id, filename, job_id)
    upload_private_file(object_path, ics_bytes, content_type, Config.SUPABASE_SCHEDULE_ICS_BUCKET)

    queue = RedisJobQueue()
    metadata = {
        "job_type": JOB_TYPE_ICS,
        "user_id": user_id,
        "year": 0,
        "term": "pending",
        "max_attempts": Config.REDIS_JOB_MAX_ATTEMPTS,
        "payload_json": "",
        "object_path": object_path,
        "original_filename": filename or "schedule.ics",
    }
    queue.enqueue_job(job_id, metadata)
    job = queue.get_job(job_id)
    return _build_job_response(job)


def create_crn_import_job(user_id: str, year: int, term: str, courses: list[dict]) -> dict:
    job_id = str(uuid4())
    queue = RedisJobQueue()
    metadata = {
        "job_type": JOB_TYPE_CRN,
        "user_id": user_id,
        "year": year,
        "term": term,
        "max_attempts": Config.REDIS_JOB_MAX_ATTEMPTS,
        "payload_json": json.dumps({"courses": courses}, separators=(",", ":"), sort_keys=True),
        "object_path": "",
        "original_filename": "",
    }
    queue.enqueue_job(job_id, metadata)
    job = queue.get_job(job_id)
    return _build_job_response(job)


def get_job_status_for_user(job_id: str, user_id: str) -> dict | None:
    queue = RedisJobQueue()
    job = queue.get_job(job_id)
    if not job or job.get("user_id") != user_id:
        return None
    return _build_job_response(job)
