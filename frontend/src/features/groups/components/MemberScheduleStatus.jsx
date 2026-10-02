import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarCheckIcon, CalendarIcon } from "../../../components/icons.jsx";
import { formatCompactScheduleLabel, formatScheduleLabel, getScheduleKey } from "../../../utils/classMatch.js";

export default function MemberScheduleStatus({ member, selectedSchedule }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const tooltipId = useId();
  const scheduleTerms = member.schedule_terms || [];

  if (!selectedSchedule) {
    const latestSchedule = scheduleTerms[0];
    return latestSchedule ? (
      <span
        className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
        aria-label={`${member.name}'s latest uploaded schedule is ${formatScheduleLabel(latestSchedule)}`}
      >
        {formatCompactScheduleLabel(latestSchedule)}
      </span>
    ) : (
      <span className="shrink-0 text-xs font-medium text-slate-400">No schedules yet</span>
    );
  }

  const hasSchedule = scheduleTerms.some(
    (schedule) => getScheduleKey(schedule) === getScheduleKey(selectedSchedule),
  );
  const termLabel = formatScheduleLabel(selectedSchedule);
  const statusLabel = hasSchedule
    ? `${member.name} has uploaded a schedule for ${termLabel}`
    : `${member.name} has not uploaded a schedule for ${termLabel}`;

  function showTooltip(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = window.innerWidth < 640 ? 176 : 224;
    const edgePadding = 8;
    const centerX = rect.left + rect.width / 2;
    setTooltipPosition({
      top: rect.top - 8,
      left: Math.min(
        Math.max(centerX, edgePadding + tooltipWidth / 2),
        window.innerWidth - edgePadding - tooltipWidth / 2,
      ),
    });
    setIsOpen(true);
  }

  function hideTooltip() {
    setIsOpen(false);
    setTooltipPosition(null);
  }

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={statusLabel}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          if (isOpen) {
            hideTooltip();
          } else {
            showTooltip(event);
          }
        }}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={[
          "inline-flex size-7 items-center justify-center rounded-full border transition focus:outline-none",
          hasSchedule
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-400 bg-slate-600 text-slate-50",
        ].join(" ")}
      >
        {hasSchedule ? <CalendarCheckIcon className="size-4" /> : <CalendarIcon className="size-4" />}
      </button>
      {isOpen && tooltipPosition
        ? createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-[9999] w-44 sm:w-56 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium leading-5 text-white shadow-2xl"
            style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          >
            {statusLabel}
          </span>,
          document.body,
        )
        : null}
    </span>
  );
}
