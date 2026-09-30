CREATE TABLE public.schedule_import_jobs (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    job_type text NOT NULL CHECK (job_type IN ('ics_schedule_import', 'crn_schedule_import')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'canceled')),
    year integer,
    term text CHECK (term IN ('spring', 'summer', 'fall')),
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    object_path text,
    original_filename text,
    result jsonb,
    last_error text,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL CHECK (max_attempts > 0),
    available_at timestamptz NOT NULL DEFAULT now(),
    claimed_at timestamptz,
    lease_token uuid,
    lease_expires_at timestamptz,
    worker_id text,
    superseded_by uuid REFERENCES public.schedule_import_jobs(id),
    cleanup_after timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((year IS NULL AND term IS NULL) OR (year IS NOT NULL AND term IS NOT NULL))
);

CREATE INDEX schedule_import_jobs_ready_idx
    ON public.schedule_import_jobs (available_at, created_at)
    WHERE status = 'queued';
CREATE INDEX schedule_import_jobs_user_lookup_idx
    ON public.schedule_import_jobs (user_id, created_at DESC);
CREATE INDEX schedule_import_jobs_expired_lease_idx
    ON public.schedule_import_jobs (lease_expires_at)
    WHERE status = 'processing';
CREATE INDEX schedule_import_jobs_cleanup_idx
    ON public.schedule_import_jobs (cleanup_after)
    WHERE cleanup_after IS NOT NULL;

CREATE TABLE public.group_join_rate_limits (
    scope text PRIMARY KEY,
    window_started_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

CREATE INDEX group_join_rate_limits_window_idx
    ON public.group_join_rate_limits (window_started_at);
