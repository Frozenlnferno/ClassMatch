import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signInWithGoogleTo, signUpWithEmail } from "./auth.js";
import { normalizeEmail, normalizeName } from "../../utils/normalize.js";
import { Button, Card, Field, Input, buttonStyles } from "../../components/ui.jsx";
import { LockIcon, LogoMark, MailIcon } from "../../components/icons.jsx";
import { resolveNextPath, withNextPath } from "../../utils/classMatch.js";
import { useNotifications } from "../../contexts/NotificationsContext.jsx";

export default function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notifyError, notifySuccess } = useNotifications();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
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

    if (form.password !== form.confirmPassword) {
      notifyError("Signup failed", "Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);

      const data = await signUpWithEmail(
        normalizeEmail(form.email),
        form.password,
        normalizeName(form.name),
      );

      if (data.session) {
        navigate(nextPath, { replace: true });
        return;
      }

      notifySuccess("Check your email", "Account created. Check your inbox to finish verifying your email before logging in.");
    } catch (signUpError) {
      notifyError("Signup failed", signUpError instanceof Error ? signUpError.message : "Unable to create your account");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignup() {
    try {
      setIsGoogleLoading(true);
      await signInWithGoogleTo(nextPath);
    } catch (googleError) {
      notifyError("Signup failed", googleError instanceof Error ? googleError.message : "Unable to start Google signup");
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="motion-fade-up p-8 sm:p-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Create account</div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Start building your course network</h2>
              <p className="text-sm leading-6 text-slate-500">
                Set up your account, then upload a schedule and start matching with classmates.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field label="Display name">
                <Input
                  type="text"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="How classmates will know you"
                  autoComplete="name"
                  required
                />
              </Field>

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
                    placeholder="Choose a password"
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
                    value={form.confirmPassword}
                    onChange={(event) => updateField("confirmPassword", event.target.value)}
                    className="pl-11"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </Field>

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={isGoogleLoading}
                className={buttonStyles({ variant: "secondary", size: "lg", className: "w-full" })}
              >
                {isGoogleLoading ? "Redirecting to Google..." : "Sign up with Google"}
              </button>
            </div>

            <p className="text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link to={withNextPath("/login", nextPath)} className="font-semibold text-blue-600 hover:text-blue-700">
                Log in
              </Link>
            </p>
          </div>
        </Card>

        <Card className="motion-fade-up motion-delay-1 hidden bg-[linear-gradient(180deg,_rgba(239,246,255,0.92)_0%,_rgba(255,255,255,0.9)_100%)] p-10 lg:block">
          <div className="space-y-8">
            <Link to="/" className="inline-flex items-center gap-3">
              <LogoMark className="size-11 text-blue-600" />
              <div>
                <div className="text-base font-semibold text-slate-900">ClassMatch</div>
                <div className="text-sm text-slate-500">Start with the classes you already share</div>
              </div>
            </Link>

            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">What happens next</div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Bring your schedule in once. Let the rest of your course network unfold from there.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-600">
                After signup, you can add schedules, join groups, and see exactly which classmates overlap with your classes in a clean, focused workspace.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
