import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Field,
  Input,
  Modal,
  TextArea,
} from "../../../components/ui.jsx";

export default function EditProfileModal({ isOpen, onClose, profile, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({ name: "", bio: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      name: profile?.name || "",
      bio: profile?.bio || "",
    });
    setError("");
  }, [isOpen, profile]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Display name is required.");
      return;
    }

    try {
      setError("");
      await onSubmit({
        name: form.name.trim(),
        bio: form.bio.trim(),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update profile");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit profile"
      description="Update how classmates see your name and bio throughout ClassMatch."
      actions={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-profile-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </>
      )}
    >
      <form id="edit-profile-form" className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <Banner title="Profile issue" tone="danger">
            {error}
          </Banner>
        ) : null}

        <Field label="Display name">
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="How classmates should know you"
          />
        </Field>

        <Field label="Bio">
          <TextArea
            value={form.bio}
            onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
            placeholder="Tell classmates a little about yourself, your focus, or what you're working on."
          />
        </Field>
      </form>
    </Modal>
  );
}
