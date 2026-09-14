


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" bigint NOT NULL,
    "subject" "text" NOT NULL,
    "number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


ALTER TABLE "public"."classes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."classes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."group_invites" (
    "id" bigint NOT NULL,
    "group_id" bigint NOT NULL,
    "created_by" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "max_uses" integer,
    "use_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_invites_max_uses_check" CHECK ((("max_uses" IS NULL) OR ("max_uses" > 0))),
    CONSTRAINT "group_invites_use_count_check" CHECK (("use_count" >= 0))
);


ALTER TABLE "public"."group_invites" OWNER TO "postgres";


ALTER TABLE "public"."group_invites" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."group_invites_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "group_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "join_code" "text",
    "joinable" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_icon_url" "text"
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


ALTER TABLE "public"."groups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."schedule_sections" (
    "schedule_id" bigint NOT NULL,
    "section_id" bigint NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schedule_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "term" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedules_term_check" CHECK (("term" = ANY (ARRAY['fall'::"text", 'spring'::"text", 'summer'::"text"])))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


ALTER TABLE "public"."schedules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."schedules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sections" (
    "id" bigint NOT NULL,
    "year" integer NOT NULL,
    "term" "text" NOT NULL,
    "class_id" bigint NOT NULL,
    "section" "text",
    "crn" "text" NOT NULL,
    "course_type" "text",
    "instructor" "text",
    "building" "text",
    "room_number" "text",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "days_of_week" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sections_term_check" CHECK (("term" = ANY (ARRAY['fall'::"text", 'spring'::"text", 'summer'::"text"])))
);


ALTER TABLE "public"."sections" OWNER TO "postgres";


ALTER TABLE "public"."sections" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."sections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bio" "text",
    "avatar_url" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_subject_number_key" UNIQUE ("subject", "number");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "user_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_join_code_key" UNIQUE ("join_code");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_sections"
    ADD CONSTRAINT "schedule_sections_pkey" PRIMARY KEY ("schedule_id", "section_id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_user_id_term_year_key" UNIQUE ("user_id", "term", "year");



ALTER TABLE ONLY "public"."sections"
    ADD CONSTRAINT "sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sections"
    ADD CONSTRAINT "sections_year_term_crn_key" UNIQUE ("year", "term", "crn");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "group_invites_active_lookup_idx" ON "public"."group_invites" USING "btree" ("token_hash", "expires_at") WHERE ("revoked_at" IS NULL);



CREATE INDEX "group_invites_group_id_idx" ON "public"."group_invites" USING "btree" ("group_id");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."schedule_sections"
    ADD CONSTRAINT "schedule_sections_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_sections"
    ADD CONSTRAINT "schedule_sections_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sections"
    ADD CONSTRAINT "sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_members_select_same_group" ON "public"."group_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "my_membership"
  WHERE (("my_membership"."group_id" = "group_members"."group_id") AND ("my_membership"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_select_member" ON "public"."groups" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "groups"."id") AND ("gm"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."schedule_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_sections_select_own_schedule" ON "public"."schedule_sections" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."schedules" "s"
  WHERE (("s"."id" = "schedule_sections"."schedule_id") AND ("s"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedules_select_self" ON "public"."schedules" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_self" ON "public"."users" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "users_update_self" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."classes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."group_invites" TO "service_role";



GRANT ALL ON SEQUENCE "public"."group_invites_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."groups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_sections" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."schedules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

revoke delete on table "public"."classes" from "anon";

revoke insert on table "public"."classes" from "anon";

revoke references on table "public"."classes" from "anon";

revoke select on table "public"."classes" from "anon";

revoke trigger on table "public"."classes" from "anon";

revoke truncate on table "public"."classes" from "anon";

revoke update on table "public"."classes" from "anon";

revoke delete on table "public"."classes" from "authenticated";

revoke insert on table "public"."classes" from "authenticated";

revoke references on table "public"."classes" from "authenticated";

revoke select on table "public"."classes" from "authenticated";

revoke trigger on table "public"."classes" from "authenticated";

revoke truncate on table "public"."classes" from "authenticated";

revoke update on table "public"."classes" from "authenticated";

revoke delete on table "public"."group_invites" from "anon";

revoke insert on table "public"."group_invites" from "anon";

revoke references on table "public"."group_invites" from "anon";

revoke select on table "public"."group_invites" from "anon";

revoke trigger on table "public"."group_invites" from "anon";

revoke truncate on table "public"."group_invites" from "anon";

revoke update on table "public"."group_invites" from "anon";

revoke delete on table "public"."group_invites" from "authenticated";

revoke insert on table "public"."group_invites" from "authenticated";

revoke references on table "public"."group_invites" from "authenticated";

revoke select on table "public"."group_invites" from "authenticated";

revoke trigger on table "public"."group_invites" from "authenticated";

revoke truncate on table "public"."group_invites" from "authenticated";

revoke update on table "public"."group_invites" from "authenticated";

revoke delete on table "public"."group_members" from "anon";

revoke insert on table "public"."group_members" from "anon";

revoke references on table "public"."group_members" from "anon";

revoke select on table "public"."group_members" from "anon";

revoke trigger on table "public"."group_members" from "anon";

revoke truncate on table "public"."group_members" from "anon";

revoke update on table "public"."group_members" from "anon";

revoke delete on table "public"."group_members" from "authenticated";

revoke insert on table "public"."group_members" from "authenticated";

revoke references on table "public"."group_members" from "authenticated";

revoke select on table "public"."group_members" from "authenticated";

revoke trigger on table "public"."group_members" from "authenticated";

revoke truncate on table "public"."group_members" from "authenticated";

revoke update on table "public"."group_members" from "authenticated";

revoke delete on table "public"."groups" from "anon";

revoke insert on table "public"."groups" from "anon";

revoke references on table "public"."groups" from "anon";

revoke select on table "public"."groups" from "anon";

revoke trigger on table "public"."groups" from "anon";

revoke truncate on table "public"."groups" from "anon";

revoke update on table "public"."groups" from "anon";

revoke delete on table "public"."groups" from "authenticated";

revoke insert on table "public"."groups" from "authenticated";

revoke references on table "public"."groups" from "authenticated";

revoke select on table "public"."groups" from "authenticated";

revoke trigger on table "public"."groups" from "authenticated";

revoke truncate on table "public"."groups" from "authenticated";

revoke update on table "public"."groups" from "authenticated";

revoke delete on table "public"."schedule_sections" from "anon";

revoke insert on table "public"."schedule_sections" from "anon";

revoke references on table "public"."schedule_sections" from "anon";

revoke select on table "public"."schedule_sections" from "anon";

revoke trigger on table "public"."schedule_sections" from "anon";

revoke truncate on table "public"."schedule_sections" from "anon";

revoke update on table "public"."schedule_sections" from "anon";

revoke delete on table "public"."schedule_sections" from "authenticated";

revoke insert on table "public"."schedule_sections" from "authenticated";

revoke references on table "public"."schedule_sections" from "authenticated";

revoke select on table "public"."schedule_sections" from "authenticated";

revoke trigger on table "public"."schedule_sections" from "authenticated";

revoke truncate on table "public"."schedule_sections" from "authenticated";

revoke update on table "public"."schedule_sections" from "authenticated";

revoke delete on table "public"."schedules" from "anon";

revoke insert on table "public"."schedules" from "anon";

revoke references on table "public"."schedules" from "anon";

revoke select on table "public"."schedules" from "anon";

revoke trigger on table "public"."schedules" from "anon";

revoke truncate on table "public"."schedules" from "anon";

revoke update on table "public"."schedules" from "anon";

revoke delete on table "public"."schedules" from "authenticated";

revoke insert on table "public"."schedules" from "authenticated";

revoke references on table "public"."schedules" from "authenticated";

revoke select on table "public"."schedules" from "authenticated";

revoke trigger on table "public"."schedules" from "authenticated";

revoke truncate on table "public"."schedules" from "authenticated";

revoke update on table "public"."schedules" from "authenticated";

revoke delete on table "public"."sections" from "anon";

revoke insert on table "public"."sections" from "anon";

revoke references on table "public"."sections" from "anon";

revoke select on table "public"."sections" from "anon";

revoke trigger on table "public"."sections" from "anon";

revoke truncate on table "public"."sections" from "anon";

revoke update on table "public"."sections" from "anon";

revoke delete on table "public"."sections" from "authenticated";

revoke insert on table "public"."sections" from "authenticated";

revoke references on table "public"."sections" from "authenticated";

revoke select on table "public"."sections" from "authenticated";

revoke trigger on table "public"."sections" from "authenticated";

revoke truncate on table "public"."sections" from "authenticated";

revoke update on table "public"."sections" from "authenticated";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke select on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


