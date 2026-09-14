import { Field, Select } from "../../../components/ui.jsx";
import { formatScheduleLabel, getScheduleKey, groupSchedulesByYear } from "../../../utils/classMatch.js";

export default function SchedulePicker({ schedules, selectedKey, onChange }) {
  const groups = groupSchedulesByYear(schedules);

  return (
    <Field label="Schedule">
      <Select value={selectedKey} onChange={(event) => onChange(event.target.value)}>
        {groups.map((group) => (
          <optgroup key={group.year} label={String(group.year)}>
            {group.items.map((schedule) => (
              <option key={getScheduleKey(schedule)} value={getScheduleKey(schedule)}>
                {formatScheduleLabel(schedule)} - {schedule.class_count} classes
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </Field>
  );
}
