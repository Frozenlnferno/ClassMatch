from app import extensions


def allow_join_attempt(user_id, ip_address, limit=10, window_seconds=60):
    """Return False after too many authenticated invite attempts in one window."""
    redis_client = extensions.redis_client
    if redis_client is None:
        return True

    keys = [
        f"rate_limit:group_join:user:{user_id}",
        f"rate_limit:group_join:ip:{ip_address or 'unknown'}",
    ]
    try:
        with redis_client.pipeline() as pipeline:
            for key in keys:
                pipeline.incr(key)
                pipeline.expire(key, window_seconds)
            results = pipeline.execute()
        return results[0] <= limit and results[2] <= limit * 2
    except Exception:
        # Rate limiting should not make the join path unavailable if Redis is down.
        return True
