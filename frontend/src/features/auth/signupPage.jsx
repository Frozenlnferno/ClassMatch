import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signInWithGoogleTo, signUpWithEmail } from "./auth.js";
import { normalizeEmail, normalizeName } from "../../utils/normalize.js";
import { Button, Card, Field, Input, buttonStyles } from "../../components/ui.jsx";
import { LockIcon, LogoMark, MailIcon, UserIcon } from "../../components/icons.jsx";
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
        nextPath,
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
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
      <div className="w-full">
        <Card className="motion-fade-up p-8 sm:p-10">
          <div className="space-y-6">
            <Link to="/" className="inline-flex items-center gap-3">
              <LogoMark className="size-10 text-[#312E81]" />
              <span className="text-base font-semibold text-slate-900">ClassMatch</span>
            </Link>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Create account</h1>
              <p className="text-sm leading-6 text-slate-500">Join ClassMatch and find your classmates.</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={isGoogleLoading}
              className={buttonStyles({ variant: "secondary", size: "lg", className: "w-full" })}
            >
              <span className="text-base font-bold text-[#4285F4]">G</span>
              {isGoogleLoading ? "Redirecting to Google..." : "Sign up with Google"}
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-[#E6E8F0]" />
              <span>or</span>
              <span className="h-px flex-1 bg-[#E6E8F0]" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field label="Full name">
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="pl-11"
                    placeholder="Jamie Smith"
                    autoComplete="name"
                    required
                  />
                </div>
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
          </div>
        </Card>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to={withNextPath("/login", nextPath)} className="font-semibold text-[#312E81] hover:text-[#4338CA]">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
