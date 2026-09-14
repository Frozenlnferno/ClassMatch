import { Navigate, Outlet, useLocation } from "react-router-dom";
import useSession from "../utils/useSession.js";
import { LoadingState } from "./ui.jsx";
import { resolveNextPath } from "../utils/classMatch.js";

/**
 * ProtectedRoute: Redirects to /login if no session
 * @param {JSX.Element} element - Component to render
 * @returns {JSX.Element} Component or redirect
 */
export function ProtectedRoute({ element, children }) {
  const { session, isSessionLoading } = useSession();
  const location = useLocation();

  if (isSessionLoading) {
    return <LoadingState title="Checking your session" description="Getting ClassMatch ready for you." />;
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return element || children || <Outlet />;
}

/**
 * PublicRoute: Redirects to /mygroups if session exists
 * Used for login/signup pages to prevent logged-in users from accessing them
 * @param {JSX.Element} element - Component to render
 * @returns {JSX.Element} Component or redirect
 */
export function PublicRoute({ element, children }) {
  const { session, isSessionLoading } = useSession();
  const location = useLocation();

  if (isSessionLoading) {
    return <LoadingState title="Checking your session" description="Getting ClassMatch ready for you." />;
  }

  if (session) {
    const next = new URLSearchParams(location.search).get("next");
    return <Navigate to={resolveNextPath(next, "/mygroups")} replace />;
  }

  return element || children || <Outlet />;
}
