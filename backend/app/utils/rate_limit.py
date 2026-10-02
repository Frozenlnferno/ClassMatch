from app.utils.db import get_cursor


def allow_join_attempt(user_id, ip_address, limit=10, window_seconds=60):
    """Return False after too many authenticated invite attempts in one window."""
    keys = sorted([
        f"rate_limit:group_join:user:{user_id}",
        f"rate_limit:group_join:ip:{ip_address or 'unknown'}",
    ])
    try:
        counts = {}
        with get_cursor() as cur:
            for key in keys:
                cur.execute(
                    """
                    INSERT INTO group_join_rate_limits (scope, window_started_at, attempts)
                    VALUES (%s, now(), 1)
                    ON CONFLICT (scope) DO UPDATE
                    SET attempts = CASE
                            WHEN group_join_rate_limits.window_started_at <= now() - (%s * interval '1 second') THEN 1
                            ELSE group_join_rate_limits.attempts + 1
                        END,
                        window_started_at = CASE
                            WHEN group_join_rate_limits.window_started_at <= now() - (%s * interval '1 second') THEN now()
                            ELSE group_join_rate_limits.window_started_at
                        END
                    RETURNING attempts
                    """,
                    (key, window_seconds, window_seconds),
                )
                counts[key] = cur.fetchone()[0]
        return counts[f"rate_limit:group_join:user:{user_id}"] <= limit and counts[f"rate_limit:group_join:ip:{ip_address or 'unknown'}"] <= limit * 2
    except Exception:
        # Rate limiting should not make the join path unavailable if storage is down.
        return True


def cleanup_expired_join_rate_limits(max_rows=100):
    """Remove expired fixed-window counters without blocking join requests."""
    try:
        with get_cursor() as cur:
            cur.execute(
                """
                DELETE FROM group_join_rate_limits
                WHERE scope IN (
                    SELECT scope FROM group_join_rate_limits
                    WHERE window_started_at <= now() - interval '1 day'
                    ORDER BY window_started_at
                    FOR UPDATE SKIP LOCKED
                    LIMIT %s
                )
                """,
                (max_rows,),
            )
    except Exception:
        return 0
