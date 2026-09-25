import { DropdownSelector } from "../../../components/ui.jsx";
import { formatScheduleLabel, getScheduleKey, groupSchedulesByYear } from "../../../utils/classMatch.js";

export default function SchedulePicker({ schedules, selectedKey, onChange }) {
  const groups = groupSchedulesByYear(schedules);
  const options = groups.flatMap((group) => group.items.map((schedule) => ({
    value: getScheduleKey(schedule),
    label: formatScheduleLabel(schedule),
    meta: `${schedule.class_count} classes`,
    group: group.year,
  })));

  return (
    <section aria-label="Choose a schedule" className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-800">Choose a schedule</div>
        <div className="mt-1 text-sm text-slate-500">Select the term whose classes you want to manage.</div>
      </div>
      <DropdownSelector
        label="Choose a schedule"
        value={selectedKey}
        options={options}
        onChange={onChange}
        placeholder="Choose a schedule"
      />
    </section>
  );
}
