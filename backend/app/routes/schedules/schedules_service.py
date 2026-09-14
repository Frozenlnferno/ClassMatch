import xml.etree.ElementTree as ET
from datetime import datetime, time as dt_time
import html
import re

import requests

from app.routes.groups.groups_service import GROUP_NOT_FOUND_ERROR
from app.config import Config
from app.utils.db import get_cursor
from app.utils.logger import get_logger

UIUC_EXPLORER_URL = "https://courses.illinois.edu/cisapp/explorer/schedule/{year}/{term}/{subject}/{course}/{crn}.xml"
logger = get_logger(__name__)
COURSE_SUMMARY_RE = re.compile(r"\b([A-Z]{2,5})\s+([0-9]{3}[A-Z]?)\s+([A-Z0-9]+)\s*$")
CRN_RE = re.compile(r"\bCRN:\s*([0-9]{5})\b", re.IGNORECASE)


def _normalize_text(value):
    return " ".join(value.split()) if value else ""


def _local_name(tag_name):
    return tag_name.split("}", 1)[-1]


def _iter_named_elements(root, names):
    for element in root.iter():
        if _local_name(element.tag) in names:
            yield element


def _find_first_text(root, names):
    for element in _iter_named_elements(root, names):
        text = _normalize_text("".join(element.itertext()))
        if text:
            return text
    return ""


def _find_first_attribute(root, element_names, attribute_names):
    for element in _iter_named_elements(root, element_names):
        for attribute_name in attribute_names:
            value = _normalize_text(element.attrib.get(attribute_name, ""))
            if value:
                return value
    return ""


def _find_all_text(root, names):
    values = []
    for element in _iter_named_elements(root, names):
        text = _normalize_text("".join(element.itertext()))
        if text:
            values.append(text)
    return values


def _find_first_text_or_attribute(root, element_names, attribute_names):
    text = _find_first_text(root, element_names)
    if text:
        return text
    return _find_first_attribute(root, element_names, attribute_names)


def _iter_meeting_elements(root):
    meeting_names = {
        "meeting",
        "sectionMeeting",
        "detailedMeeting",
        "detailedSectionMeeting",
        "meetingInformation",
        "meetingInfo",
        "meetingTime",
        "time",
    }
    for element in root.iter():
        if _local_name(element.tag) in meeting_names:
            yield element


def _parse_time_value(raw_value):
    normalized = _normalize_text(raw_value)
    if not normalized:
        return None

    if normalized.upper() in {"ARRANGED", "TBA", "N/A"}:
        return None

    for time_format in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p"):
        try:
            return datetime.strptime(normalized, time_format).time()
        except ValueError:
            continue

    return None


def _serialize_time_value(value):
    if isinstance(value, dt_time):
        return value.isoformat()
    return value


def serialize_courses_for_response(courses):
    serialized_courses = []
    for course in courses:
        serialized_course = dict(course)

        if "Start Time" in serialized_course:
            serialized_course["Start Time"] = _serialize_time_value(serialized_course["Start Time"])
        if "End Time" in serialized_course:
            serialized_course["End Time"] = _serialize_time_value(serialized_course["End Time"])
        if "start_time" in serialized_course:
            serialized_course["start_time"] = _serialize_time_value(serialized_course["start_time"])
        if "end_time" in serialized_course:
            serialized_course["end_time"] = _serialize_time_value(serialized_course["end_time"])

        serialized_courses.append(serialized_course)

    return serialized_courses


def _extract_time_from_element(root, tag_names, attribute_names):
    raw_value = _find_first_text_or_attribute(root, tag_names, attribute_names)
    return _parse_time_value(raw_value)


def _extract_days_from_element(root):
    raw_value = _find_first_text_or_attribute(
        root,
        {"daysOfTheWeek", "daysOfWeek", "days"},
        {"daysOfTheWeek", "daysOfWeek", "days"},
    )
    normalized = _normalize_text(raw_value)
    if not normalized or normalized.upper() in {"ARRANGED", "TBA", "N/A"}:
        return None
    return normalized.upper()


def _extract_meeting_details(root):
    for meeting_element in _iter_meeting_elements(root):
        start_time = _extract_time_from_element(
            meeting_element,
            {"startTime", "start"},
            {"startTime", "start"},
        )
        end_time = _extract_time_from_element(
            meeting_element,
            {"endTime", "end"},
            {"endTime", "end"},
        )
        days_of_week = _extract_days_from_element(meeting_element)

        if start_time or end_time or days_of_week:
            return start_time, end_time, days_of_week

    return (
        _extract_time_from_element(root, {"startTime", "start"}, {"startTime", "start"}),
        _extract_time_from_element(root, {"endTime", "end"}, {"endTime", "end"}),
        _extract_days_from_element(root),
    )


def _extract_subject_code(root):
    subject_code = _find_first_text(root, {"subjectCode", "subject"})
    if subject_code.isupper() and 2 <= len(subject_code) <= 5:
        return subject_code

    subject_code = _find_first_attribute(root, {"subject"}, {"id", "code"})
    return subject_code.upper()


def _extract_course_number(root):
    course_number = _find_first_text(root, {"courseNumber", "number"})
    if course_number:
        return course_number

    return _find_first_attribute(root, {"course"}, {"id", "number"})


def _extract_course_title(root):
    title = _find_first_text(root, {"courseTitle", "title", "label"})
    if title:
        return title

    for element in _iter_named_elements(root, {"course"}):
        title = _normalize_text("".join(element.itertext()))
        if title:
            return title

        title = _normalize_text(element.attrib.get("label", ""))
        if title:
            return title

    return ""


def _extract_section(root):
    section = _find_first_text(root, {"sectionNumber", "sectionId"})
    if section:
        return section

    section = _find_first_attribute(root, {"section", "detailedSection"}, {"id", "sectionNumber"})
    if section:
        return section

    return ""


def _extract_crn(root):
    crn = _find_first_text(root, {"referenceNumber", "crn"})
    if crn:
        return crn

    return _find_first_attribute(root, {"section", "detailedSection"}, {"id"})


def _extract_course_type(root):
    return _find_first_text(root, {"sectionType", "type", "typeCode"})


def _extract_instructors(root):
    instructors = _find_all_text(root, {"instructor", "name"})
    unique_instructors = []
    for instructor in instructors:
        if instructor not in unique_instructors:
            unique_instructors.append(instructor)
    return ", ".join(unique_instructors)


def _extract_building(root):
    return _find_first_text(root, {"buildingName", "building"})


def _extract_room_number(root):
    return _find_first_text(root, {"roomNumber", "room"})


def _decode_ics_text(ics_bytes):
    try:
        return ics_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            return ics_bytes.decode("latin-1")
        except UnicodeDecodeError as exc:
            raise ValueError("Failed to read ICS file. Please ensure the file is a valid calendar export.") from exc


def _unfold_ics_lines(text):
    unfolded_lines = []
    for raw_line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw_line.startswith((" ", "\t")) and unfolded_lines:
            unfolded_lines[-1] += raw_line[1:]
        else:
            unfolded_lines.append(raw_line)
    return unfolded_lines


def _split_ics_name_value(line):
    if ":" not in line:
        return "", ""
    name_part, value = line.split(":", 1)
    name = name_part.split(";", 1)[0].upper()
    return name, value


def _unescape_ics_value(value):
    unescaped = (
        value.replace("\\n", "\n")
        .replace("\\N", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
    )
    return html.unescape(unescaped)


def _parse_ics_datetime(value):
    normalized = value.strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = normalized[:-1]
    for date_format in ("%Y%m%dT%H%M%S", "%Y%m%dT%H%M", "%Y%m%d"):
        try:
            return datetime.strptime(normalized, date_format)
        except ValueError:
            continue
    return None


def _term_from_month(month):
    if 1 <= month <= 5:
        return "spring"
    if 6 <= month <= 7:
        return "summer"
    return "fall"


def _extract_ics_events(lines):
    events = []
    current_event = None
    for line in lines:
        upper_line = line.strip().upper()
        if upper_line == "BEGIN:VEVENT":
            current_event = {}
            continue
        if upper_line == "END:VEVENT":
            if current_event is not None:
                events.append(current_event)
            current_event = None
            continue
        if current_event is None:
            continue

        name, value = _split_ics_name_value(line)
        if name in {"SUMMARY", "DESCRIPTION", "DTSTART"} and name not in current_event:
            current_event[name] = _unescape_ics_value(value)
    return events


def extract_schedule_identifiers_from_ics(ics_bytes):
    text = _decode_ics_text(ics_bytes)
    if not text.strip():
        raise ValueError("ICS file appears to be empty.")
    if "BEGIN:VCALENDAR" not in text.upper() or "BEGIN:VEVENT" not in text.upper():
        raise ValueError("ICS file does not contain calendar events.")

    events = _extract_ics_events(_unfold_ics_lines(text))
    if not events:
        raise ValueError("ICS file does not contain calendar events.")

    course_identifiers = []
    class_dates = []
    seen = set()
    for event in events:
        summary = _normalize_text(event.get("SUMMARY", ""))
        description = event.get("DESCRIPTION", "")
        start_date = _parse_ics_datetime(event.get("DTSTART", ""))
        if start_date:
            class_dates.append(start_date)

        course_match = COURSE_SUMMARY_RE.search(summary)
        crn_match = CRN_RE.search(description)
        if not course_match or not crn_match:
            continue

        subject, course_number, _section = course_match.groups()
        crn = crn_match.group(1)
        dedupe_key = (subject, course_number, crn)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        course_identifiers.append({
            "Subject": subject,
            "Subject Number": course_number,
            "CRN": crn,
        })

    if not course_identifiers:
        raise ValueError("No recognizable courses were found in the ICS file.")
    if not class_dates:
        raise ValueError("No class dates were found in the ICS file.")

    first_class_date = min(class_dates)
    return course_identifiers, {
        "year": first_class_date.year,
        "term": _term_from_month(first_class_date.month),
    }


def _fetch_uiuc_course(year, term, identifier):
    subject = identifier["Subject"]
    course_number = identifier["Subject Number"]
    crn = identifier["CRN"]
    url = UIUC_EXPLORER_URL.format(
        year=year,
        term=term,
        subject=subject,
        course=course_number,
        crn=crn,
    )

    try:
        response = requests.get(url, timeout=Config.UIUC_API_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise ValueError(
            f"Failed to reach the UIUC course API for {subject} {course_number} CRN {crn}: {exc}"
        ) from exc

    if response.status_code == 404:
        raise ValueError(
            f"UIUC course not found for {subject} {course_number} CRN {crn} in {term} {year}."
        )

    if response.status_code != 200:
        raise ValueError(
            f"UIUC course API request failed for {subject} {course_number} CRN {crn} with status {response.status_code}."
        )

    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as exc:
        raise ValueError(
            f"UIUC course API returned malformed XML for {subject} {course_number} CRN {crn}."
        ) from exc

    title = _extract_course_title(root)
    section = _extract_section(root)
    api_subject = _extract_subject_code(root) or subject
    api_course_number = _extract_course_number(root) or course_number
    api_crn = _extract_crn(root) or crn
    start_time, end_time, days_of_week = _extract_meeting_details(root)

    if not title:
        raise ValueError(
            f"UIUC course API response was missing the course title for {subject} {course_number} CRN {crn}."
        )

    if not section:
        raise ValueError(
            f"UIUC course API response was missing the section for {subject} {course_number} CRN {crn}."
        )

    if api_subject.upper() != subject.upper() or api_course_number != course_number or api_crn != crn:
        raise ValueError(
            f"UIUC course API returned mismatched data for {subject} {course_number} CRN {crn}."
        )

    return {
        "Title": title,
        "Subject": api_subject.upper(),
        "Subject Number": api_course_number,
        "Section": section,
        "CRN": api_crn,
        "Course Type": _extract_course_type(root) or None,
        "Instructor": _extract_instructors(root) or None,
        "Building": _extract_building(root) or None,
        "Room Number": _extract_room_number(root) or None,
        "Start Time": start_time,
        "End Time": end_time,
        "Days of Week": days_of_week,
    }


def _serialize_skipped_course(identifier, error):
    return {
        "subject": identifier.get("Subject", ""),
        "course_number": identifier.get("Subject Number", ""),
        "crn": str(identifier.get("CRN", "")),
        "error": str(error),
    }


def summarize_skipped_courses(skipped_courses, prefix="No valid courses could be resolved."):
    if not skipped_courses:
        return prefix

    preview = [
        f'{item["subject"]} {item["course_number"]} CRN {item["crn"]}: {item["error"]}'
        for item in skipped_courses[:3]
    ]
    suffix = f" ({len(skipped_courses) - 3} more skipped)" if len(skipped_courses) > 3 else ""
    return f"{prefix} {'; '.join(preview)}{suffix}"


def resolve_courses_from_uiuc(year, term, course_identifiers):
    return [_fetch_uiuc_course(year, term, identifier) for identifier in course_identifiers]


def resolve_courses_from_uiuc_partial(year, term, course_identifiers):
    courses = []
    skipped_courses = []

    for identifier in course_identifiers:
        try:
            courses.append(_fetch_uiuc_course(year, term, identifier))
        except ValueError as exc:
            skipped_courses.append(_serialize_skipped_course(identifier, exc))

    return courses, skipped_courses


def _persist_schedule_courses(uid, year, term, courses, replace_existing):
    if not courses:
        raise ValueError("No valid courses were provided.")

    with get_cursor() as cur:
        cur.execute(
            """
                INSERT INTO schedules (user_id, year, term)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, term, year) DO UPDATE SET year=EXCLUDED.year
                RETURNING id
            """,
            (uid, year, term)
        )
        schedule_id = cur.fetchone()[0]

        if replace_existing:
            cur.execute(
                """
                    DELETE FROM schedule_sections
                    WHERE schedule_id = %s
                """,
                (schedule_id,)
            )

        for course in courses:
            cur.execute(
                """
                    INSERT INTO classes (subject, number, title)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (subject, number) DO UPDATE
                    SET title = EXCLUDED.title
                    RETURNING id
                """,
                (
                    course["Subject"],
                    course["Subject Number"],
                    course["Title"],
                )
            )
            class_id = cur.fetchone()[0]

            cur.execute(
                """
                    INSERT INTO sections (
                        class_id,
                        year,
                        term,
                        section,
                        crn,
                        course_type,
                        instructor,
                        building,
                        room_number,
                        start_time,
                        end_time,
                        days_of_week
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (year, term, crn) DO UPDATE
                    SET class_id = EXCLUDED.class_id,
                        section = EXCLUDED.section,
                        course_type = EXCLUDED.course_type,
                        instructor = EXCLUDED.instructor,
                        building = EXCLUDED.building,
                        room_number = EXCLUDED.room_number,
                        start_time = EXCLUDED.start_time,
                        end_time = EXCLUDED.end_time,
                        days_of_week = EXCLUDED.days_of_week
                    RETURNING id
                """,
                (
                    class_id,
                    year,
                    term,
                    course["Section"],
                    course["CRN"],
                    course["Course Type"],
                    course["Instructor"],
                    course["Building"],
                    course["Room Number"],
                    course["Start Time"],
                    course["End Time"],
                    course["Days of Week"],
                )
            )
            section_id = cur.fetchone()[0]

            cur.execute(
                """
                    INSERT INTO schedule_sections (schedule_id, section_id)
                    VALUES (%s, %s)
                    ON CONFLICT (schedule_id, section_id) DO NOTHING
                """,
                (schedule_id, section_id)
            )


def add_courses_by_ics(uid, year, term, courses):
    _persist_schedule_courses(uid, year, term, courses, replace_existing=True)


def add_courses_by_crn(uid, year, term, course_identifiers):
    if not course_identifiers:
        raise ValueError("No courses were provided.")

    courses = resolve_courses_from_uiuc(year, term, course_identifiers)
    _persist_schedule_courses(uid, year, term, courses, replace_existing=False)
    return courses

def add_resolved_courses_by_crn(uid, year, term, courses):
    _persist_schedule_courses(uid, year, term, courses, replace_existing=False)
    return courses


def remove_schedule(uid, year, term):
    with get_cursor() as cur:
        cur.execute(
            """
                DELETE FROM schedules
                WHERE user_id = %s
                    AND year = %s
                    AND term = %s
            """,
            (uid, year, term)
        )


def remove_courses_from_schedule(uid, year, term, crns):
    with get_cursor() as cur:
        cur.execute(
            """
                DELETE FROM schedule_sections ss
                USING schedules s
                WHERE ss.schedule_id = s.id
                    AND s.user_id = %s
                    AND s.year = %s
                    AND s.term = %s
                    AND ss.section_id IN (
                        SELECT id FROM sections WHERE year = %s AND term = %s AND crn = ANY(%s)
                    )
            """,
            (uid, year, term, year, term, crns)
        )


def get_user_schedule(uid, year, term):
    with get_cursor() as cur:
        cur.execute(
            """
                SELECT
                    c.id,
                    c.subject,
                    c.number,
                    c.title,
                    c.created_at,
                    sec.id AS section_id,
                    sec.year,
                    sec.term,
                    sec.section,
                    sec.crn,
                    sec.course_type,
                    sec.instructor,
                    sec.building,
                    sec.room_number,
                    sec.start_time,
                    sec.end_time,
                    sec.days_of_week,
                    sec.created_at AS section_created_at
                FROM schedules s
                JOIN schedule_sections ss ON ss.schedule_id = s.id
                JOIN sections sec ON sec.id = ss.section_id
                JOIN classes c ON c.id = sec.class_id
                WHERE s.user_id = %s
                    AND s.year = %s
                    AND s.term = %s
                ORDER BY c.subject, c.number, sec.section;
            """,
            (uid, year, term)
        )
        rows = cur.fetchall() or []

    return serialize_courses_for_response([
        {
            "id": row[0],
            "subject": row[1],
            "number": row[2],
            "title": row[3],
            "created_at": row[4],
            "section_id": row[5],
            "year": row[6],
            "term": row[7],
            "section": row[8],
            "crn": row[9],
            "course_type": row[10],
            "instructor": row[11],
            "building": row[12],
            "room_number": row[13],
            "start_time": row[14],
            "end_time": row[15],
            "days_of_week": row[16],
            "section_created_at": row[17],
        }
        for row in rows
    ])


def get_all_schedules(uid):
    with get_cursor() as cur:
        cur.execute(
            """
                SELECT
                    s.term,
                    s.year,
                    COUNT(ss.section_id) AS class_count
                FROM schedules s
                LEFT JOIN schedule_sections ss
                    ON ss.schedule_id = s.id
                WHERE s.user_id = %s
                GROUP BY s.id, s.year, s.term
                ORDER BY s.year DESC, s.term DESC;
            """,
            (uid,)
        )
        rows = cur.fetchall() or []

    return [
        {
            "term": row[0],
            "year": row[1],
            "class_count": row[2],
        }
        for row in rows
    ]


def get_matching_classmates(uid, year, term, group_id):
    with get_cursor() as cur:
        _assert_group_member(cur, uid, group_id)
        cur.execute(
            """
                WITH me AS (
                  SELECT s.id AS my_schedule_id
                  FROM schedules s
                  WHERE s.user_id = %s
                    AND s.year = %s
                    AND s.term = %s
                  LIMIT 1
                ),
                my_sections AS (
                  SELECT ss.section_id
                  FROM schedule_sections ss
                  JOIN me ON me.my_schedule_id = ss.schedule_id
                ),
                group_users AS (
                  SELECT gm.user_id
                  FROM group_members gm
                  WHERE gm.group_id = %s
                ),
                group_schedules AS (
                  SELECT s.id AS schedule_id, s.user_id
                  FROM schedules s
                  JOIN group_users gu ON gu.user_id = s.user_id
                  WHERE s.year = %s
                    AND s.term = %s
                )
                SELECT
                  ms.section_id,
                  u.id   AS member_id,
                  u.name AS member_name
                FROM my_sections ms
                JOIN schedule_sections ss
                  ON ss.section_id = ms.section_id
                JOIN group_schedules gs
                  ON gs.schedule_id = ss.schedule_id
                JOIN users u
                  ON u.id = gs.user_id
                WHERE u.id <> %s
                ORDER BY ms.section_id, u.name;
            """,
            (uid, year, term, group_id, year, term, uid)
        )
        rows = cur.fetchall() or []

    return [
        {
            "section_id": row[0],
            "member_id": row[1],
            "member_name": row[2],
        }
        for row in rows
    ]


def _assert_group_member(cur, uid, group_id):
    cur.execute(
        """
            SELECT 1
            FROM group_members
            WHERE group_id = %s AND user_id = %s
            LIMIT 1;
        """,
        (group_id, uid)
    )
    if not cur.fetchone():
        raise PermissionError(GROUP_NOT_FOUND_ERROR)


def get_past_classmates(uid, year, term, group_id):
    with get_cursor() as cur:
        _assert_group_member(cur, uid, group_id)

        cur.execute(
            """
                WITH requested_term AS (
                  SELECT
                    %s::integer AS target_year,
                    %s::text AS target_term,
                    CASE %s::text
                      WHEN 'spring' THEN 1
                      WHEN 'summer' THEN 2
                      WHEN 'fall' THEN 3
                    END AS target_term_order
                ),
                my_schedule AS (
                  SELECT s.id
                  FROM schedules s
                  WHERE s.user_id = %s
                    AND s.year = %s
                    AND s.term = %s
                  LIMIT 1
                ),
                current_classes AS (
                  SELECT
                    MIN(sec.id) AS section_id,
                    c.id AS class_id,
                    c.subject,
                    c.number,
                    c.title
                  FROM my_schedule ms
                  JOIN schedule_sections ss ON ss.schedule_id = ms.id
                  JOIN sections sec ON sec.id = ss.section_id
                  JOIN classes c ON c.id = sec.class_id
                  GROUP BY c.id, c.subject, c.number, c.title
                ),
                ranked_matches AS (
                  SELECT
                    cc.section_id,
                    cc.class_id,
                    cc.subject,
                    cc.number,
                    cc.title,
                    u.id AS member_id,
                    u.name AS member_name,
                    u.avatar_url AS member_avatar_url,
                    sec.year AS past_year,
                    sec.term AS past_term,
                    sec.id AS past_section_id,
                    sec.section AS past_section,
                    sec.crn AS past_crn,
                    ROW_NUMBER() OVER (
                      PARTITION BY cc.class_id, u.id
                      ORDER BY
                        sec.year DESC,
                        CASE sec.term
                          WHEN 'fall' THEN 3
                          WHEN 'summer' THEN 2
                          WHEN 'spring' THEN 1
                        END DESC,
                        sec.id DESC
                    ) AS match_rank
                  FROM current_classes cc
                  JOIN group_members gm
                    ON gm.group_id = %s
                  JOIN users u
                    ON u.id = gm.user_id
                  JOIN schedules s
                    ON s.user_id = u.id
                  JOIN schedule_sections ss
                    ON ss.schedule_id = s.id
                  JOIN sections sec
                    ON sec.id = ss.section_id
                  JOIN requested_term rt
                    ON 1 = 1
                  WHERE u.id <> %s
                    AND sec.class_id = cc.class_id
                    AND (
                      s.year < rt.target_year
                      OR (
                        s.year = rt.target_year
                        AND CASE s.term
                          WHEN 'spring' THEN 1
                          WHEN 'summer' THEN 2
                          WHEN 'fall' THEN 3
                        END < rt.target_term_order
                      )
                    )
                )
                SELECT
                  section_id,
                  class_id,
                  subject,
                  number,
                  title,
                  member_id,
                  member_name,
                  member_avatar_url,
                  past_year,
                  past_term,
                  past_section_id,
                  past_section,
                  past_crn
                FROM ranked_matches
                WHERE match_rank = 1
                ORDER BY subject, number, member_name;
            """,
            (year, term, term, uid, year, term, group_id, uid)
        )
        rows = cur.fetchall() or []

    return [
        {
            "section_id": row[0],
            "class_id": row[1],
            "subject": row[2],
            "number": row[3],
            "title": row[4],
            "member_id": row[5],
            "member_name": row[6],
            "member_avatar_url": row[7],
            "past_year": row[8],
            "past_term": row[9],
            "past_section_id": row[10],
            "past_section": row[11],
            "past_crn": row[12],
        }
        for row in rows
    ]
