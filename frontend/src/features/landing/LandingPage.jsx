import { Link } from "react-router-dom";
import { ArrowRightIcon, CalendarIcon, UsersIcon } from "../../components/icons.jsx";
import { Badge, Card, buttonStyles } from "../../components/ui.jsx";

const steps = [
  {
    title: "Upload your schedule",
    description: "Bring in an ICS calendar file or add classes by CRN so ClassMatch knows what courses matter to you.",
    icon: CalendarIcon,
  },
  {
    title: "Join or create a group",
    description: "Start a group for your friends, project team, or class community and share a simple invite link.",
    icon: UsersIcon,
  },
  {
    title: "Get connected",
    description: "See which classmates overlap with your courses right now and who has taken them before.",
    icon: ArrowRightIcon,
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="motion-fade-in flex items-center justify-between gap-4 py-2">
        <Link to="/" className="motion-soft flex items-center gap-3">
          <img src="/Classmatch-Icon.png" alt="ClassMatch" className="size-11 rounded-2xl object-contain" />
          <div>
            <div className="text-base font-semibold tracking-tight text-slate-900">ClassMatch</div>
            <div className="text-xs text-slate-500">Match schedules. Make connections.</div>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          <Link to="/login" className={buttonStyles({ variant: "ghost", size: "md" })}>
            Log in
          </Link>
          <Link to="/signup" className={buttonStyles({ variant: "primary", size: "md" })}>
            Sign up
          </Link>
        </nav>
      </header>

      <main className="space-y-8 py-8 sm:space-y-10 sm:py-12">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Card className="motion-fade-up overflow-hidden bg-[linear-gradient(145deg,_rgba(255,255,255,0.94)_0%,_rgba(239,246,255,0.92)_100%)] p-8 sm:p-10">
            <div className="max-w-2xl space-y-6">
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  ClassMatch helps UIUC students find classmates in the courses they already share.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                  Upload your UIUC schedule, join a group, and instantly see which classmates overlap with your classes now or have taken them before.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/signup" className={buttonStyles({ variant: "primary", size: "lg" })}>
                  Get Started
                  <ArrowRightIcon className="size-4" />
                </Link>
                <Link to="/login" className={buttonStyles({ variant: "secondary", size: "lg" })}>
                  Log in
                </Link>
              </div>
            </div>
          </Card>

          <Card className="motion-fade-up motion-delay-1 relative overflow-hidden p-0">
            <div className="absolute inset-x-6 top-6 h-32 rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.24),_transparent_58%)]" />
            <div className="relative space-y-4 p-6 sm:p-8">
              <div className="rounded-[28px] border border-blue-100 bg-blue-50/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">At a glance</div>
                <div className="mt-3 text-2xl font-semibold text-slate-900">A ClassMatch workspace built around UIUC schedules, groups, and student profiles.</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-slate-900">Shared classes</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">See who is taking your class this term before the semester gets hectic.</div>
                </div>
                <div className="rounded-[24px] bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-slate-900">Invite-ready groups</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">Create a group once, then copy one clean link for everyone else.</div>
                </div>
                <div className="rounded-[24px] bg-slate-50 p-5 sm:col-span-2">
                  <div className="text-sm font-semibold text-slate-900">Course context without the noise</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    A light, focused interface keeps schedules, classmates, and profile details easy to manage on desktop and mobile.
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="motion-fade-up motion-delay-2 rounded-[32px] border border-white/80 bg-white/90 px-6 py-8 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.18)] sm:px-8 sm:py-10">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">How it works</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Three simple steps to get connected</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Start with your schedule, then let ClassMatch surface the classmates and groups that matter.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <Card key={step.title} className="motion-lift h-full rounded-[28px] bg-slate-50/70 p-6 shadow-none">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                        <Icon className="size-5" />
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Step {index + 1}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="motion-fade-in border-t border-white/80 py-6 text-sm text-slate-500">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>ClassMatch keeps UIUC students aligned around shared classes and groups.</div>
          <div className="flex items-center gap-5">
            <span>About</span>
            <span>Privacy</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
