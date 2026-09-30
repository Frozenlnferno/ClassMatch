-- Create the buckets required by the application for both local and hosted Supabase.
-- Existing buckets and their configuration are deliberately left untouched.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    (
        'images',
        'images',
        TRUE,
        10485760,
        ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']::TEXT[]
    ),
    (
        'schedule-ics',
        'schedule-ics',
        FALSE,
        5242880,
        NULL
    )
ON CONFLICT (id) DO NOTHING;
