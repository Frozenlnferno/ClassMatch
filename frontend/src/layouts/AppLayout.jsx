import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useProfile } from "../contexts/ProfileContext.jsx";
import { Avatar } from "../components/ui.jsx";
import { CalendarIcon, CloseIcon, MenuIcon, UserIcon, UsersIcon } from "../components/icons.jsx";

const navItems = [
  { label: "Groups", to: "/mygroups", icon: UsersIcon },
  { label: "Schedules", to: "/schedule", icon: CalendarIcon },
  { label: "Settings", to: "/settings", icon: UserIcon },
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
            ? "bg-[#312E81] !text-white shadow-[0_14px_32px_-18px_rgba(49,46,129,0.75)]"
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
  const location = useLocation();
  const { profile } = useProfile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fbfbff_0%,_#f7f8fc_100%)]">
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
              item.to === "/settings" ? null : <NavItem key={item.to} item={item} />
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

            <NavLink
              to="/settings"
              aria-label="Open settings"
              className={({ isActive }) => [
                "motion-lift inline-flex size-11 items-center justify-center rounded-2xl border transition-[transform,border-color,box-shadow,background-color] duration-200",
                isActive
                  ? "border-[#312E81] bg-indigo-50 shadow-sm"
                  : "border-transparent bg-transparent hover:border-[#E6E8F0] hover:bg-white",
              ].join(" ")}
            >
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.name || "Profile"}
                  size="sm"
                />
            </NavLink>
          </div>
        </div>

        {isMobileMenuOpen ? (
          <div className="motion-fade-in border-t border-slate-200 bg-white/95 px-4 py-4 md:hidden">
            <div className="space-y-2">
              {navItems.map((item) => (
                <NavItem key={item.to} item={item} mobile />
              ))}
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
