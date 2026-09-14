import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../features/auth/auth.js";
import { useProfile } from "../contexts/ProfileContext.jsx";
import { Avatar, buttonStyles, LoadingState } from "../components/ui.jsx";
import { CalendarIcon, CloseIcon, MenuIcon, UsersIcon } from "../components/icons.jsx";

const navItems = [
  { label: "Groups", to: "/mygroups", icon: UsersIcon },
  { label: "Schedules", to: "/schedule", icon: CalendarIcon },
];

function NavItem({ item, mobile = false }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          "motion-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-[transform,background-color,color,box-shadow] duration-200",
          mobile ? "w-full justify-start" : "",
          isActive
            ? "bg-blue-600 !text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.75)]"
            : "text-slate-600 hover:bg-white hover:text-slate-900",
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      <Icon className="size-4" />
      {item.label}
    </NavLink>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isLoading, error } = useProfile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  }, [location.pathname, location.search]);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f6f9fd_0%,_#f2f5f9_100%)]">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/mygroups" className="flex items-center gap-3">
            <img src="/Classmatch-Icon.png" alt="ClassMatch" className="size-10 rounded-xl object-contain" />
            <div>
              <div className="text-base font-semibold tracking-tight text-slate-900">ClassMatch</div>
              <div className="text-xs text-slate-500">Match schedules. Make connections.</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="motion-lift inline-flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition-[transform,background-color,border-color,color,box-shadow] duration-200 md:hidden"
              aria-label={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
            >
              {isMobileMenuOpen ? <CloseIcon className="size-5" /> : <MenuIcon className="size-5" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((open) => !open)}
                className="motion-lift flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition-[transform,border-color,box-shadow,background-color] duration-200 hover:border-blue-200 hover:shadow-md"
              >
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.name || "Profile"}
                  size="sm"
                />
                <div className="hidden text-left sm:block">
                  <div className="max-w-36 truncate text-sm font-semibold text-slate-900">
                    {profile?.name || "Your profile"}
                  </div>
                  <div className="text-xs text-slate-500">Settings</div>
                </div>
              </button>

              {isProfileMenuOpen ? (
                <div className="motion-scale-in absolute right-0 top-[calc(100%+0.75rem)] w-64 rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_22px_50px_-24px_rgba(15,23,42,0.4)]">
                  {isLoading ? (
                    <LoadingState title="Loading profile" compact />
                  ) : (
                    <>
                      <div className="mb-3 rounded-2xl bg-slate-50 p-3">
                        <div className="text-sm font-semibold text-slate-900">{profile?.name}</div>
                        <div className="truncate text-xs text-slate-500">{profile?.email}</div>
                      </div>
                      <div className="space-y-2">
                        <Link
                          to="/settings"
                          className="block rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          Profile & settings
                        </Link>
                        <button
                          type="button"
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                          className="block w-full rounded-2xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLoggingOut ? "Signing out..." : "Sign out"}
                        </button>
                      </div>
                    </>
                  )}
                  {error ? (
                    <p className="mt-3 text-xs text-rose-600">{error}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isMobileMenuOpen ? (
          <div className="motion-fade-in border-t border-slate-200 bg-white/95 px-4 py-4 md:hidden">
            <div className="space-y-2">
              {navItems.map((item) => (
                <NavItem key={item.to} item={item} mobile />
              ))}
              <Link to="/settings" className={buttonStyles({ variant: "secondary", size: "md", className: "w-full justify-center" })}>
                Profile & settings
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
