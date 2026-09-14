import { Outlet } from "react-router-dom";

export default function DefaultLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,_#fbfdff_0%,_#f4f7fb_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,_rgba(191,219,254,0.24),_transparent)]" />
      <div className="relative">
        <Outlet />
      </div>
    </div>
  );
}
