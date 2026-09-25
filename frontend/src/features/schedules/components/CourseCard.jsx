import { Badge } from "../../../components/ui.jsx";
import { formatCourseCode, formatTimeRange } from "../../../utils/classMatch.js";

export default function CourseCard({ course, isSelected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(course)}
      className={[
        "motion-lift w-full rounded-[var(--radius-card)] border p-5 text-left transition-[transform,border-color,background-color,box-shadow] duration-200",
        isSelected
          ? "border-indigo-300 bg-indigo-50/80 shadow-[0_20px_45px_-32px_var(--color-shadow)]"
          : "border-[var(--color-border)] !bg-[var(--color-surface-level-2)] hover:border-cyan-300 hover:!bg-[var(--color-surface-secondary)]",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-lg font-semibold text-slate-900">{course.title}</div>
          <div className="text-sm font-medium text-slate-500">{formatCourseCode(course)} - Section {course.section || "TBA"}</div>
        </div>
        <Badge tone={isSelected ? "blue" : "neutral"}>{course.crn || "No CRN"}</Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Type</div>
          <div className="mt-1 font-medium text-slate-700">{course.courseType || "Not listed"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Instructor</div>
          <div className="mt-1 font-medium text-slate-700">{course.instructor || "Not listed"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Location</div>
          <div className="mt-1 font-medium text-slate-700">
            {[course.building, course.roomNumber].filter(Boolean).join(" ") || "Arranged"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Meeting</div>
          <div className="mt-1 font-medium text-slate-700">{formatTimeRange(course.startTime, course.endTime)}</div>
          <div className="text-xs text-slate-400">{course.daysOfWeek || "Days arranged"}</div>
        </div>
      </div>
    </button>
  );
}
