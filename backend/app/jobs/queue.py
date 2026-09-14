import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app import extensions
from app.config import Config

READY_KEY = "schedule_jobs:ready"
PROCESSING_KEY = "schedule_jobs:processing"
JOB_KEY_PREFIX = "schedule_job:"
LATEST_KEY_PREFIX = "schedule_jobs:latest:"

STATUS_QUEUED = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_CANCELED = "canceled"
TERMINAL_STATUSES = {STATUS_COMPLETED, STATUS_FAILED, STATUS_CANCELED}

JOB_TYPE_ICS = "ics_schedule_import"
JOB_TYPE_CRN = "crn_schedule_import"


def _job_key(job_id: str) -> str:
    return f"{JOB_KEY_PREFIX}{job_id}"


def _latest_key(user_id: str, year: int | str, term: str, job_type: str) -> str:
    return f"{LATEST_KEY_PREFIX}{user_id}:{year}:{term}:{job_type}"


def _now_epoch() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _to_epoch(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _decode_payload(value: str | None):
    if not value:
        return None
    return json.loads(value)


def _serialize_payload(payload: dict[str, Any] | None) -> str:
    return json.dumps(payload or {}, separators=(",", ":"), sort_keys=True)


ENQUEUE_JOB_LUA = """
  local jobKey = KEYS[1]
  local readyKey = KEYS[2]
  local latestKey = KEYS[3]

  local jobId = ARGV[1]
  local nowTs = ARGV[2]
  local availableAt = ARGV[3]
  local maxAttempts = ARGV[4]
  local jobType = ARGV[5]
  local userId = ARGV[6]
  local year = ARGV[7]
  local term = ARGV[8]
  local payloadJson = ARGV[9]
  local objectPath = ARGV[10]
  local originalFilename = ARGV[11]

  local previousJobId = redis.call("GET", latestKey)
  if previousJobId and previousJobId ~= jobId then
    local previousKey = "schedule_job:" .. previousJobId
    local previousStatus = redis.call("HGET", previousKey, "status")
    if previousStatus == "queued" or previousStatus == "processing" then
      redis.call("HSET", previousKey,
        "status", "canceled",
        "superseded_by", jobId,
        "updated_at", nowTs
      )
      redis.call("ZREM", readyKey, previousJobId)
      redis.call("ZREM", "schedule_jobs:processing", previousJobId)
      redis.call("EXPIRE", previousKey, tonumber(ARGV[12]))
    end
  end

  redis.call("HSET", jobKey,
    "job_id", jobId,
    "job_type", jobType,
    "status", "queued",
    "user_id", userId,
    "year", year,
    "term", term,
    "attempts", "0",
    "max_attempts", maxAttempts,
    "payload_json", payloadJson,
    "object_path", objectPath,
    "original_filename", originalFilename,
    "last_error", "",
    "result_payload", "",
    "lease_token", "",
    "worker_id", "",
    "claimed_at", "",
    "lease_expires_at", "",
    "superseded_by", "",
    "created_at", nowTs,
    "updated_at", nowTs
  )
  redis.call("SET", latestKey, jobId)
  redis.call("ZADD", readyKey, availableAt, jobId)

  return previousJobId or ""
"""


CLAIM_NEXT_JOB_LUA = """
  local readyKey = KEYS[1]
  local processingKey = KEYS[2]

  local nowTs = tonumber(ARGV[1])
  local leaseSeconds = tonumber(ARGV[2])
  local workerId = ARGV[3]
  local leaseToken = ARGV[4]

  local jobs = redis.call("ZRANGEBYSCORE", readyKey, "-inf", nowTs, "LIMIT", 0, 1)
  if #jobs == 0 then
    return {}
  end

  local jobId = jobs[1]
  local jobKey = "schedule_job:" .. jobId
  local latestKey = "schedule_jobs:latest:" .. redis.call("HGET", jobKey, "user_id") .. ":" .. redis.call("HGET", jobKey, "year") .. ":" .. redis.call("HGET", jobKey, "term") .. ":" .. redis.call("HGET", jobKey, "job_type")
  local latestJobId = redis.call("GET", latestKey)
  local status = redis.call("HGET", jobKey, "status")

  redis.call("ZREM", readyKey, jobId)

  if status ~= "queued" then
    return {}
  end

  if latestJobId and latestJobId ~= jobId then
    redis.call("HSET", jobKey, "status", "canceled", "superseded_by", latestJobId, "updated_at", nowTs)
    redis.call("EXPIRE", jobKey, tonumber(ARGV[5]))
    return {}
  end

  local attempts = tonumber(redis.call("HINCRBY", jobKey, "attempts", 1))
  local leaseExpiresAt = nowTs + leaseSeconds
  redis.call("HSET", jobKey,
    "status", "processing",
    "worker_id", workerId,
    "lease_token", leaseToken,
    "claimed_at", nowTs,
    "lease_expires_at", leaseExpiresAt,
    "updated_at", nowTs
  )
  redis.call("ZADD", processingKey, leaseExpiresAt, jobId)

  return redis.call("HGETALL", jobKey)
"""


HEARTBEAT_JOB_LUA = """
  local jobKey = KEYS[1]
  local processingKey = KEYS[2]
  local jobId = ARGV[1]
  local leaseToken = ARGV[2]
  local nowTs = tonumber(ARGV[3])
  local leaseExpiresAt = tonumber(ARGV[4])

  if redis.call("HGET", jobKey, "lease_token") ~= leaseToken then
    return 0
  end

  if redis.call("HGET", jobKey, "status") ~= "processing" then
    return 0
  end

  redis.call("HSET", jobKey, "lease_expires_at", leaseExpiresAt, "updated_at", nowTs)
  redis.call("ZADD", processingKey, leaseExpiresAt, jobId)
  return 1
"""


COMPLETE_JOB_LUA = """
  local jobKey = KEYS[1]
  local processingKey = KEYS[2]
  local latestKey = KEYS[3]

  local jobId = ARGV[1]
  local leaseToken = ARGV[2]
  local nowTs = ARGV[3]
  local resultPayload = ARGV[4]
  local ttlSeconds = tonumber(ARGV[5])

  if redis.call("HGET", jobKey, "lease_token") ~= leaseToken then
    return "stale_lease"
  end

  local latestJobId = redis.call("GET", latestKey)
  if latestJobId and latestJobId ~= jobId then
    redis.call("ZREM", processingKey, jobId)
    redis.call("HSET", jobKey,
      "status", "canceled",
      "superseded_by", latestJobId,
      "updated_at", nowTs
    )
    redis.call("EXPIRE", jobKey, ttlSeconds)
    return "superseded"
  end

  redis.call("ZREM", processingKey, jobId)
  redis.call("HSET", jobKey,
    "status", "completed",
    "result_payload", resultPayload,
    "updated_at", nowTs,
    "lease_token", "",
    "worker_id", "",
    "lease_expires_at", ""
  )
  redis.call("EXPIRE", jobKey, ttlSeconds)
  return "completed"
"""


FAIL_OR_RETRY_JOB_LUA = """
  local jobKey = KEYS[1]
  local readyKey = KEYS[2]
  local processingKey = KEYS[3]
  local latestKey = KEYS[4]

  local jobId = ARGV[1]
  local leaseToken = ARGV[2]
  local nowTs = tonumber(ARGV[3])
  local errorMessage = ARGV[4]
  local ttlSeconds = tonumber(ARGV[5])
  local retryBaseDelay = tonumber(ARGV[6])

  if redis.call("HGET", jobKey, "lease_token") ~= leaseToken then
    return "stale_lease"
  end

  redis.call("ZREM", processingKey, jobId)

  local latestJobId = redis.call("GET", latestKey)
  if latestJobId and latestJobId ~= jobId then
    redis.call("HSET", jobKey,
      "status", "canceled",
      "superseded_by", latestJobId,
      "last_error", errorMessage,
      "updated_at", nowTs
    )
    redis.call("EXPIRE", jobKey, ttlSeconds)
    return "superseded"
  end

  local attempts = tonumber(redis.call("HGET", jobKey, "attempts") or "0")
  local maxAttempts = tonumber(redis.call("HGET", jobKey, "max_attempts") or "1")

  if attempts < maxAttempts then
    local delay = retryBaseDelay * math.floor(math.pow(2, attempts - 1))
    local availableAt = nowTs + delay
    redis.call("HSET", jobKey,
      "status", "queued",
      "last_error", errorMessage,
      "updated_at", nowTs,
      "lease_token", "",
      "worker_id", "",
      "lease_expires_at", "",
      "claimed_at", ""
    )
    redis.call("ZADD", readyKey, availableAt, jobId)
    return "retried"
  end

  redis.call("HSET", jobKey,
    "status", "failed",
    "last_error", errorMessage,
    "updated_at", nowTs,
    "lease_token", "",
    "worker_id", "",
    "lease_expires_at", "",
    "claimed_at", ""
  )
  redis.call("EXPIRE", jobKey, ttlSeconds)
  return "failed"
"""


REQUEUE_EXPIRED_JOBS_LUA = """
  local readyKey = KEYS[1]
  local processingKey = KEYS[2]

  local nowTs = tonumber(ARGV[1])
  local retryBaseDelay = tonumber(ARGV[2])
  local ttlSeconds = tonumber(ARGV[3])
  local maxJobs = tonumber(ARGV[4])

  local expiredJobs = redis.call("ZRANGEBYSCORE", processingKey, "-inf", nowTs, "LIMIT", 0, maxJobs)
  local reclaimed = {}

  for _, jobId in ipairs(expiredJobs) do
    local jobKey = "schedule_job:" .. jobId
    local status = redis.call("HGET", jobKey, "status")
    local leaseExpiresAt = tonumber(redis.call("HGET", jobKey, "lease_expires_at") or "0")
    if status == "processing" and leaseExpiresAt > 0 and leaseExpiresAt <= nowTs then
      redis.call("ZREM", processingKey, jobId)
      local attempts = tonumber(redis.call("HGET", jobKey, "attempts") or "0")
      local maxAttempts = tonumber(redis.call("HGET", jobKey, "max_attempts") or "1")
      if attempts < maxAttempts then
        local delay = retryBaseDelay * math.floor(math.pow(2, attempts - 1))
        local availableAt = nowTs + delay
        redis.call("HSET", jobKey,
          "status", "queued",
          "last_error", "Job lease expired before completion.",
          "updated_at", nowTs,
          "lease_token", "",
          "worker_id", "",
          "lease_expires_at", "",
          "claimed_at", ""
        )
        redis.call("ZADD", readyKey, availableAt, jobId)
        table.insert(reclaimed, jobId)
      else
        redis.call("HSET", jobKey,
          "status", "failed",
          "last_error", "Job lease expired before completion.",
          "updated_at", nowTs,
          "lease_token", "",
          "worker_id", "",
          "lease_expires_at", "",
          "claimed_at", ""
        )
        redis.call("EXPIRE", jobKey, ttlSeconds)
        table.insert(reclaimed, jobId)
      end
    end
  end

  return reclaimed
"""


@dataclass
class Lease:
    job_id: str
    lease_token: str
    worker_id: str


class RedisJobQueue:
    def __init__(self, redis_client=None):
        self.redis = redis_client or extensions.redis_client
        self._scripts = {
            "enqueue": self.redis.register_script(ENQUEUE_JOB_LUA),
            "claim": self.redis.register_script(CLAIM_NEXT_JOB_LUA),
            "heartbeat": self.redis.register_script(HEARTBEAT_JOB_LUA),
            "complete": self.redis.register_script(COMPLETE_JOB_LUA),
            "fail_or_retry": self.redis.register_script(FAIL_OR_RETRY_JOB_LUA),
            "requeue_expired": self.redis.register_script(REQUEUE_EXPIRED_JOBS_LUA),
        }

    def enqueue_job(self, job_id: str, metadata: dict[str, Any], available_at: int | None = None) -> None:
        now_ts = _now_epoch()
        job_type = metadata["job_type"]
        latest_key = _latest_key(metadata["user_id"], metadata["year"], metadata["term"], job_type)
        self._scripts["enqueue"](
            keys=[_job_key(job_id), READY_KEY, latest_key],
            args=[
                job_id,
                str(now_ts),
                str(available_at or now_ts),
                str(metadata["max_attempts"]),
                job_type,
                metadata["user_id"],
                str(metadata["year"]),
                metadata["term"],
                metadata.get("payload_json", ""),
                metadata.get("object_path", ""),
                metadata.get("original_filename", ""),
                str(Config.REDIS_JOB_RESULT_TTL_SECONDS),
            ],
        )

    def claim_next_job(self, worker_id: str) -> dict[str, Any] | None:
        response = self._scripts["claim"](
            keys=[READY_KEY, PROCESSING_KEY],
            args=[
                str(_now_epoch()),
                str(Config.REDIS_JOB_LEASE_SECONDS),
                worker_id,
                uuid4().hex,
                str(Config.REDIS_JOB_RESULT_TTL_SECONDS),
            ],
        )
        if not response:
            return None
        data = dict(zip(response[::2], response[1::2]))
        return self._decode_job(data)

    def heartbeat(self, lease: Lease) -> bool:
        now_ts = _now_epoch()
        lease_expires_at = now_ts + Config.REDIS_JOB_LEASE_SECONDS
        result = self._scripts["heartbeat"](
            keys=[_job_key(lease.job_id), PROCESSING_KEY],
            args=[lease.job_id, lease.lease_token, str(now_ts), str(lease_expires_at)],
        )
        return bool(result)

    def complete_job(self, lease: Lease, metadata: dict[str, Any], result_payload: dict[str, Any]) -> str:
        return self._scripts["complete"](
            keys=[
                _job_key(lease.job_id),
                PROCESSING_KEY,
                _latest_key(metadata["user_id"], metadata["year"], metadata["term"], metadata["job_type"]),
            ],
            args=[
                lease.job_id,
                lease.lease_token,
                str(_now_epoch()),
                _serialize_payload(result_payload),
                str(Config.REDIS_JOB_RESULT_TTL_SECONDS),
            ],
        )

    def fail_or_retry_job(self, lease: Lease, metadata: dict[str, Any], error_message: str) -> str:
        return self._scripts["fail_or_retry"](
            keys=[
                _job_key(lease.job_id),
                READY_KEY,
                PROCESSING_KEY,
                _latest_key(metadata["user_id"], metadata["year"], metadata["term"], metadata["job_type"]),
            ],
            args=[
                lease.job_id,
                lease.lease_token,
                str(_now_epoch()),
                error_message,
                str(Config.REDIS_JOB_RESULT_TTL_SECONDS),
                str(Config.REDIS_JOB_RETRY_BASE_DELAY_SECONDS),
            ],
        )

    def requeue_expired_jobs(self, max_jobs: int = 20) -> list[str]:
        reclaimed = self._scripts["requeue_expired"](
            keys=[READY_KEY, PROCESSING_KEY],
            args=[
                str(_now_epoch()),
                str(Config.REDIS_JOB_RETRY_BASE_DELAY_SECONDS),
                str(Config.REDIS_JOB_RESULT_TTL_SECONDS),
                str(max_jobs),
            ],
        )
        return list(reclaimed or [])

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        data = self.redis.hgetall(_job_key(job_id))
        if not data:
            return None
        return self._decode_job(data)

    @staticmethod
    def build_lease(job: dict[str, Any]) -> Lease:
        return Lease(
            job_id=job["job_id"],
            lease_token=job["lease_token"],
            worker_id=job.get("worker_id", ""),
        )

    def _decode_job(self, data: dict[str, Any]) -> dict[str, Any]:
        decoded = dict(data)
        decoded["attempts"] = _to_epoch(decoded.get("attempts"))
        decoded["max_attempts"] = _to_epoch(decoded.get("max_attempts"), Config.REDIS_JOB_MAX_ATTEMPTS)
        decoded["year"] = _to_epoch(decoded.get("year"))
        decoded["created_at"] = _to_epoch(decoded.get("created_at"))
        decoded["updated_at"] = _to_epoch(decoded.get("updated_at"))
        decoded["claimed_at"] = _to_epoch(decoded.get("claimed_at"))
        decoded["lease_expires_at"] = _to_epoch(decoded.get("lease_expires_at"))
        decoded["payload"] = _decode_payload(decoded.get("payload_json"))
        decoded["result"] = _decode_payload(decoded.get("result_payload"))
        return decoded


def job_terminal(job: dict[str, Any] | None) -> bool:
    return bool(job and job.get("status") in TERMINAL_STATUSES)
