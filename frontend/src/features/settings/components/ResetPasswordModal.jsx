import { useEffect, useState } from "react";
import { Banner, Button, Field, Input, Modal } from "../../../components/ui.jsx";

export default function ResetPasswordModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm({ password: "", confirmPassword: "" });
    setError("");
  }, [isOpen]);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setError("");
      await onSubmit(form);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update password");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset password"
      description="Choose a new password for your ClassMatch account."
      actions={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="reset-password-form" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Reset password"}
          </Button>
        </>
      )}
    >
      <form id="reset-password-form" className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <Banner title="Settings issue" tone="danger">
            {error}
          </Banner>
        ) : null}

        <Field label="New password">
          <Input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            autoComplete="new-password"
            required
          />
        </Field>

        <Field label="Confirm password">
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            autoComplete="new-password"
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
