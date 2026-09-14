import { Button, Modal } from "../../../components/ui.jsx";

export default function LeaveGroupModal({ group, isOpen, onClose, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Leave group"
      description={group?.name ? `You’ll be removed from ${group.name}.` : "You’ll be removed from this group."}
      actions={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Leave group</Button>
        </>
      )}
    >
      <div className="text-sm leading-6 text-slate-600">
        You can rejoin later with an invite link or join code if the group is still open to new members.
      </div>
    </Modal>
  );
}
