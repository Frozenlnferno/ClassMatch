import io
import os
import unittest
from contextlib import contextmanager
from unittest.mock import Mock, patch

import jwt
from psycopg2 import DatabaseError, OperationalError
from psycopg2 import pool
from jwt.exceptions import InvalidTokenError
from cryptography.hazmat.primitives.asymmetric import ec

from app import create_app, extensions
from app.config import Config
from app.jobs import service as jobs_service
from app.jobs.schedule_imports import ScheduleImportWorker
from app.jobs.queue import JOB_TYPE_CRN, JOB_TYPE_ICS, PostgresJobQueue
from app.routes.groups import groups_service
from app.routes.users import users_service
from app.routes.schedules.schedules_service import (
    TransientCourseApiError,
    _fetch_uiuc_course,
    extract_schedule_identifiers_from_ics,
)
from app.utils.supabase_admin import get_public_file_object_path
from app.utils.auth import verify_supabase_jwt
from app.utils import db as db_utils


SAMPLE_ICS = b"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Ellucian//Registration SS//EN
BEGIN:VEVENT
DTSTART;TZID=America/Chicago:20260120T123000
SUMMARY:Database Systems CS 411 U3
DESCRIPTION:CRN: 31352\\nCredit Hours: 3.0\\nInstructor: Alawini\\, Abdussalam (Primary) \\n
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/Chicago:20260121T100000
SUMMARY:Differential Equations MATH 441 B13
DESCRIPTION:CRN: 61553\\nCredit Hours: 3.0\\nInstructor: Tzirakis\\, Nikolaos (Primary) \\n
END:VEVENT
END:VCALENDAR
"""


class _DummySigningKey:
    def __init__(self, key):
        self.key = key


class _DummyJwksClient:
    def __init__(self, key):
        self._key = key

    def get_signing_key_from_jwt(self, _token):
        return _DummySigningKey(self._key)


class _FakeCursor:
    def __init__(self, fetchone_values=None, fetchall_values=None):
        self._fetchone_values = list(fetchone_values or [])
        self._fetchall_values = list(fetchall_values or [])
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((query, params))

    def fetchone(self):
        if not self._fetchone_values:
            return None
        return self._fetchone_values.pop(0)

    def fetchall(self):
        if not self._fetchall_values:
            return []
        return self._fetchall_values.pop(0)


class _DbFakeCursor:
    def __init__(self, execute_error=None, close_error=None):
        self.execute_error = execute_error
        self.close_error = close_error
        self.closed = False

    def execute(self, query, params=None):
        if self.execute_error:
            raise self.execute_error

    def close(self):
        self.closed = True
        if self.close_error:
            raise self.close_error


class _DbFakeConnection:
    def __init__(self, cursor, closed=False):
        self._cursor = cursor
        self.closed = int(closed)
        self.committed = False
        self.rolled_back = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class _DbFakePool:
    def __init__(self, conn):
        self.conn = conn
        self.putconn_calls = []

    def getconn(self):
        return self.conn

    def putconn(self, conn, close=False):
        self.putconn_calls.append((conn, close))


class BackendRouteTestCase(unittest.TestCase):
    def setUp(self):
        self.config_patcher = patch.multiple(
            Config,
            FRONTEND_ORIGIN="http://localhost:5173",
            SUPABASE_URL="http://127.0.0.1:54321",
            SUPABASE_SECRET_KEY="sb_secret_test",
            SUPABASE_JWT_ISSUER="http://127.0.0.1:54321/auth/v1",
            SUPABASE_JWT_AUDIENCE="authenticated",
            SUPABASE_HTTP_TIMEOUT_SECONDS=20.0,
            UIUC_API_TIMEOUT_SECONDS=5.0,
            MAX_IMAGE_UPLOAD_BYTES=16,
            MAX_ICS_UPLOAD_BYTES=32,
            MAX_MANUAL_COURSES_PER_REQUEST=2,
            DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres",
            DB_SSLMODE="disable",
            LOG_OPTIONS_REQUESTS=False,
            SUPABASE_SCHEDULE_ICS_BUCKET="schedule-ics",
            SUPABASE_SCHEDULE_ICS_PREFIX="schedule-imports",
            JOB_LEASE_SECONDS=60,
            JOB_HEARTBEAT_SECONDS=20,
            JOB_MAX_ATTEMPTS=3,
            JOB_RETRY_BASE_DELAY_SECONDS=5,
            JOB_RESULT_TTL_SECONDS=86400,
            JOB_POLL_INTERVAL_SECONDS=0.01,
            JWKS_URL="http://127.0.0.1:54321/auth/v1/.well-known/jwks.json",
        )
        self.config_patcher.start()
        self.init_db_pool_patcher = patch("app.init_db_pool", return_value=None)
        self.init_db_pool_patcher.start()
        self.app = create_app()
        self.app.testing = True
        self.client = self.app.test_client()

    def tearDown(self):
        self.init_db_pool_patcher.stop()
        self.config_patcher.stop()

    def _auth_header(self, sub="user-1"):
        claims = {
            "sub": sub,
            "aud": Config.SUPABASE_JWT_AUDIENCE,
            "iss": Config.SUPABASE_JWT_ISSUER,
        }
        verifier_patcher = patch("app.utils.auth.verify_supabase_jwt", return_value=claims)
        self.addCleanup(verifier_patcher.stop)
        verifier_patcher.start()
        return {"Authorization": "Bearer test-token"}

    def test_group_members_returns_404_for_non_member(self):
        with patch("app.routes.groups.groups_controller.get_group_members", side_effect=PermissionError("Group not found")):
            response = self.client.get("/api/groups/12/members", headers=self._auth_header())

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"], "Group not found")

    def test_join_group_uses_post_with_json_body(self):
        join_result = {
            "group_id": "group-1",
            "already_member": False,
        }
        with patch("app.routes.groups.groups_controller.join_group", return_value=join_result) as join_mock:
            response = self.client.post(
                "/api/groups/join",
                headers=self._auth_header(),
                json={"join_code": "ABC123"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "Group joined successfully")
        join_mock.assert_called_once_with("user-1", "ABC123")

    def test_join_group_rejects_get_requests(self):
        response = self.client.get(
            "/api/groups/join?join_code=ABC123",
            headers=self._auth_header(),
        )

        self.assertEqual(response.status_code, 405)

    def test_matching_classmates_returns_404_for_non_member(self):
        with patch("app.routes.schedules.schedules_controller.get_matching_classmates", side_effect=PermissionError("Group not found")):
            response = self.client.get(
                "/api/schedules/matching-classmates?group_id=12&term=fall&year=2026",
                headers=self._auth_header(),
            )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"], "Group not found")

    def test_change_role_rejects_owner_role(self):
        response = self.client.post(
            "/api/groups/12/change-role",
            json={"member_id": "user-2", "new_role": "owner"},
            headers=self._auth_header(),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Invalid role specified")

    def test_avatar_upload_rejects_oversized_image(self):
        response = self.client.post(
            "/api/users/me/avatar",
            data={"image": (io.BytesIO(b"x" * 32), "avatar.png")},
            headers=self._auth_header(),
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("smaller than", response.get_json()["error"])

    def test_schedule_upload_rejects_oversized_ics(self):
        response = self.client.post(
            "/api/schedules/",
            data={"ics": (io.BytesIO(b"x" * 64), "schedule.ics")},
            headers=self._auth_header(),
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("smaller than", response.get_json()["error"])

    def test_manual_course_add_rejects_large_batch(self):
        response = self.client.post(
            "/api/schedules/courses?term=fall&year=2026",
            json={
                "courses": [
                    {"subject": "CS", "course": "101", "crn": "12345"},
                    {"subject": "MATH", "course": "241", "crn": "23456"},
                    {"subject": "STAT", "course": "400", "crn": "34567"},
                ]
            },
            headers=self._auth_header(),
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("at most", response.get_json()["error"])

    def test_manual_course_add_rejects_invalid_course_identifier(self):
        with patch("app.routes.schedules.schedules_controller.create_crn_import_job") as create_job:
            response = self.client.post(
                "/api/schedules/courses?term=fall&year=2026",
                json={"courses": [{"subject": "ANTH2", "course": "2", "crn": "12123"}]},
                headers=self._auth_header(),
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("2-5 letter subject", response.get_json()["error"])
        create_job.assert_not_called()

    def test_schedule_upload_returns_async_job(self):
        with patch(
            "app.routes.schedules.schedules_controller.create_ics_import_job",
            return_value={"job_id": "job-1", "job_type": "ics_schedule_import", "status": "queued"},
        ):
            response = self.client.post(
                "/api/schedules/",
                data={"ics": (io.BytesIO(b"x" * 16), "schedule.ics")},
                headers=self._auth_header(),
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.get_json()["job_id"], "job-1")

    def test_manual_course_add_returns_async_job(self):
        with patch(
            "app.routes.schedules.schedules_controller.create_crn_import_job",
            return_value={"job_id": "job-2", "job_type": "crn_schedule_import", "status": "queued"},
        ):
            response = self.client.post(
                "/api/schedules/courses?term=fall&year=2026",
                json={"courses": [{"subject": "CS", "course": "101", "crn": "12345"}]},
                headers=self._auth_header(),
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.get_json()["job_id"], "job-2")

    def test_schedule_job_status_route_returns_404_for_other_user(self):
        with patch("app.routes.schedules.schedules_controller.get_job_status_for_user", return_value=None):
            response = self.client.get("/api/schedules/jobs/job-404", headers=self._auth_header())

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"], "Job not found")

    def test_schedule_job_status_route_returns_job_payload(self):
        with patch(
            "app.routes.schedules.schedules_controller.get_job_status_for_user",
            return_value={"job_id": "job-3", "status": "processing", "job_type": "crn_schedule_import"},
        ):
            response = self.client.get("/api/schedules/jobs/job-3", headers=self._auth_header())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "processing")

    def test_profile_update_accepts_null_avatar_url(self):
        with patch(
            "app.routes.users.users_controller.get_self_info",
            return_value={"avatar_url": "http://127.0.0.1:54321/storage/v1/object/public/images/avatars/user-1/old.png"},
        ), patch("app.routes.users.users_controller.update_self_info") as update_self_info, patch(
            "app.routes.users.users_controller.delete_public_file_from_url"
        ) as delete_public_file_from_url:
            response = self.client.patch(
                "/api/users/me",
                json={"avatar_url": None},
                headers=self._auth_header(),
            )

        self.assertEqual(response.status_code, 200)
        update_self_info.assert_called_once_with("user-1", users_service.UNSET, users_service.UNSET, None)
        delete_public_file_from_url.assert_called_once()


class BackendServiceTestCase(unittest.TestCase):
    @staticmethod
    def _job_row(job_id, user_id, job_type, year, term):
        return (
            job_id, user_id, job_type, "queued", year, term, {}, None, None,
            None, None, 0, 3, None, None, None, None, None, None, None, None, None,
        )

    def test_crn_enqueue_does_not_supersede_an_active_job(self):
        cursor = Mock()
        cursor.fetchone.side_effect = [
            ("job-2",),
            self._job_row("job-2", "user-1", JOB_TYPE_CRN, 2026, "fall"),
        ]

        @contextmanager
        def fake_get_cursor():
            yield cursor

        with patch("app.jobs.queue.get_cursor", fake_get_cursor):
            PostgresJobQueue().enqueue_job("job-2", {
                "job_type": JOB_TYPE_CRN,
                "user_id": "user-1",
                "year": 2026,
                "term": "fall",
                "max_attempts": 3,
                "payload_json": '{"courses":[]}',
            })

        executed_queries = [str(call.args[0]) for call in cursor.execute.call_args_list]
        self.assertFalse(any("SET status = 'canceled'" in query for query in executed_queries))

    def test_ics_enqueue_supersedes_an_active_job(self):
        cursor = Mock()
        cursor.fetchone.side_effect = [
            ("job-2",),
            self._job_row("job-2", "user-1", JOB_TYPE_ICS, None, None),
        ]

        @contextmanager
        def fake_get_cursor():
            yield cursor

        with patch("app.jobs.queue.get_cursor", fake_get_cursor):
            PostgresJobQueue().enqueue_job("job-2", {
                "job_type": JOB_TYPE_ICS,
                "user_id": "user-1",
                "year": None,
                "term": None,
                "max_attempts": 3,
                "payload_json": "{}",
                "object_path": "schedule.ics",
            })

        executed_queries = [str(call.args[0]) for call in cursor.execute.call_args_list]
        self.assertTrue(any("SET status = 'canceled'" in query for query in executed_queries))

    def test_ics_enqueue_failure_removes_uploaded_object_and_preserves_error(self):
        enqueue_error = RuntimeError("database unavailable")
        queue = Mock()
        queue.enqueue_job.side_effect = enqueue_error

        with patch("app.jobs.service.PostgresJobQueue", return_value=queue), patch(
            "app.jobs.service.upload_private_file"
        ), patch("app.jobs.service.delete_file") as delete_file:
            with self.assertRaisesRegex(RuntimeError, "database unavailable") as exc:
                jobs_service.create_ics_import_job("user-1", SAMPLE_ICS, "schedule.ics", "text/calendar")

        self.assertIs(exc.exception, enqueue_error)
        delete_file.assert_called_once()

    def test_ics_enqueue_cleanup_failure_does_not_replace_enqueue_error(self):
        enqueue_error = RuntimeError("database unavailable")
        queue = Mock()
        queue.enqueue_job.side_effect = enqueue_error

        with patch("app.jobs.service.PostgresJobQueue", return_value=queue), patch(
            "app.jobs.service.upload_private_file"
        ), patch("app.jobs.service.delete_file", side_effect=RuntimeError("storage unavailable")):
            with self.assertRaisesRegex(RuntimeError, "database unavailable") as exc:
                jobs_service.create_ics_import_job("user-1", SAMPLE_ICS, "schedule.ics", "text/calendar")

        self.assertIs(exc.exception, enqueue_error)

    def test_worker_clears_object_path_after_successful_immediate_cleanup(self):
        queue = Mock()
        worker = ScheduleImportWorker(queue=queue)
        job = {"job_id": "job-1", "object_path": "schedule.ics"}

        with patch("app.jobs.schedule_imports.delete_file") as delete_file:
            worker._cleanup_job_object(job)

        delete_file.assert_called_once_with("schedule.ics", Config.SUPABASE_SCHEDULE_ICS_BUCKET)
        queue.clear_object_path.assert_called_once_with("job-1", "schedule.ics")

    def test_worker_retains_object_path_when_immediate_cleanup_fails(self):
        queue = Mock()
        worker = ScheduleImportWorker(queue=queue)

        with patch("app.jobs.schedule_imports.delete_file", side_effect=RuntimeError("storage unavailable")):
            worker._cleanup_job_object({"job_id": "job-1", "object_path": "schedule.ics"})

        queue.clear_object_path.assert_not_called()

    def test_cleanup_failure_does_not_change_completed_job_status(self):
        queue = Mock()
        queue.build_lease.return_value = Mock()
        queue.complete_with_schedule.return_value = "completed"
        worker = ScheduleImportWorker(queue=queue)
        job = {"job_id": "job-1", "job_type": JOB_TYPE_CRN, "object_path": "schedule.ics"}

        with patch.object(worker, "_process_crn_job", return_value=({"saved_count": 1}, Mock())), patch(
            "app.jobs.schedule_imports.delete_file", side_effect=RuntimeError("storage unavailable")
        ):
            worker.process_job(job)

        queue.complete_with_schedule.assert_called_once()
        queue.fail_or_retry_job.assert_not_called()

    def test_invalid_job_fails_without_retry_or_error_traceback(self):
        queue = Mock()
        queue.build_lease.return_value = Mock()
        queue.fail_or_retry_job.return_value = "failed"
        worker = ScheduleImportWorker(queue=queue)
        job = {"job_id": "job-1", "job_type": JOB_TYPE_CRN, "object_path": None}

        with patch.object(worker, "_process_crn_job", side_effect=ValueError("Invalid class")), patch(
            "app.jobs.schedule_imports.logger"
        ) as logger:
            worker.process_job(job)

        queue.fail_or_retry_job.assert_called_once_with(queue.build_lease.return_value, "Invalid class", retryable=False)
        logger.warning.assert_called_once()
        logger.exception.assert_not_called()

    def test_transient_course_api_failure_retries_without_error_traceback(self):
        queue = Mock()
        queue.build_lease.return_value = Mock()
        queue.fail_or_retry_job.return_value = "retried"
        worker = ScheduleImportWorker(queue=queue)
        job = {"job_id": "job-1", "job_type": JOB_TYPE_CRN, "object_path": None}

        with patch.object(
            worker,
            "_process_crn_job",
            side_effect=TransientCourseApiError("UIUC unavailable"),
        ), patch("app.jobs.schedule_imports.logger") as logger:
            worker.process_job(job)

        queue.fail_or_retry_job.assert_called_once_with(
            queue.build_lease.return_value,
            "UIUC unavailable",
            retryable=True,
        )
        logger.warning.assert_called_once()
        logger.exception.assert_not_called()

    def test_stale_worker_does_not_delete_object_needed_by_retry(self):
        queue = Mock()
        queue.build_lease.return_value = Mock()
        queue.complete_with_schedule.return_value = "stale_lease"
        worker = ScheduleImportWorker(queue=queue)
        job = {"job_id": "job-1", "job_type": JOB_TYPE_CRN, "object_path": "schedule.ics"}

        with patch.object(worker, "_process_crn_job", return_value=({"saved_count": 1}, Mock())), patch(
            "app.jobs.schedule_imports.delete_file"
        ) as delete_file:
            worker.process_job(job)

        delete_file.assert_not_called()

    def test_terminal_cleanup_deletes_row_only_after_object_cleanup(self):
        queue = Mock()
        queue.get_terminal_cleanup_candidates.return_value = [
            {"job_id": "job-1", "object_path": "schedule.ics"}
        ]
        worker = ScheduleImportWorker(queue=queue)

        with patch("app.jobs.schedule_imports.delete_file") as delete_file:
            worker._cleanup_terminal_jobs()

        delete_file.assert_called_once_with("schedule.ics", Config.SUPABASE_SCHEDULE_ICS_BUCKET)
        queue.delete_terminal_job.assert_called_once_with("job-1")

    def test_terminal_cleanup_retains_row_when_object_cleanup_fails(self):
        queue = Mock()
        queue.get_terminal_cleanup_candidates.return_value = [
            {"job_id": "job-1", "object_path": "schedule.ics"}
        ]
        worker = ScheduleImportWorker(queue=queue)

        with patch("app.jobs.schedule_imports.delete_file", side_effect=RuntimeError("storage unavailable")):
            worker._cleanup_terminal_jobs()

        queue.delete_terminal_job.assert_not_called()

    def test_init_db_pool_uses_threaded_connection_pool(self):
        threaded_pool = Mock()
        with patch.object(extensions, "db_pool", None), patch.object(
            extensions.pool, "ThreadedConnectionPool", return_value=threaded_pool
        ) as constructor, patch.multiple(
            Config,
            DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres",
            DB_SSLMODE="disable",
        ):
            result = extensions.init_db_pool()

        self.assertIs(result, threaded_pool)
        constructor.assert_called_once_with(
            minconn=1,
            maxconn=10,
            dsn="postgresql://postgres:postgres@localhost:5432/postgres",
            sslmode="disable",
        )

    def test_get_cursor_commits_and_returns_healthy_connection(self):
        cursor = _DbFakeCursor()
        conn = _DbFakeConnection(cursor)
        pool = _DbFakePool(conn)

        with patch.object(db_utils.extensions, "db_pool", pool):
            with db_utils.get_cursor() as cur:
                cur.execute("SELECT 1")

        self.assertTrue(conn.committed)
        self.assertFalse(conn.rolled_back)
        self.assertTrue(cursor.closed)
        self.assertEqual(pool.putconn_calls, [(conn, False)])

    def test_get_cursor_rolls_back_and_reuses_connection_for_query_error(self):
        cursor = _DbFakeCursor(execute_error=DatabaseError("syntax error at or near SELECT"))
        conn = _DbFakeConnection(cursor)
        pool = _DbFakePool(conn)

        with patch.object(db_utils.extensions, "db_pool", pool):
            with self.assertRaises(DatabaseError):
                with db_utils.get_cursor() as cur:
                    cur.execute("SELECT")

        self.assertFalse(conn.committed)
        self.assertTrue(conn.rolled_back)
        self.assertTrue(cursor.closed)
        self.assertEqual(pool.putconn_calls, [(conn, False)])

    def test_get_cursor_discards_connection_closed_by_server(self):
        cursor = _DbFakeCursor(
            execute_error=OperationalError("server closed the connection unexpectedly")
        )
        conn = _DbFakeConnection(cursor)
        pool = _DbFakePool(conn)

        with patch.object(db_utils.extensions, "db_pool", pool):
            with self.assertRaises(OperationalError):
                with db_utils.get_cursor() as cur:
                    cur.execute("SELECT 1")

        self.assertTrue(conn.rolled_back)
        self.assertTrue(cursor.closed)
        self.assertEqual(pool.putconn_calls, [(conn, True)])

    def test_get_cursor_discards_already_closed_connection_without_rollback(self):
        cursor = _DbFakeCursor(execute_error=DatabaseError("connection already closed"))
        conn = _DbFakeConnection(cursor, closed=True)
        pool = _DbFakePool(conn)

        with patch.object(db_utils.extensions, "db_pool", pool):
            with self.assertRaises(DatabaseError):
                with db_utils.get_cursor() as cur:
                    cur.execute("SELECT 1")

        self.assertFalse(conn.rolled_back)
        self.assertTrue(cursor.closed)
        self.assertEqual(pool.putconn_calls, [(conn, True)])

    def test_public_file_object_path_is_extracted_from_supabase_url(self):
        object_path = get_public_file_object_path(
            "http://127.0.0.1:54321/storage/v1/object/public/images/avatars/user-1/photo.png"
        )

        self.assertEqual(object_path, "avatars/user-1/photo.png")

    def test_update_self_info_can_clear_avatar_url(self):
        fake_cursor = _FakeCursor()

        @contextmanager
        def fake_get_cursor():
            yield fake_cursor

        with patch("app.routes.users.users_service.get_cursor", fake_get_cursor):
            users_service.update_self_info("user-1", avatar_url=None)

        self.assertEqual(fake_cursor.calls[0][1], [None, "user-1"])

    def test_kick_member_checks_requester_and_target_separately(self):
        fake_cursor = _FakeCursor(fetchone_values=[("admin",), ("owner",)])

        @contextmanager
        def fake_get_cursor():
            yield fake_cursor

        with patch("app.routes.groups.groups_service.get_cursor", fake_get_cursor):
            with self.assertRaises(PermissionError):
                groups_service.kick_member("admin-user", "owner-user", "12")

        self.assertEqual(len(fake_cursor.calls), 2)
        self.assertEqual(fake_cursor.calls[0][1], ("12", "admin-user"))
        self.assertEqual(fake_cursor.calls[1][1], ("12", "owner-user"))

    def test_ics_job_returns_partial_success_payload(self):
        queue = Mock()
        queue.get_job.return_value = {"status": "processing"}
        worker = ScheduleImportWorker(queue=queue)
        resolved_courses = [
            {
                "Title": "Intro to CS",
                "Subject": "CS",
                "Subject Number": "101",
                "Section": "A",
                "CRN": "12345",
                "Course Type": None,
                "Instructor": None,
                "Building": None,
                "Room Number": None,
                "Start Time": None,
                "End Time": None,
                "Days of Week": None,
            }
        ]
        skipped_courses = [
            {"subject": "MATH", "course_number": "241", "crn": "23456", "error": "UIUC course not found"}
        ]

        with patch("app.jobs.schedule_imports.download_private_file", return_value=SAMPLE_ICS), patch(
            "app.jobs.schedule_imports.extract_schedule_identifiers_from_ics",
            return_value=(
                [
                    {"Subject": "CS", "Subject Number": "101", "CRN": "12345"},
                    {"Subject": "MATH", "Subject Number": "241", "CRN": "23456"},
                ],
                {"year": 2026, "term": "fall"},
            ),
        ), patch(
            "app.jobs.schedule_imports.resolve_courses_from_uiuc_partial",
            return_value=(resolved_courses, skipped_courses),
        ), patch("app.jobs.schedule_imports.add_courses_by_ics") as add_courses:
            result, persist_schedule = worker._process_ics_job({"job_id": "job-1", "user_id": "user-1", "object_path": "path.ics"})
            transaction_cursor = Mock()
            persist_schedule(transaction_cursor)

        add_courses.assert_called_once_with("user-1", 2026, "fall", resolved_courses, cur=transaction_cursor)
        self.assertEqual(result["saved_count"], 1)
        self.assertEqual(result["skipped_count"], 1)
        self.assertEqual(result["skipped_courses"], skipped_courses)
        self.assertEqual(result["year"], 2026)
        self.assertEqual(result["term"], "fall")

    def test_crn_job_returns_partial_success_payload(self):
        worker = ScheduleImportWorker(queue=Mock())
        resolved_courses = [
            {
                "Title": "Data Structures",
                "Subject": "CS",
                "Subject Number": "225",
                "Section": "AL1",
                "CRN": "34567",
                "Course Type": None,
                "Instructor": None,
                "Building": None,
                "Room Number": None,
                "Start Time": None,
                "End Time": None,
                "Days of Week": None,
            }
        ]
        skipped_courses = [
            {"subject": "STAT", "course_number": "400", "crn": "45678", "error": "UIUC course not found"}
        ]

        with patch(
            "app.jobs.schedule_imports.resolve_courses_from_uiuc_partial",
            return_value=(resolved_courses, skipped_courses),
        ), patch("app.jobs.schedule_imports.add_resolved_courses_by_crn") as add_courses:
            result, persist_schedule = worker._process_crn_job(
                {
                    "user_id": "user-1",
                    "year": 2026,
                    "term": "fall",
                    "payload": {
                        "courses": [
                            {"Subject": "CS", "Subject Number": "225", "CRN": "34567"},
                            {"Subject": "STAT", "Subject Number": "400", "CRN": "45678"},
                        ]
                    },
                }
            )
            transaction_cursor = Mock()
            persist_schedule(transaction_cursor)

        add_courses.assert_called_once_with("user-1", 2026, "fall", resolved_courses, cur=transaction_cursor)
        self.assertEqual(result["saved_count"], 1)
        self.assertEqual(result["skipped_count"], 1)
        self.assertEqual(result["skipped_courses"], skipped_courses)

    def test_ics_job_fails_when_all_courses_are_skipped_without_persisting(self):
        queue = Mock()
        queue.get_job.return_value = {"status": "processing"}
        worker = ScheduleImportWorker(queue=queue)
        skipped_courses = [
            {"subject": "MATH", "course_number": "241", "crn": "23456", "error": "UIUC course not found"}
        ]

        with patch("app.jobs.schedule_imports.download_private_file", return_value=SAMPLE_ICS), patch(
            "app.jobs.schedule_imports.extract_schedule_identifiers_from_ics",
            return_value=(
                [{"Subject": "MATH", "Subject Number": "241", "CRN": "23456"}],
                {"year": 2026, "term": "fall"},
            ),
        ), patch(
            "app.jobs.schedule_imports.resolve_courses_from_uiuc_partial",
            return_value=([], skipped_courses),
        ), patch("app.jobs.schedule_imports.add_courses_by_ics") as add_courses:
            with self.assertRaises(ValueError) as exc:
                worker._process_ics_job({"job_id": "job-2", "user_id": "user-1", "object_path": "path.ics"})

        add_courses.assert_not_called()
        self.assertIn("No valid courses could be resolved", str(exc.exception))

    def test_ics_parser_extracts_courses_and_term(self):
        course_identifiers, schedule_info = extract_schedule_identifiers_from_ics(SAMPLE_ICS)

        self.assertEqual(schedule_info, {"year": 2026, "term": "spring"})
        self.assertIn({"Subject": "CS", "Subject Number": "411", "CRN": "31352"}, course_identifiers)

    def test_uiuc_server_error_is_classified_as_transient(self):
        response = Mock(status_code=500)
        with patch("app.routes.schedules.schedules_service.requests.get", return_value=response):
            with self.assertRaisesRegex(TransientCourseApiError, "status 500"):
                _fetch_uiuc_course(
                    2026,
                    "fall",
                    {"Subject": "ANTH", "Subject Number": "102", "CRN": "12123"},
                )


class BackendAuthValidationTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.private_key = ec.generate_private_key(ec.SECP256R1())
        cls.public_key = cls.private_key.public_key()

    def setUp(self):
        self.config_patcher = patch.multiple(
            Config,
            SUPABASE_JWT_ISSUER="http://127.0.0.1:54321/auth/v1",
            SUPABASE_JWT_AUDIENCE="authenticated",
        )
        self.config_patcher.start()

    def tearDown(self):
        self.config_patcher.stop()

    def _encode_token(self, issuer=None, audience=None):
        payload = {
            "sub": "user-1",
            "iss": issuer or Config.SUPABASE_JWT_ISSUER,
            "aud": audience or Config.SUPABASE_JWT_AUDIENCE,
            "exp": 4102444800,
            "iat": 1704067200,
        }
        return jwt.encode(payload, self.private_key, algorithm="ES256")

    def test_verify_supabase_jwt_rejects_wrong_issuer(self):
        token = self._encode_token(issuer="http://malicious.example/auth/v1")

        with patch("app.utils.auth._get_jwks_client", return_value=_DummyJwksClient(self.public_key)):
            with self.assertRaises(InvalidTokenError):
                verify_supabase_jwt(token)

    def test_verify_supabase_jwt_rejects_wrong_audience(self):
        token = self._encode_token(audience="unexpected-audience")

        with patch("app.utils.auth._get_jwks_client", return_value=_DummyJwksClient(self.public_key)):
            with self.assertRaises(InvalidTokenError):
                verify_supabase_jwt(token)

    def test_verify_supabase_jwt_accepts_local_hs256_token(self):
        token = jwt.encode(
            {
                "sub": "user-1",
                "iss": Config.SUPABASE_JWT_ISSUER,
                "aud": Config.SUPABASE_JWT_AUDIENCE,
                "exp": 4102444800,
                "iat": 1704067200,
            },
            "local-jwt-secret",
            algorithm="HS256",
        )

        with patch.object(Config, "SUPABASE_JWT_SECRET", "local-jwt-secret"):
            self.assertEqual(verify_supabase_jwt(token)["sub"], "user-1")


class BackendConfigValidationTestCase(unittest.TestCase):
    def test_create_app_fails_fast_when_frontend_origin_missing(self):
        with patch.multiple(
            Config,
            FRONTEND_ORIGIN=None,
            SUPABASE_URL="http://127.0.0.1:54321",
            SUPABASE_SECRET_KEY="sb_secret_test",
            SUPABASE_JWT_ISSUER="http://127.0.0.1:54321/auth/v1",
            SUPABASE_JWT_AUDIENCE="authenticated",
            SUPABASE_HTTP_TIMEOUT_SECONDS=20.0,
            UIUC_API_TIMEOUT_SECONDS=5.0,
            MAX_IMAGE_UPLOAD_BYTES=16,
            MAX_ICS_UPLOAD_BYTES=32,
            MAX_MANUAL_COURSES_PER_REQUEST=2,
            DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres",
            DB_SSLMODE="disable",
            LOG_OPTIONS_REQUESTS=False,
            SUPABASE_SCHEDULE_ICS_BUCKET="schedule-ics",
            SUPABASE_SCHEDULE_ICS_PREFIX="schedule-imports",
            JOB_LEASE_SECONDS=60,
            JOB_HEARTBEAT_SECONDS=20,
            JOB_MAX_ATTEMPTS=3,
            JOB_RETRY_BASE_DELAY_SECONDS=5,
            JOB_RESULT_TTL_SECONDS=86400,
            JOB_POLL_INTERVAL_SECONDS=0.01,
            JWKS_URL="http://127.0.0.1:54321/auth/v1/.well-known/jwks.json",
        ):
            with self.assertRaises(RuntimeError):
                create_app()


@unittest.skipUnless(os.getenv("TEST_DATABASE_URL"), "requires TEST_DATABASE_URL")
class PostgresQueueIntegrationTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg2

        cls.database_url = os.environ["TEST_DATABASE_URL"]
        connection = psycopg2.connect(cls.database_url)
        try:
            with connection.cursor() as cur:
                cur.execute("CREATE TABLE IF NOT EXISTS public.users (id uuid PRIMARY KEY)")
                migration_path = os.path.join(
                    os.path.dirname(__file__), "..", "..", "supabase", "migrations",
                    "20260929120000_add_postgres_jobs.sql",
                )
                with open(migration_path, encoding="utf-8") as migration_file:
                    cur.execute(migration_file.read())
            connection.commit()
        finally:
            connection.close()
        db_utils.extensions.db_pool = pool.ThreadedConnectionPool(1, 4, dsn=cls.database_url)

    @classmethod
    def tearDownClass(cls):
        if db_utils.extensions.db_pool:
            db_utils.extensions.db_pool.closeall()
            db_utils.extensions.db_pool = None

    def setUp(self):
        with db_utils.get_cursor() as cur:
            cur.execute("DELETE FROM schedule_import_jobs")
            cur.execute("DELETE FROM public.users")

    def _create_user(self, user_id):
        with db_utils.get_cursor() as cur:
            cur.execute("INSERT INTO public.users (id) VALUES (%s)", (user_id,))

    def _enqueue(self, queue, user_id, year, job_type=JOB_TYPE_CRN):
        from uuid import uuid4

        job_id = str(uuid4())
        return queue.enqueue_job(job_id, {
            "job_type": job_type,
            "user_id": user_id,
            "year": year,
            "term": "fall" if year is not None else None,
            "max_attempts": 3,
            "payload_json": '{"courses":[]}',
            "object_path": "schedule.ics" if job_type == JOB_TYPE_ICS else None,
        })

    def test_workers_claim_distinct_jobs_and_stale_completion_cannot_persist(self):
        from uuid import uuid4

        queue = PostgresJobQueue()
        user_id = str(uuid4())
        self._create_user(user_id)
        self._enqueue(queue, user_id, 2026)
        self._enqueue(queue, user_id, 2027)

        first = queue.claim_next_job("worker-a")
        second = queue.claim_next_job("worker-b")
        self.assertNotEqual(first["job_id"], second["job_id"])

        lease = queue.build_lease(first)
        with db_utils.get_cursor() as cur:
            cur.execute("UPDATE schedule_import_jobs SET status = 'canceled' WHERE id = %s", (first["job_id"],))
        persisted = []
        status = queue.complete_with_schedule(lease, {"saved_count": 1}, lambda _cur: persisted.append(True))
        self.assertEqual(status, "superseded")
        self.assertEqual(persisted, [])

    def test_ics_enqueue_supersedes_active_job_and_expired_lease_retries(self):
        from uuid import uuid4

        queue = PostgresJobQueue()
        user_id = str(uuid4())
        self._create_user(user_id)
        first = self._enqueue(queue, user_id, None, JOB_TYPE_ICS)
        second = self._enqueue(queue, user_id, None, JOB_TYPE_ICS)
        canceled = queue.get_job(first["job_id"])
        self.assertEqual(canceled["status"], "canceled")
        self.assertEqual(canceled["superseded_by"], second["job_id"])

        claimed = queue.claim_next_job("worker-a")
        with db_utils.get_cursor() as cur:
            cur.execute(
                "UPDATE schedule_import_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = %s",
                (claimed["job_id"],),
            )
        self.assertEqual(queue.reclaim_expired_jobs(), [claimed["job_id"]])
        retried = queue.get_job(claimed["job_id"])
        self.assertEqual(retried["status"], "queued")
        self.assertEqual(retried["attempts"], 1)

    def test_crn_enqueues_for_the_same_term_do_not_supersede_each_other(self):
        from uuid import uuid4

        queue = PostgresJobQueue()
        user_id = str(uuid4())
        self._create_user(user_id)
        first = self._enqueue(queue, user_id, 2026)
        second = self._enqueue(queue, user_id, 2026)

        self.assertEqual(queue.get_job(first["job_id"])["status"], "queued")
        self.assertEqual(queue.get_job(second["job_id"])["status"], "queued")

    def test_schedule_write_and_completion_roll_back_together(self):
        from uuid import uuid4

        queue = PostgresJobQueue()
        user_id = str(uuid4())
        self._create_user(user_id)
        job = self._enqueue(queue, user_id, 2026)
        claimed = queue.claim_next_job("worker-a")

        def failing_persist(_cur):
            raise RuntimeError("database write failed")

        with self.assertRaisesRegex(RuntimeError, "database write failed"):
            queue.complete_with_schedule(queue.build_lease(claimed), {"saved_count": 1}, failing_persist)
        current = queue.get_job(job["job_id"])
        self.assertEqual(current["status"], "processing")
        self.assertIsNone(current["result"])

    def test_non_retryable_failure_is_failed_on_first_attempt(self):
        from uuid import uuid4

        queue = PostgresJobQueue()
        user_id = str(uuid4())
        self._create_user(user_id)
        job = self._enqueue(queue, user_id, 2026)
        claimed = queue.claim_next_job("worker-a")

        status = queue.fail_or_retry_job(
            queue.build_lease(claimed),
            "Invalid class",
            retryable=False,
        )

        self.assertEqual(status, "failed")
        current = queue.get_job(job["job_id"])
        self.assertEqual(current["status"], "failed")
        self.assertEqual(current["attempts"], 1)
        self.assertEqual(current["last_error"], "Invalid class")

    def test_terminal_jobs_are_removed_after_the_retention_period(self):
        from uuid import uuid4

        queue = PostgresJobQueue()
        user_id = str(uuid4())
        self._create_user(user_id)
        job = self._enqueue(queue, user_id, 2026)
        with db_utils.get_cursor() as cur:
            cur.execute(
                """
                UPDATE schedule_import_jobs
                SET status = 'completed', cleanup_after = now() - interval '1 second'
                WHERE id = %s
                """,
                (job["job_id"],),
            )
        self.assertEqual([item["job_id"] for item in queue.get_terminal_cleanup_candidates()], [job["job_id"]])
        self.assertTrue(queue.delete_terminal_job(job["job_id"]))
        self.assertIsNone(queue.get_job(job["job_id"]))


if __name__ == "__main__":
    unittest.main()
