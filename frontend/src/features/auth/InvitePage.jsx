import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import useSession from "../../utils/useSession.js";
import { joinGroupByInviteLink } from "../groups/groupService.js";
import { Card, LoadingState, buttonStyles } from "../../components/ui.jsx";
import { UsersIcon } from "../../components/icons.jsx";
import { withNextPath } from "../../utils/classMatch.js";

export default function InvitePage() {
  const { inviteCode = "" } = useParams();
  const navigate = useNavigate();
  const { session, isSessionLoading } = useSession();
  const attemptedInviteRef = useRef("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isSessionLoading || !session || !inviteCode || attemptedInviteRef.current === inviteCode) return;
    attemptedInviteRef.current = inviteCode;

    async function acceptInvite() {
      try {
        setError("");
        const response = await joinGroupByInviteLink(inviteCode);
        if (response.group_id) {
          navigate(`/groups/${response.group_id}`, { replace: true });
          return;
        }
        navigate("/mygroups", { replace: true });
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : "Unable to join this group right now.");
      }
    }

    acceptInvite();
  }, [inviteCode, isSessionLoading, navigate, session]);

  if (isSessionLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10 sm:px-6">
        <LoadingState title="Checking your session" description="Getting your invitation ready." />
      </div>
    );
  }

  if (!session) {
    return <Navigate to={withNextPath("/login", `/invite/${inviteCode}`)} replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
      <Card className="motion-fade-up w-full p-8 text-center sm:p-10">
        <Link to="/" className="mx-auto inline-flex items-center gap-3">
          <div className="size-11 shrink-0 overflow-hidden rounded-xl">
            <img
              src="/Classmatch-Icon.png"
              alt="ClassMatch"
              className="size-full scale-[1.2] object-contain"
            />
          </div>
          <div className="text-xl font-bold tracking-tight sm:text-2xl">
            <span className="text-white">Class</span>
            <span className="text-[#fd8701]">Match</span>
          </div>
        </Link>

        {error ? (
          <div className="mt-8 space-y-6">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <UsersIcon className="size-7" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">This invite is unavailable</h1>
              <p className="mx-auto max-w-md text-sm leading-6 text-slate-600">{error}</p>
            </div>
            <Link to="/mygroups" className={buttonStyles({ variant: "primary", size: "lg" })}>
              Go to My Groups
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
              <UsersIcon className="size-7" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Joining your group</h1>
              <p className="text-sm leading-6 text-slate-600">
                Accepting your invitation and opening the group workspace.
              </p>
            </div>
            <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
              <span className="size-4 animate-spin rounded-full border-2 border-indigo-200 border-t-[var(--color-primary)]" />
              Joining group...
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
