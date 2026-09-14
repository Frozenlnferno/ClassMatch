import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Field,
  Input,
  Modal,
  TextArea,
  Toggle,
} from "../../../components/ui.jsx";

export default function CreateGroupModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({
    groupName: "",
    description: "",
    joinable: true,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setForm({ groupName: "", description: "", joinable: true });
    setError("");
  }, [isOpen]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.groupName.trim()) {
      setError("Group name is required.");
      return;
    }

    try {
      setError("");
      await onSubmit({
        groupName: form.groupName.trim(),
        description: form.description.trim(),
        joinable: form.joinable,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create group");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a group"
      description="Set up a shared space for classmates, friends, or study partners."
      actions={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-group-form" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create group"}
          </Button>
        </>
      )}
    >
      <form id="create-group-form" className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <Banner title="Group issue" tone="danger">
            {error}
          </Banner>
        ) : null}

        <Field label="Group name">
          <Input
            value={form.groupName}
            onChange={(event) => setForm((current) => ({ ...current, groupName: event.target.value }))}
            placeholder="CS 374 Study Group"
            required
          />
        </Field>

        <Field label="Description">
          <TextArea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="What this group is for, who it's for, and how people should use it."
          />
        </Field>

        <Field label="Joinability" hint={form.joinable ? "Anyone with the code can join" : "Only the owner can re-open it"}>
          <Toggle
            checked={form.joinable}
            onChange={(joinable) => setForm((current) => ({ ...current, joinable }))}
            onLabel="Open"
            offLabel="Closed"
          />
        </Field>
      </form>
    </Modal>
  );
}
