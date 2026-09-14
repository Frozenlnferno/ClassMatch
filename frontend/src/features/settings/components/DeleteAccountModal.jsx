import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Field,
  Input,
  Modal,
} from "../../../components/ui.jsx";

export default function DeleteAccountModal({ isOpen, onClose, onConfirm, isDeleting }) {
  const [confirmationText, setConfirmationText] = useState("");

  useEffect(() => {
    if (isOpen) {
      setConfirmationText("");
    }
  }, [isOpen]);

  const canDelete = confirmationText === "DELETE";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete account"
      description="This permanently deletes your ClassMatch account, schedules, and group memberships."
      actions={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={!canDelete || isDeleting}>
            {isDeleting ? "Deleting..." : "Delete account"}
          </Button>
        </>
      )}
    >
      <div className="space-y-5">
        <Banner title="This action cannot be undone" tone="danger">
          Type DELETE below to confirm that you want to remove your account and all associated data.
        </Banner>

        <Field label='Type "DELETE" to confirm'>
          <Input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
