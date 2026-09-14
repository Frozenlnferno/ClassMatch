import { buildPublicAppUrl } from "../config/site.js";

export const TERM_OPTIONS = [
  { value: "fall", label: "Fall" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
];

const TERM_ORDER = {
  spring: 1,
  summer: 2,
  fall: 3,
};

export function resolveNextPath(next, fallback = "/mygroups") {
  if (!next || typeof next !== "string") return fallback;
  return next.startsWith("/") ? next : fallback;
}

export function withNextPath(path, next) {
  const safeNext = resolveNextPath(next, "");
  if (!safeNext) return path;
  return `${path}?next=${encodeURIComponent(safeNext)}`;
}

export function sortSchedules(schedules) {
  return [...schedules].sort((a, b) => {
    const yearDiff = Number(b.year) - Number(a.year);
    if (yearDiff !== 0) return yearDiff;
    return (TERM_ORDER[b.term] || 0) - (TERM_ORDER[a.term] || 0);
  });
}

export function groupSchedulesByYear(schedules) {
  const groups = [];
  const sorted = sortSchedules(schedules);

  sorted.forEach((schedule) => {
    const existing = groups.find((group) => group.year === schedule.year);
    if (existing) {
      existing.items.push(schedule);
    } else {
      groups.push({ year: schedule.year, items: [schedule] });
    }
  });

  return groups;
}

export function formatTerm(term) {
  return TERM_OPTIONS.find((item) => item.value === term)?.label || term;
}

export function getScheduleKey({ year, term }) {
  return `${year}:${term}`;
}

export function parseScheduleKey(value) {
  const [year, term] = value.split(":");
  return { year: Number(year), term };
}

export function formatScheduleLabel(schedule) {
  return `${formatTerm(schedule.term)} ${schedule.year}`;
}

export function getYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, index) => currentYear - index);
}

export function getInitials(name) {
  if (!name) return "CM";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function normalizeCourse(record) {
  return {
    id: record.id || record.class_id || record.classId,
    sectionId: record.section_id || record.sectionId,
    subject: record.subject || record.Subject || "",
    number: record.number || record.course_number || record["Subject Number"] || "",
    title: record.title || record.Title || "",
    section: record.section || record.Section || "",
    crn: String(record.crn || record.CRN || ""),
    courseType: record.course_type || record.CourseType || record["Course Type"] || "",
    instructor: record.instructor || record.Instructor || "",
    building: record.building || record.Building || "",
    roomNumber: record.room_number || record.RoomNumber || record["Room Number"] || "",
    startTime: record.start_time || record.StartTime || record["Start Time"] || "",
    endTime: record.end_time || record.EndTime || record["End Time"] || "",
    daysOfWeek: record.days_of_week || record.DaysOfWeek || record["Days of Week"] || "",
    term: record.term || record.Term || "",
    year: Number(record.year || record.Year || 0),
  };
}

export function formatCourseCode(course) {
  return `${course.subject} ${course.number}`;
}

export function formatTime(value) {
  if (!value) return "TBA";

  const parts = String(value).split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const normalizedHours = hours % 12 || 12;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return "Time arranged";
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

export function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

export function buildInviteLink(inviteCode) {
  return buildPublicAppUrl(`/invite/${encodeURIComponent(inviteCode)}`);
}

export function roleRank(role) {
  return {
    owner: 3,
    admin: 2,
    member: 1,
  }[role] || 0;
}

export function canManageMember(myRole, memberRole, isSelf = false) {
  if (isSelf) return false;
  return roleRank(myRole) > roleRank(memberRole) && roleRank(myRole) >= 2;
}
