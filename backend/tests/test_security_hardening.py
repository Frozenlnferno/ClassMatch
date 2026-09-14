import io
import unittest
from contextlib import contextmanager
from unittest.mock import Mock, patch

import jwt
from psycopg2 import DatabaseError, OperationalError
from jwt.exceptions import InvalidTokenError
from cryptography.hazmat.primitives.asymmetric import ec

from app import create_app
from app.config import Config
from app.jobs.schedule_imports import ScheduleImportWorker
from app.routes.groups import groups_service
from app.routes.users import users_service
from app.routes.schedules.schedules_service import extract_schedule_identifiers_from_ics
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
            REDIS_URL="redis://localhost:6379/0",
            REDIS_JOB_LEASE_SECONDS=60,
            REDIS_JOB_HEARTBEAT_SECONDS=20,
            REDIS_JOB_MAX_ATTEMPTS=3,
            REDIS_JOB_RETRY_BASE_DELAY_SECONDS=5,
            REDIS_JOB_RESULT_TTL_SECONDS=86400,
            REDIS_JOB_POLL_INTERVAL_SECONDS=0.01,
            JWKS_URL="http://127.0.0.1:54321/auth/v1/.well-known/jwks.json",
        )
        self.config_patcher.start()
        self.init_db_pool_patcher = patch("app.init_db_pool", return_value=None)
        self.init_redis_patcher = patch("app.init_redis", return_value=None)
        self.init_db_pool_patcher.start()
        self.init_redis_patcher.start()
        self.app = create_app()
        self.app.testing = True
        self.client = self.app.test_client()

    def tearDown(self):
        self.init_redis_patcher.stop()
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
            result = worker._process_ics_job({"job_id": "job-1", "user_id": "user-1", "object_path": "path.ics"})

        add_courses.assert_called_once_with("user-1", 2026, "fall", resolved_courses)
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
            result = worker._process_crn_job(
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

        add_courses.assert_called_once_with("user-1", 2026, "fall", resolved_courses)
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
            REDIS_URL="redis://localhost:6379/0",
            REDIS_JOB_LEASE_SECONDS=60,
            REDIS_JOB_HEARTBEAT_SECONDS=20,
            REDIS_JOB_MAX_ATTEMPTS=3,
            REDIS_JOB_RETRY_BASE_DELAY_SECONDS=5,
            REDIS_JOB_RESULT_TTL_SECONDS=86400,
            REDIS_JOB_POLL_INTERVAL_SECONDS=0.01,
            JWKS_URL="http://127.0.0.1:54321/auth/v1/.well-known/jwks.json",
        ):
            with self.assertRaises(RuntimeError):
                create_app()


if __name__ == "__main__":
    unittest.main()
