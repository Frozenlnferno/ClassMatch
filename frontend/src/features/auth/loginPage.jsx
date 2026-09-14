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
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="motion-fade-up hidden bg-[linear-gradient(180deg,_rgba(239,246,255,0.92)_0%,_rgba(255,255,255,0.9)_100%)] p-10 lg:block">
          <div className="space-y-8">
            <Link to="/" className="inline-flex items-center gap-3">
              <LogoMark className="size-11 text-blue-600" />
              <div>
                <div className="text-base font-semibold text-slate-900">ClassMatch</div>
                <div className="text-sm text-slate-500">Your shared-course workspace</div>
              </div>
            </Link>

            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Welcome back</div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Pick up right where your schedule and groups left off.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-600">
                Log in to manage schedules, see classmates in common courses, and keep group conversations centered around the classes that matter.
              </p>
            </div>
          </div>
        </Card>

        <Card className="motion-fade-up motion-delay-1 p-8 sm:p-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Log in</div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Access your ClassMatch account</h2>
              <p className="text-sm leading-6 text-slate-500">
                Use your email and password, or continue with Google.
              </p>
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

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className={buttonStyles({ variant: "secondary", size: "lg", className: "w-full" })}
              >
                {isGoogleLoading ? "Redirecting to Google..." : "Continue with Google"}
              </button>
              <Link to="/reset-password" className="block text-center text-sm font-medium text-blue-600 transition hover:text-blue-700">
                Forgot your password?
              </Link>
            </div>

            <p className="text-center text-sm text-slate-500">
              Need an account?{" "}
              <Link to={withNextPath("/signup", nextPath)} className="font-semibold text-blue-600 hover:text-blue-700">
                Sign up
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
