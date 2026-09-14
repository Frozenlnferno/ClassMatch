import math

from flask import request, jsonify, g, Blueprint
from app.config import Config
from app.jobs import create_crn_import_job, create_ics_import_job, get_job_status_for_user
from app.utils.auth import require_auth
from app.utils.logger import get_logger
from .schedules_service import (
    get_user_schedule,
    get_matching_classmates,
    get_past_classmates,
    remove_schedule,
    remove_courses_from_schedule,
    get_all_schedules,
)
from app.utils.validators import validate_year_term

bp = Blueprint("schedules", __name__)
logger = get_logger(__name__)
def _format_size_limit(max_bytes):
    if max_bytes < 1024 * 1024:
        return f"{max_bytes} bytes"
    return f"{math.ceil(max_bytes / (1024 * 1024))} MB"

@bp.route("/", methods=["GET"])
@require_auth
def get_schedule_route():
    user_id = g.user["sub"]
    year, term, error_response, error_code = validate_year_term()
    
    if error_response:
        return error_response, error_code
    
    try:
        courses = get_user_schedule(user_id, year, term)
        return jsonify(courses)
    except Exception as e:
        logger.exception("Error getting user schedule", extra={"error": str(e)})
        return jsonify({"error": "Failed to retrieve schedule"}), 500

@bp.route("/list", methods=["GET"])
@require_auth
def get_all_schedules_route():
    user_id = g.user["sub"]
    try:
        courses = get_all_schedules(user_id)
        return jsonify(courses)
    except Exception as e:
        logger.exception("Error getting all user schedules", extra={"error": str(e)})
        return jsonify({"error": "Failed to retrieve all user schedules"}), 500

@bp.route("/", methods=["POST"])
@require_auth
def create_schedule():
    user_id = g.user["sub"]
    ics = request.files.get("ics")

    if not ics:
        return jsonify({"error": "No ICS file uploaded"}), 400

    if not ics.filename or not ics.filename.lower().endswith(".ics"):
        return jsonify({"error": "File must be an ICS calendar file"}), 400

    ics.stream.seek(0)
    max_ics_size_bytes = Config.MAX_ICS_UPLOAD_BYTES
    ics_bytes = ics.read(max_ics_size_bytes + 1)
    if not ics_bytes:
        return jsonify({"error": "ICS file appears to be empty"}), 400
    if len(ics_bytes) > max_ics_size_bytes:
        return jsonify({"error": f"ICS file must be smaller than {_format_size_limit(max_ics_size_bytes)}"}), 400

    try:
        job = create_ics_import_job(
            user_id=user_id,
            ics_bytes=ics_bytes,
            filename=ics.filename,
            content_type=(ics.content_type or "text/calendar").split(";", 1)[0].strip() or "text/calendar",
        )
        return jsonify(job), 202
    except ValueError as e:
        logger.warning("Schedule upload validation error", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("Unexpected error uploading schedule", extra={"error": str(e)})
        return jsonify({"error": "Failed to upload schedule. Please try again."}), 500

@bp.route("/courses", methods=["POST"])
@require_auth
def add_schedule_courses():
    user_id = g.user["sub"]
    data = request.get_json(silent=True) or {}
    year, term, error_response, error_code = validate_year_term()

    if error_response:
        return error_response, error_code

    raw_courses = data.get("courses", [])
    if not isinstance(raw_courses, list):
        return jsonify({"error": "Invalid courses payload"}), 400
    if len(raw_courses) > Config.MAX_MANUAL_COURSES_PER_REQUEST:
        return jsonify({"error": f"You can add at most {Config.MAX_MANUAL_COURSES_PER_REQUEST} courses at a time"}), 400

    normalized_identifiers = []
    seen = set()
    for raw_course in raw_courses:
        if not isinstance(raw_course, dict):
            return jsonify({"error": "Invalid courses payload"}), 400

        raw_subject = raw_course.get("subject") or raw_course.get("course_subject")
        raw_number = raw_course.get("course") or raw_course.get("course_number") or raw_course.get("number")
        raw_crn = raw_course.get("crn")

        if not isinstance(raw_subject, str) or not isinstance(raw_number, (str, int)) or not isinstance(raw_crn, (str, int)):
            return jsonify({"error": "Each course must include subject, course, and crn"}), 400

        subject = raw_subject.strip().upper()
        course_number = str(raw_number).strip()
        crn = str(raw_crn).strip()

        if not subject or not course_number or len(crn) != 5 or not crn.isdigit():
            return jsonify({"error": "Each course must include valid subject, course, and 5-digit crn"}), 400

        identifier = {
            "Subject": subject,
            "Subject Number": course_number,
            "CRN": crn,
        }
        dedupe_key = (subject, course_number, crn)
        if dedupe_key not in seen:
            seen.add(dedupe_key)
            normalized_identifiers.append(identifier)

    if not normalized_identifiers:
        return jsonify({"error": "No courses were provided"}), 400

    try:
        job = create_crn_import_job(user_id, year, term, normalized_identifiers)
        return jsonify(job), 202
    except ValueError as e:
        logger.warning("Course add validation error", extra={"error": str(e)})
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.exception("Error adding courses", extra={"error": str(e)})
        return jsonify({"error": "Failed to add courses"}), 500


@bp.route("/jobs/<job_id>", methods=["GET"])
@require_auth
def get_schedule_job(job_id):
    user_id = g.user["sub"]
    job = get_job_status_for_user(job_id, user_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)

@bp.route("/", methods=["DELETE"])
@require_auth
def delete_schedule():
    user_id = g.user["sub"]
    year, term, error_response, error_code = validate_year_term()
    
    if error_response:
        return error_response, error_code

    try:
        remove_schedule(user_id, year, term)
        return jsonify({"message": "Schedule deleted successfully"})
    except Exception as e:
        logger.exception("Error deleting schedule", extra={"error": str(e)})
        return jsonify({"error": "Failed to delete schedule"}), 500

@bp.route("/courses", methods=["DELETE"])
@require_auth
def delete_schedule_courses():
    user_id = g.user["sub"]
    data = request.get_json(silent=True) or {}
    crns = data["crns"] if "crns" in data else []
    year, term, error_response, error_code = validate_year_term()
    
    if error_response:
        return error_response, error_code

    if not isinstance(crns, list) or not all(isinstance(crn, str) for crn in crns):
        return jsonify({"error": "Invalid crns"}), 400

    try:
        remove_courses_from_schedule(user_id, year, term, crns)
        return jsonify({"message": "Courses removed successfully"})
    except Exception as e:
        logger.exception("Error removing courses", extra={"error": str(e)})
        return jsonify({"error": "Failed to remove courses"}), 500

@bp.route("/matching-classmates", methods=["GET"])
@require_auth
def get_matching_classmates_route():
    user_id = g.user["sub"]
    group_id = request.args.get("group_id")
    
    year, term, error_response, error_code = validate_year_term()
    if error_response:
        return error_response, error_code
    
    if not group_id:
        return jsonify({"error": "Invalid group_id"}), 400
    
    try:
        matches = get_matching_classmates(user_id, year, term, group_id)
        return jsonify(matches)
    except PermissionError:
        logger.warning("Matching classmates lookup denied", extra={"group_id": group_id, "error": "Group not found"})
        return jsonify({"error": "Group not found"}), 404
    except Exception as e:
        logger.exception("Error getting matching classmates", extra={"error": str(e)})
        return jsonify({"error": "Internal server error"}), 500


@bp.route("/past-classmates", methods=["GET"])
@require_auth
def get_past_classmates_route():
    user_id = g.user["sub"]
    group_id = request.args.get("group_id")

    year, term, error_response, error_code = validate_year_term()
    if error_response:
        return error_response, error_code

    if not group_id:
        return jsonify({"error": "Invalid group_id"}), 400

    try:
        matches = get_past_classmates(user_id, year, term, group_id)
        return jsonify(matches)
    except PermissionError as e:
        logger.warning("Past classmates lookup denied", extra={"error": str(e), "group_id": group_id})
        return jsonify({"error": "Group not found"}), 404
    except Exception as e:
        logger.exception("Error getting past classmates", extra={"error": str(e)})
        return jsonify({"error": "Internal server error"}), 500
