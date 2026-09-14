import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Banner,
  Button,
  Field,
  Input,
  Modal,
  TextArea,
  Toggle,
} from "../../../components/ui.jsx";

export default function EditGroupModal({ group, isOpen, onClose, onSubmit, isSubmitting }) {
  const iconInputRef = useRef(null);
  const [form, setForm] = useState({ name: "", description: "", joinable: true, iconFile: null, removeIcon: false });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !group) return;
    setForm({
      name: group.name || "",
      description: group.description || "",
      joinable: Boolean(group.joinable),
      iconFile: null,
      removeIcon: false,
    });
    setError("");
  }, [group, isOpen]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Group name is required.");
      return;
    }

    try {
      setError("");
      await onSubmit(form);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update group");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit group"
      description="Update your group details, joinability, and icon."
      actions={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-group-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save group"}
          </Button>
        </>
      )}
    >
      <form id="edit-group-form" className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <Banner title="Group issue" tone="danger">
            {error}
          </Banner>
        ) : null}

        <Field label="Group name">
          <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </Field>

        <Field label="Group bio">
          <TextArea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </Field>

        <Field label="Joinability">
          <Toggle
            checked={form.joinable}
            onChange={(joinable) => setForm((current) => ({ ...current, joinable }))}
            onLabel="Open"
            offLabel="Closed"
          />
        </Field>

        <Field label="Group icon">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar src={form.removeIcon ? null : group?.group_icon_url} name={form.name || group?.name} size="lg" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  {form.iconFile ? form.iconFile.name : form.removeIcon ? "Icon will be removed" : group?.group_icon_url ? "Current group icon" : "No icon set"}
                </div>
                <div className="mt-1 text-xs text-slate-500">PNG, JPEG, GIF, or WEBP.</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => iconInputRef.current?.click()}>
                {group?.group_icon_url || form.iconFile ? "Change icon" : "Upload icon"}
              </Button>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setForm((current) => ({
                  ...current,
                  iconFile: event.target.files?.[0] || null,
                  removeIcon: false,
                }))}
                className="hidden"
              />
              {group?.group_icon_url || form.iconFile ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((current) => ({ ...current, iconFile: null, removeIcon: true }))}
                >
                  Remove icon
                </Button>
              ) : null}
            </div>
          </div>
        </Field>
      </form>
    </Modal>
  );
}
