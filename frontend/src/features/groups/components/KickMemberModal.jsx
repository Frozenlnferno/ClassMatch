import { Avatar, Button, Modal } from "../../../components/ui.jsx";

export default function KickMemberModal({ group, member, isOpen, onClose, onConfirm, isRemoving }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove member"
      description={member?.name && group?.name ? `Remove ${member.name} from ${group.name}?` : "Remove this member from the group?"}
      size="sm"
      actions={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isRemoving}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={isRemoving}>
            {isRemoving ? "Removing..." : "Remove member"}
          </Button>
        </>
      )}
    >
      <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
        <Avatar src={member?.avatar_url} name={member?.name} size="md" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{member?.name || "Member"}</div>
          <div className="mt-1 text-sm text-slate-500">
            They will lose access to this group's member list and schedule overlap.
          </div>
        </div>
      </div>
    </Modal>
  );
}
