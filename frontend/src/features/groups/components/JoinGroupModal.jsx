import { useEffect, useState } from "react";
import { Banner, Button, Field, Input, Modal } from "../../../components/ui.jsx";

export default function JoinGroupModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setJoinCode("");
    setError("");
  }, [isOpen]);

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedJoinCode = joinCode.trim().toUpperCase();
    if (!normalizedJoinCode) {
      setError("Invite code is required.");
      return;
    }

    try {
      setError("");
      await onSubmit(normalizedJoinCode);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to join group");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join group"
      description="Paste the invite code a classmate shared with you and we'll take you straight to the group."
      actions={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="join-group-form" disabled={isSubmitting}>
            {isSubmitting ? "Joining..." : "Join group"}
          </Button>
        </>
      )}
    >
      <form id="join-group-form" className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <Banner title="Group issue" tone="danger">
            {error}
          </Banner>
        ) : null}

        <Field label="Invite code" hint="Letters only">
          <Input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="QWERTYUIOP"
            autoCapitalize="characters"
            autoFocus
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
