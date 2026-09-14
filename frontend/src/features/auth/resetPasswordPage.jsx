import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestPasswordReset, updatePassword } from "./auth.js";
import useSession from "../../utils/useSession.js";
import { Button, Card, Field, Input } from "../../components/ui.jsx";
import { LockIcon, LogoMark, MailIcon } from "../../components/icons.jsx";
import { normalizeEmail } from "../../utils/normalize.js";
import { useNotifications } from "../../contexts/NotificationsContext.jsx";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { notifyError, notifySuccess } = useNotifications();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestReset(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      await requestPasswordReset(normalizeEmail(email));
      notifySuccess("Success", "Reset link sent. Check your inbox for the email from ClassMatch.");
    } catch (requestError) {
      notifyError("Reset issue", requestError instanceof Error ? requestError.message : "Unable to send reset email");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      notifyError("Reset issue", "Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await updatePassword(password);
      notifySuccess("Success", "Password updated. You can log in with your new password now.");
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (updateError) {
      notifyError("Reset issue", updateError instanceof Error ? updateError.message : "Unable to update password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <Card className="motion-fade-up w-full p-8 sm:p-10">
        <div className="space-y-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <LogoMark className="size-10 text-blue-600" />
            <div>
              <div className="text-base font-semibold text-slate-900">ClassMatch</div>
              <div className="text-sm text-slate-500">Password recovery</div>
            </div>
          </Link>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Reset password</div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {session ? "Choose a new password" : "Request a password reset link"}
            </h1>
            <p className="text-sm leading-6 text-slate-500">
              {session
                ? "You can finish the reset here after opening the recovery link from your email."
                : "Enter your account email and we'll send you a secure password reset link."}
            </p>
          </div>

          {session ? (
            <form className="space-y-4" onSubmit={handlePasswordUpdate}>
              <Field label="New password">
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pl-11"
                    placeholder="New password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </Field>

              <Field label="Confirm password">
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="pl-11"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </Field>

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Updating password..." : "Update password"}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRequestReset}>
              <Field label="Email">
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-11"
                    placeholder="name@school.edu"
                    autoComplete="email"
                    required
                  />
                </div>
              </Field>

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Sending link..." : "Send reset link"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">
              Back to login
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
