import {
  Avatar,
  Button,
  Card,
  Modal,
} from "../../../components/ui.jsx";
import { formatCourseCode, formatScheduleLabel, formatTimeRange } from "../../../utils/classMatch.js";

export default function ClassDetailsModal({ course, isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={course ? `${formatCourseCode(course)} - ${course.title}` : "Class details"}
      description="Expanded course details and overlap with your group."
      actions={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {course ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Section</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{course.section || "TBA"}</div>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CRN</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{course.crn}</div>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Type</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{course.courseType || "Not listed"}</div>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Meeting</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{formatTimeRange(course.startTime, course.endTime)}</div>
              <div className="text-xs text-slate-400">{course.daysOfWeek || "Days arranged"}</div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-[28px] bg-slate-50/80 p-5 shadow-none">
              <div className="text-lg font-semibold text-slate-900">Groupmates in this class now</div>
              <div className="mt-4 space-y-3">
                {course.currentClassmates.length ? course.currentClassmates.map((match) => (
                  <div key={match.member_id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                    <Avatar src={match.avatar_url} name={match.member_name} size="sm" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{match.member_name}</div>
                      <div className="text-xs text-slate-500">{match.role || "Member"}</div>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No current overlap in this class yet.</p>
                )}
              </div>
            </Card>

            <Card className="rounded-[28px] bg-slate-50/80 p-5 shadow-none">
              <div className="text-lg font-semibold text-slate-900">People who took it before</div>
              <div className="mt-4 space-y-3">
                {course.pastClassmates.length ? course.pastClassmates.map((match) => (
                  <div key={`${match.member_id}-${match.past_section_id}`} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                    <Avatar src={match.member_avatar_url} name={match.member_name} size="sm" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{match.member_name}</div>
                      <div className="text-xs text-slate-500">
                        {formatScheduleLabel({ term: match.past_term, year: match.past_year })} - Section {match.past_section || "TBA"} - CRN {match.past_crn}
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No past overlap found for this class.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
