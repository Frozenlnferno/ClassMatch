/* eslint-disable react-refresh/only-export-components */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, CloseIcon } from "./icons.jsx";
import { getInitials } from "../utils/classMatch.js";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getAvatarGradient(name = "") {
  const hash = Array.from(String(name)).reduce((value, character) => (
    ((value << 5) - value + character.charCodeAt(0)) | 0
  ), 0);
  const palettes = [
    ["#f87171", "#dc2626"],
    ["#fb923c", "#ea580c"],
    ["#facc15", "#ca8a04"],
    ["#4ade80", "#16a34a"],
    ["#60a5fa", "#2563eb"],
    ["#818cf8", "#4f46e5"],
    ["#c084fc", "#9333ea"],
  ];
  const [start, end] = palettes[Math.abs(hash) % palettes.length];

  return `linear-gradient(135deg, ${start}, ${end})`;
}

export function buttonStyles({ variant = "primary", size = "md", className = "" } = {}) {
  const variantStyles = {
    primary: "bg-[var(--color-primary)] !text-white shadow-[0_18px_34px_-20px_var(--color-shadow)] hover:bg-[var(--color-primary-hover)] hover:!text-white",
    secondary: "bg-white text-[var(--color-text-card)] border border-[var(--color-border)] shadow-sm hover:border-[var(--color-focus)] hover:bg-cyan-50/60",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-[var(--color-error)] !text-white shadow-[0_18px_34px_-20px_var(--color-shadow)] hover:bg-rose-500 hover:!text-white",
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
        "motion-soft rounded-[28px] border border-[var(--color-border)] bg-white/90 p-6 shadow-[0_22px_60px_-30px_var(--color-shadow)] backdrop-blur",
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
  "w-full rounded-2xl border border-[var(--color-border)] bg-slate-50/80 px-4 py-3 text-sm text-[var(--color-text-card)] outline-none placeholder:text-slate-400 transition-colors duration-150 focus:border-[var(--color-focus)]";

export function Input({ className, ...props }) {
  return <input className={cn(fieldBaseClass, className)} {...props} />;
}

export function TextArea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cn(fieldBaseClass, "resize-none", className)} {...props} />;
}

export function DropdownSelector({
  label,
  value,
  options,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listboxId = `dropdown-${useId().replace(/:/g, "")}`;
  const selectedOption = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(option) {
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={label}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-4 border bg-white px-4 py-3 text-left transition-[border-color,border-radius,background-color,box-shadow] duration-200 outline-none focus:border-[var(--color-focus)] focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60",
          isOpen
            ? "rounded-t-2xl border-[var(--color-primary)] border-b-[var(--color-border)] shadow-sm"
            : "rounded-2xl border-[var(--color-border)] hover:border-cyan-300",
        )}
      >
        <span className="min-w-0">
          <span className={cn("block truncate text-sm font-semibold", selectedOption ? "text-[var(--color-text-card)]" : "text-slate-400")}>
            {selectedOption?.label || placeholder}
          </span>
          {selectedOption?.description ? <span className="mt-1 block truncate text-xs text-slate-500">{selectedOption.description}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {selectedOption?.meta ? <span className="text-xs font-semibold text-[var(--color-primary)]">{selectedOption.meta}</span> : null}
          <ChevronDownIcon className={cn("size-4 text-slate-500 transition-transform duration-200", isOpen && "rotate-180")} />
        </span>
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="modal-scrollbar absolute z-30 max-h-80 w-full overflow-y-auto rounded-b-2xl border border-t-0 border-[var(--color-primary)] bg-white py-1 shadow-[0_22px_40px_-24px_var(--color-shadow)]"
        >
          {options.map((option, index) => {
            const isSelected = String(option.value) === String(value);
            const startsGroup = option.group && option.group !== options[index - 1]?.group;

            return (
              <div key={String(option.value)}>
                {startsGroup ? (
                  <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {option.group}
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "dropdown-selector-option flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors duration-150 focus:outline-none",
                    isSelected ? "bg-indigo-50 text-[var(--color-primary)]" : "text-slate-700 hover:!bg-[var(--color-surface-secondary)] hover:!text-white",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{option.label}</span>
                    {option.description ? <span className="mt-1 block truncate text-xs text-slate-500">{option.description}</span> : null}
                  </span>
                  {option.meta ? <span className="shrink-0 text-xs font-semibold text-[var(--color-primary)]">{option.meta}</span> : null}
                </button>
                {index < options.length - 1 ? <div className="mx-4 h-px bg-slate-200/80" aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Banner({ title, children, tone = "info" }) {
  const tones = {
    info: "border-indigo-100 bg-indigo-50 text-indigo-900",
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
    neutral: "border border-[var(--color-border-strong)] bg-[var(--color-surface-secondary)] text-[var(--color-text-card)]",
    blue: "border border-[var(--color-border-strong)] bg-[var(--color-surface-secondary)] text-[var(--color-primary)]",
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
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">{eyebrow}</div> : null}
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
      <div className="size-9 animate-spin rounded-full border-4 border-indigo-100 border-t-[var(--color-primary)]" />
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
    return <img src={src} alt={name} className={cn("motion-soft rounded-full object-cover", sizes[size], className)} />;
  }

  return (
    <div
      className={cn("motion-soft flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/20", sizes[size], className)}
      style={{ background: getAvatarGradient(name) }}
    >
      {getInitials(name)}
    </div>
  );
}

export function AvatarStack({ people = [], max = 4, size = "sm", label = "People" }) {
  const visiblePeople = people.slice(0, max);
  const remainingCount = Math.max(0, people.length - visiblePeople.length);

  if (!people.length) return <span className="text-sm text-slate-500">No matches yet</span>;

  return (
    <div className="flex items-center pl-2" aria-label={`${people.length} ${label.toLowerCase()}`}>
      {visiblePeople.map((person, index) => (
        <Avatar
          key={person.member_id || person.user_id || `${person.member_name || person.name}-${index}`}
          src={person.avatar_url || person.member_avatar_url}
          name={person.member_name || person.name}
          size={size}
          className={cn("!ring-2 !ring-[var(--color-avatar-separator)]", index > 0 ? "-ml-2" : "")}
        />
      ))}
      {remainingCount ? (
        <span className="-ml-2 flex size-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white ring-2 ring-[var(--color-avatar-separator)]">
          +{remainingCount}
        </span>
      ) : null}
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
        <div className="motion-soft h-full rounded-full bg-[var(--color-primary)] transition-[width,transform,background-color] duration-300" style={{ width: `${value}%` }} />
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
        checked
          ? "border-[var(--color-primary)] bg-indigo-50 text-indigo-700"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface-secondary)] text-[var(--color-text-card)]",
      )}
    >
      <span
        className={cn(
          "motion-soft flex h-7 w-12 items-center rounded-full px-1",
          checked ? "bg-[var(--color-primary)] justify-end" : "bg-[var(--color-text-subdued)] justify-start",
        )}
      >
        <span className="motion-soft size-5 rounded-full !bg-[var(--color-text-default)] shadow-sm" />
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
    <div className="motion-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[var(--color-overlay)] p-4 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "motion-scale-in relative z-10 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[32px] border border-[var(--color-border-strong)] !bg-[var(--color-surface-level-1)] shadow-[0_40px_90px_-40px_var(--color-shadow)]",
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
        <div className="modal-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
