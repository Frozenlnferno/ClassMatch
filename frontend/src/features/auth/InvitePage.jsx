import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useSession from "../../utils/useSession.js";
import { joinGroupByInviteCodeURL } from "../groups/groupService.js";
import { Button, Card, PageHeader, buttonStyles } from "../../components/ui.jsx";
import { CopyIcon, LogoMark, UsersIcon } from "../../components/icons.jsx";
import { buildInviteLink, copyText, withNextPath } from "../../utils/classMatch.js";
import { useNotifications } from "../../contexts/NotificationsContext.jsx";

export default function InvitePage() {
  const { inviteCode = "" } = useParams();
  const navigate = useNavigate();
  const { session, isSessionLoading } = useSession();
  const { notifyError } = useNotifications();
  const [copied, setCopied] = useState(false);
  const attemptedInviteRef = useRef("");

  const inviteLink = useMemo(() => buildInviteLink(inviteCode), [inviteCode]);

  useEffect(() => {
    if (isSessionLoading || !session || !inviteCode || attemptedInviteRef.current === inviteCode) return;
    attemptedInviteRef.current = inviteCode;

    async function acceptInvite() {
      try {
        const response = await joinGroupByInviteCodeURL(inviteCode);
        if (response.group_id) {
          navigate(`/groups/${response.group_id}`, { replace: true });
          return;
        }
        navigate("/mygroups", { replace: true });
      } catch (joinError) {
        notifyError("Invite issue", joinError instanceof Error ? joinError.message : "Unable to join this group right now");
      }
    }

    acceptInvite();
  }, [inviteCode, isSessionLoading, navigate, notifyError, session]);

  async function handleCopy() {
    try {
      await copyText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      notifyError("Invite issue", copyError instanceof Error ? copyError.message : "Couldn't copy invite link");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <Card className="motion-fade-up w-full overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6 bg-[linear-gradient(180deg,_rgba(239,246,255,0.9)_0%,_rgba(255,255,255,0.86)_100%)] p-8 sm:p-10">
            <Link to="/" className="inline-flex items-center gap-3">
              <LogoMark className="size-10 text-blue-600" />
              <div>
                <div className="text-sm font-semibold text-slate-900">ClassMatch</div>
                <div className="text-xs text-slate-500">Invite link</div>
              </div>
            </Link>

            <PageHeader
              eyebrow="Join a group"
              title="Accept your ClassMatch invite"
              description="This invite will connect you to a group so you can compare schedules, find classmates in common courses, and stay coordinated."
            />

            <div className="rounded-[28px] border border-blue-100 bg-white/90 p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <UsersIcon className="size-6" />
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Invite code</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[0.18em] text-slate-900">{inviteCode}</div>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    You can keep this link handy or copy the code into the Groups page later if you want to join manually.
                  </p>
                  <Button variant="secondary" onClick={handleCopy}>
                    <CopyIcon className="size-4" />
                    {copied ? "Copied" : "Copy invite link"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center p-8 sm:p-10">
            {isSessionLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-28 rounded-full bg-slate-100" />
                <div className="h-10 w-full rounded-2xl bg-slate-100" />
                <div className="h-10 w-3/4 rounded-2xl bg-slate-100" />
              </div>
            ) : session ? (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Signed in</div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Joining your group</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Accepting your invite and taking you to the group workspace.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                  <span className="size-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                  Joining group...
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Sign in to continue</div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">You'll need an account first</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Log in or create your account, then come right back here and we'll complete the join flow.
                  </p>
                </div>
                <div className="space-y-3">
                  <Link to={withNextPath("/login", `/invite/${inviteCode}`)} className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}>
                    Log in
                  </Link>
                  <Link to={withNextPath("/signup", `/invite/${inviteCode}`)} className={buttonStyles({ variant: "secondary", size: "lg", className: "w-full" })}>
                    Create account
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
