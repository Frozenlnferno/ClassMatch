import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginWithEmail, signInWithGoogleTo } from "./auth.js";
import { normalizeEmail } from "../../utils/normalize.js";
import { Button, Card, Field, Input, buttonStyles } from "../../components/ui.jsx";
import { LockIcon, LogoMark, MailIcon } from "../../components/icons.jsx";
import { resolveNextPath, withNextPath } from "../../utils/classMatch.js";
import { useNotifications } from "../../contexts/NotificationsContext.jsx";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notifyError } = useNotifications();
  const [form, setForm] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const nextPath = useMemo(
    () => resolveNextPath(new URLSearchParams(location.search).get("next"), "/mygroups"),
    [location.search],
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      await loginWithEmail(normalizeEmail(form.email), form.password);
      navigate(nextPath, { replace: true });
    } catch (loginError) {
      notifyError("Login failed", loginError instanceof Error ? loginError.message : "Unable to log in right now");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setIsGoogleLoading(true);
      await signInWithGoogleTo(nextPath);
    } catch (googleError) {
      notifyError("Login failed", googleError instanceof Error ? googleError.message : "Unable to start Google login");
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
      <div className="w-full">
        <Card className="motion-fade-up p-8 sm:p-10">
          <div className="space-y-6">
            <Link to="/" className="inline-flex items-center gap-3">
              <LogoMark className="size-10 text-[var(--color-primary)]" />
              <span className="text-base font-semibold text-slate-900">ClassMatch</span>
            </Link>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Log in</h1>
              <p className="text-sm leading-6 text-slate-500">Welcome back. Pick up where your schedule and groups left off.</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className={buttonStyles({ variant: "secondary", size: "lg", className: "w-full" })}
            >
              <span className="text-base font-bold text-[#4285F4]">G</span>
              {isGoogleLoading ? "Redirecting to Google..." : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-[var(--color-border)]" />
              <span>or</span>
              <span className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field label="Email">
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className="pl-11"
                    placeholder="name@school.edu"
                    autoComplete="email"
                    required
                  />
                </div>
              </Field>

              <Field label="Password">
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    className="pl-11"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </Field>

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Logging in..." : "Log in"}
              </Button>
            </form>

            <Link to="/reset-password" className="block text-center text-sm font-medium text-[var(--color-primary)] transition hover:text-[var(--color-primary-hover)]">
              Forgot password?
            </Link>
          </div>
        </Card>
        <p className="mt-6 text-center text-sm text-slate-500">
          Need an account?{" "}
          <Link to={withNextPath("/signup", nextPath)} className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
