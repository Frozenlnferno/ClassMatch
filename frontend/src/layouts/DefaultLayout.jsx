import { Outlet } from "react-router-dom";

export default function DefaultLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-page)] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,_var(--color-primary-softer),_transparent)]" />
      <div className="relative">
        <Outlet />
      </div>
    </div>
  );
}
