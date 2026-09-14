REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

REVOKE ALL ON TABLE public.classes FROM anon, authenticated;
REVOKE ALL ON TABLE public.sections FROM anon, authenticated;
REVOKE ALL ON TABLE public.group_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.groups FROM anon, authenticated;
REVOKE ALL ON TABLE public.schedule_sections FROM anon, authenticated;
REVOKE ALL ON TABLE public.schedules FROM anon, authenticated;
REVOKE ALL ON TABLE public.users FROM anon, authenticated;

REVOKE ALL ON SEQUENCE public.classes_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.groups_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.schedules_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.sections_id_seq FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

DROP POLICY IF EXISTS users_read_own ON public.users;
DROP POLICY IF EXISTS users_select_self ON public.users;
DROP POLICY IF EXISTS users_update_self ON public.users;
DROP POLICY IF EXISTS groups_select_member ON public.groups;
DROP POLICY IF EXISTS group_members_select_same_group ON public.group_members;
DROP POLICY IF EXISTS schedules_select_self ON public.schedules;
DROP POLICY IF EXISTS schedule_sections_select_own_schedule ON public.schedule_sections;

CREATE POLICY users_select_self
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY users_update_self
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY groups_select_member
ON public.groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = groups.id
      AND gm.user_id = auth.uid()
  )
);

CREATE POLICY group_members_select_same_group
ON public.group_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members my_membership
    WHERE my_membership.group_id = group_members.group_id
      AND my_membership.user_id = auth.uid()
  )
);

CREATE POLICY schedules_select_self
ON public.schedules
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY schedule_sections_select_own_schedule
ON public.schedule_sections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.schedules s
    WHERE s.id = schedule_sections.schedule_id
      AND s.user_id = auth.uid()
  )
);
