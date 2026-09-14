/* eslint-disable react-refresh/only-export-components */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons.jsx";
import { getInitials } from "../utils/classMatch.js";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function buttonStyles({ variant = "primary", size = "md", className = "" } = {}) {
  const variantStyles = {
    primary: "bg-blue-600 !text-white shadow-[0_18px_34px_-20px_rgba(37,99,235,0.9)] hover:bg-blue-500 hover:!text-white",
    secondary: "bg-white text-slate-800 border border-slate-200 shadow-sm hover:border-blue-200 hover:bg-blue-50/60",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-rose-600 !text-white shadow-[0_18px_34px_-20px_rgba(225,29,72,0.9)] hover:bg-rose-500 hover:!text-white",
  };
  const sizeStyles = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
  };

  return cn(
    "motion-lift inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 ease-out active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

export function Button({ className, variant, size, type = "button", ...props }) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "motion-soft rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.18)] backdrop-blur",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Field({ label, hint, error, children, className = "" }) {
  return (
    <label className={cn("block space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </label>
  );
}

const fieldBaseClass =
  "motion-soft w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 shadow-inner shadow-white transition-[background-color,border-color,box-shadow,color,transform] duration-200 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100";

export function Input({ className, ...props }) {
  return <input className={cn(fieldBaseClass, className)} {...props} />;
}

export function TextArea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cn(fieldBaseClass, "resize-none", className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(fieldBaseClass, "appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Banner({ title, children, tone = "info" }) {
  const tones = {
    info: "border-blue-100 bg-blue-50 text-blue-900",
    danger: "border-rose-100 bg-rose-50 text-rose-900",
    success: "border-emerald-100 bg-emerald-50 text-emerald-900",
    warning: "border-amber-100 bg-amber-50 text-amber-900",
  };

  return (
    <div className={cn("motion-fade-in rounded-2xl border px-4 py-3", tones[tone])}>
      {title ? <div className="text-sm font-semibold">{title}</div> : null}
      {children ? <div className="mt-1 text-sm">{children}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return <span className={cn("motion-soft inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="motion-fade-up mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">{eyebrow}</div> : null}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          {description ? <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action, className = "" }) {
  return (
    <Card className={cn("motion-fade-up border-dashed border-slate-200 text-center", className)}>
      <div className="mx-auto max-w-md space-y-3">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </Card>
  );
}

export function LoadingState({ title = "Loading", description = "Pulling in the latest details for you.", compact = false }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 text-center", compact ? "py-3" : "rounded-[28px] border border-white/80 bg-white/90 px-6 py-10 shadow-sm")}>
      <div className="size-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
      <div className="space-y-1">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {!compact ? <div className="text-sm text-slate-500">{description}</div> : null}
      </div>
    </div>
  );
}

export function Avatar({ src, name, size = "md", className = "" }) {
  const sizes = {
    xs: "size-8 text-xs",
    sm: "size-10 text-sm",
    md: "size-12 text-base",
    lg: "size-16 text-lg",
    xl: "size-20 text-xl",
  };

  if (src) {
    return <img src={src} alt={name} className={cn("motion-soft rounded-2xl object-cover", sizes[size], className)} />;
  }

  return (
    <div className={cn("motion-soft flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 font-semibold text-white", sizes[size], className)}>
      {getInitials(name)}
    </div>
  );
}

export function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function ProgressBar({ value = 0, label }) {
  return (
    <div className="space-y-2">
      {label ? <div className="flex items-center justify-between text-xs font-medium text-slate-500"><span>{label}</span><span>{Math.round(value)}%</span></div> : null}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="motion-soft h-full rounded-full bg-blue-600 transition-[width,transform,background-color] duration-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, onLabel = "Open", offLabel = "Closed" }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "motion-soft inline-flex items-center gap-3 rounded-full border px-2 py-2 text-sm font-medium",
        checked ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      <span
        className={cn(
          "motion-soft flex h-7 w-12 items-center rounded-full px-1",
          checked ? "bg-blue-600 justify-end" : "bg-slate-300 justify-start",
        )}
      >
        <span className="motion-soft size-5 rounded-full bg-white shadow-sm" />
      </span>
      <span>{checked ? onLabel : offLabel}</span>
    </button>
  );
}

export function Modal({ isOpen, onClose, title, description, children, actions, size = "md" }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass = size === "lg" ? "max-w-4xl" : size === "sm" ? "max-w-lg" : "max-w-2xl";

  return createPortal(
    <div className="motion-fade-in fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "motion-scale-in relative z-10 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[32px] border border-white/90 bg-white shadow-[0_40px_90px_-40px_rgba(15,23,42,0.45)]",
          widthClass,
        )}
      >
        <div className="flex flex-none items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
            {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="motion-lift inline-flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-[transform,background-color,color,box-shadow] duration-200 hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {actions ? (
          <div className="flex flex-none flex-wrap justify-end gap-3 border-t border-slate-100 bg-white/95 px-6 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {actions}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
