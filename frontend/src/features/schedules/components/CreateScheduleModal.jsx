import { useEffect, useRef, useState } from "react";
import {
  Banner,
  Button,
  Card,
  DropdownSelector,
  Field,
  Input,
  Modal,
  ProgressBar,
} from "../../../components/ui.jsx";
import { PlusIcon } from "../../../components/icons.jsx";
import {
  TERM_OPTIONS,
  formatScheduleLabel,
  getYearOptions,
} from "../../../utils/classMatch.js";
import { getUserErrorMessage } from "../../../utils/errorMessage.js";

function createCourseRow() {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    subject: "",
    course: "",
    crn: "",
  };
}

export default function CreateScheduleModal({
  isOpen,
  onClose,
  onIcsSubmit,
  onCrnSubmit,
  fixedSchedule,
  isSubmitting,
  uploadProgress,
  uploadPhase,
}) {
  const [method, setMethod] = useState(fixedSchedule ? "crn" : "ics");
  const [selectedFile, setSelectedFile] = useState(null);
  const [form, setForm] = useState({
    year: fixedSchedule?.year || getYearOptions()[0],
    term: fixedSchedule?.term || "fall",
    courses: [createCourseRow()],
  });
  const [error, setError] = useState("");
  const errorRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setMethod(fixedSchedule ? "crn" : "ics");
    setSelectedFile(null);
    setForm({
      year: fixedSchedule?.year || getYearOptions()[0],
      term: fixedSchedule?.term || "fall",
      courses: [createCourseRow()],
    });
    setError("");
  }, [fixedSchedule, isOpen]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [error]);

  function updateCourse(index, field, value) {
    setForm((current) => ({
      ...current,
      courses: current.courses.map((course, courseIndex) =>
        courseIndex === index ? { ...course, [field]: value } : course,
      ),
    }));
  }

  function addRow() {
    setForm((current) => ({
      ...current,
      courses: [...current.courses, createCourseRow()],
    }));
  }

  function removeRow(index) {
    setForm((current) => ({
      ...current,
      courses: current.courses.filter((_, courseIndex) => courseIndex !== index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (method === "ics") {
      if (!selectedFile) {
        setError("Choose an ICS file before uploading.");
        return;
      }
      try {
        await onIcsSubmit(selectedFile);
      } catch (submitError) {
        setError(getUserErrorMessage(submitError, "We couldn't upload your schedule. Please try again."));
      }
      return;
    }

    const normalizedCourses = form.courses
      .map((course) => ({
        subject: course.subject.trim().toUpperCase(),
        course: course.course.trim(),
        crn: course.crn.trim(),
      }))
      .filter((course) => course.subject || course.course || course.crn);

    if (!normalizedCourses.length) {
      setError("Add at least one class before submitting.");
      return;
    }

    if (normalizedCourses.some((course) => !course.subject || !course.course || course.crn.length !== 5)) {
      setError("Each class needs a subject, course number, and 5-digit CRN.");
      return;
    }

    try {
      await onCrnSubmit({
        year: Number(form.year),
        term: form.term,
        courses: normalizedCourses,
      });
    } catch (submitError) {
      setError(getUserErrorMessage(submitError, "We couldn't add those classes. Please try again."));
    }
  }

  const phaseLabel = {
    idle: "Ready for upload",
    uploading: "Uploading ICS",
    queued: "Queued for processing",
    processing: "Processing schedule import",
    complete: "Finished",
    completed: "Finished",
    failed: "Import failed",
    canceled: "Import canceled",
  }[uploadPhase] || "Working";
  const phaseToneLabel = uploadPhase === "queued"
    ? "Queued"
    : uploadPhase === "processing"
      ? "Processing"
      : uploadPhase === "completed" || uploadPhase === "complete"
        ? "Done"
        : uploadPhase === "failed"
          ? "Failed"
          : uploadPhase === "canceled"
            ? "Canceled"
            : "In progress";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={fixedSchedule ? `Add classes to ${formatScheduleLabel(fixedSchedule)}` : "Add a new schedule"}
      description={fixedSchedule ? "Use CRN entry to append classes to your existing schedule." : "Choose the fastest way to bring a schedule into ClassMatch."}
      actions={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="schedule-modal-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : method === "ics" ? "Upload schedule" : "Save classes"}
          </Button>
        </>
      )}
    >
      <form id="schedule-modal-form" className="space-y-5" onSubmit={handleSubmit}>
        {!fixedSchedule ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMethod("ics")}
              className={[
                "motion-lift rounded-[24px] border p-5 text-left transition-[transform,border-color,background-color,box-shadow] duration-200",
                method === "ics" ? "border-indigo-300 bg-indigo-50" : "border-[var(--color-border)] bg-slate-50 hover:border-cyan-300",
              ].join(" ")}
            >
              <div className="text-sm font-semibold text-slate-900">ICS upload</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                Best when you already have an exported calendar file ready from your school portal.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMethod("crn")}
              className={[
                "motion-lift rounded-[24px] border p-5 text-left transition-[transform,border-color,background-color,box-shadow] duration-200",
                method === "crn" ? "border-indigo-300 bg-indigo-50" : "border-[var(--color-border)] bg-slate-50 hover:border-cyan-300",
              ].join(" ")}
            >
              <div className="text-sm font-semibold text-slate-900">CRN entry</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                Build the schedule manually by year, term, subject, course number, and CRN.
              </div>
            </button>
          </div>
        ) : null}

        {error ? (
          <div ref={errorRef} tabIndex={-1}>
            <Banner title="Schedule issue" tone="danger">
              {error}
            </Banner>
          </div>
        ) : null}

        {method === "ics" ? (
          <div className="space-y-5">
            <Card className="rounded-[28px] bg-slate-50/80 p-5 shadow-none">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">How to get your schedule ICS</div>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  <li>Login to your UIUC Self Service account.</li>
                  <li>Go to Class Registration under Student Services.</li>
                  <li>Click View Class Schedules.</li>
                  <li>Select the term you want (e.g., Fall 2026).</li>
                  <li>Click the MAIL CALENDAR ICON next to the printer icon.</li>
                  <li>Send the calendar to your email. It might take a minute to send. </li>
                  <li>Open the email and download the attached file. No need to open it.</li>
                  <li>Upload the .ics file below.</li>
                </ol>
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  Note: Classes without a location, such as remote classes, may not be included in the import. Enter those classes manually using their CRNs.
                </p>
              </div>
            </Card>

            <Field label="Schedule ICS">
              <input
                type="file"
                accept=".ics,text/calendar"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--color-primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
            </Field>

          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-5 rounded-[24px] border border-[var(--color-border)] bg-slate-50/70 p-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Academic term</div>
                <div className="mt-1 text-sm text-slate-500">Choose when these classes are offered.</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Year</div>
                  <DropdownSelector
                    label="Academic year"
                    value={form.year}
                    options={getYearOptions().map((year) => ({ value: year, label: String(year) }))}
                    onChange={(year) => setForm((current) => ({ ...current, year: Number(year) }))}
                    disabled={Boolean(fixedSchedule)}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Term</div>
                  <DropdownSelector
                    label="Academic term"
                    value={form.term}
                    options={TERM_OPTIONS.map((term) => ({ value: term.value, label: term.label }))}
                    onChange={(term) => setForm((current) => ({ ...current, term }))}
                    disabled={Boolean(fixedSchedule)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {form.courses.map((course, index) => (
                <Card key={course.id} className="rounded-[28px] bg-slate-50/80 p-5 shadow-none">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Class {index + 1}</div>
                      <div className="text-xs text-slate-500">Use the exact subject and CRN from your course catalog.</div>
                    </div>
                    {form.courses.length > 1 ? (
                      <button type="button" onClick={() => removeRow(index)} className="text-sm font-medium text-rose-600">
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Field label="Subject">
                      <Input value={course.subject} onChange={(event) => updateCourse(index, "subject", event.target.value)} placeholder="CS" />
                    </Field>
                    <Field label="Course number">
                      <Input value={course.course} onChange={(event) => updateCourse(index, "course", event.target.value)} placeholder="101" />
                    </Field>
                    <Field label="CRN">
                      <Input value={course.crn} onChange={(event) => updateCourse(index, "crn", event.target.value)} placeholder="12345" />
                    </Field>
                  </div>
                </Card>
              ))}
            </div>

            <Button variant="secondary" onClick={addRow}>
              <PlusIcon className="size-4" />
              Add another class
            </Button>
          </div>
        )}

        {(uploadProgress > 0 || uploadPhase !== "idle") ? (
          <Card className="rounded-[28px] bg-slate-50/80 p-5 shadow-none">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">{phaseLabel}</div>
                <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {phaseToneLabel}
                </span>
              </div>
              <ProgressBar
                value={uploadPhase === "uploading" ? uploadProgress : 100}
                label={method === "ics" ? "Upload progress" : "Import progress"}
              />
            </div>
          </Card>
        ) : null}
      </form>
    </Modal>
  );
}
