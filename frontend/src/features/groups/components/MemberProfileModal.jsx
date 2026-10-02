import {
  Avatar,
  Banner,
  Button,
  LoadingState,
  Modal,
} from "../../../components/ui.jsx";
import {
  formatCompactScheduleLabel,
  formatDate,
  formatRole,
} from "../../../utils/classMatch.js";

export default function MemberProfileModal({
  member,
  profile,
  isOpen,
  isLoading,
  error,
  onClose,
}) {
  const scheduleTerms = member?.schedule_terms || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={member?.name || "Member details"}
      description="Profile details for this group member."
      actions={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {isLoading ? (
        <LoadingState title="Loading member" compact />
      ) : error ? (
        <Banner title="Member issue" tone="danger">
          {error}
        </Banner>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar src={profile?.avatar_url || member?.avatar_url} name={profile?.name || member?.name} size="xl" />
            <div>
              <div className="text-2xl font-semibold text-[var(--color-text-card)]">{profile?.name || member?.name}</div>
              <div className="mt-1 text-sm text-slate-500">{formatRole(member?.role)}</div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] bg-slate-50 p-5">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Joined ClassMatch</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatDate(profile?.created_at)}</div>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-5">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Joined group</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatDate(member?.joined_at)}</div>
            </div>
          </div>
          <div className="rounded-[28px] bg-slate-50 p-5">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Bio</div>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
              {profile?.bio || "This member hasn't added a bio yet."}
            </p>
          </div>
          <div className="rounded-[28px] bg-slate-50 p-5">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Schedule uploads</div>
            {scheduleTerms.length ? (
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Uploaded schedule terms">
                {scheduleTerms.map((schedule) => {
                  const scheduleKey = `${schedule.year}:${schedule.term}`;
                  return (
                    <span
                      key={scheduleKey}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500"
                    >
                      {formatCompactScheduleLabel(schedule)}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No schedules yet.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
