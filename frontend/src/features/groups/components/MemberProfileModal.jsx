import {
  Avatar,
  Banner,
  Button,
  LoadingState,
  Modal,
} from "../../../components/ui.jsx";
import { formatDate } from "../../../utils/classMatch.js";

export default function MemberProfileModal({
  member,
  profile,
  isOpen,
  isLoading,
  error,
  onClose,
}) {
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
              <div className="text-2xl font-semibold text-slate-900">{profile?.name || member?.name}</div>
              <div className="mt-1 text-sm text-slate-500">{member?.role}</div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Joined ClassMatch</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatDate(profile?.created_at)}</div>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Joined group</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatDate(member?.joined_at)}</div>
            </div>
          </div>
          <div className="rounded-[28px] bg-slate-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Bio</div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {profile?.bio || "This member hasn't added a bio yet."}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
