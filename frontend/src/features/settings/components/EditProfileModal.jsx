import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Field,
  Input,
  Modal,
  TextArea,
} from "../../../components/ui.jsx";
import { UploadIcon } from "../../../components/icons.jsx";
import { getUserErrorMessage } from "../../../utils/errorMessage.js";

export default function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onSubmit,
  onUploadPhoto,
  onRemovePhoto,
  isSubmitting,
  isUploadingPhoto,
  isRemovingPhoto,
}) {
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
      setError(getUserErrorMessage(submitError, "We couldn't save your profile changes. Please try again."));
    }
  }

  async function handleRemovePhoto() {
    try {
      setError("");
      await onRemovePhoto();
    } catch (removeError) {
      setError(getUserErrorMessage(removeError, "We couldn't remove your photo. Please try again."));
    }
  }

  async function handleUploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      await onUploadPhoto(file);
    } catch (uploadError) {
      setError(getUserErrorMessage(uploadError, "We couldn't upload your photo. Please try again."));
    } finally {
      event.target.value = "";
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

        <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-card)]">Profile photo</div>
              <div className="mt-1 text-xs text-slate-500">Upload a new photo or use your generated avatar instead.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="motion-lift inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-level-2)] px-3 py-2 text-sm font-semibold text-[var(--color-text-card)] transition-[transform,background-color,border-color] duration-200 hover:border-[var(--color-focus)] hover:bg-[var(--color-surface-secondary)]">
                <UploadIcon className="size-4" />
                {isUploadingPhoto ? "Uploading..." : profile?.avatar_url ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/*" onChange={handleUploadPhoto} className="sr-only" disabled={isUploadingPhoto || isSubmitting} />
              </label>
              {profile?.avatar_url ? (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isRemovingPhoto || isSubmitting}
                  className="motion-lift shrink-0 rounded-[var(--radius-control)] border border-[var(--color-error)] bg-[var(--color-error-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-error)] transition-[transform,background-color,color] duration-200 hover:bg-[var(--color-error)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRemovingPhoto ? "Removing..." : "Remove photo"}
                </button>
              ) : null}
            </div>
          </div>
      </form>
    </Modal>
  );
}
