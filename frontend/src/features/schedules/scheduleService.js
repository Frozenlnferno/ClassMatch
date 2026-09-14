import { API_ROUTES } from "../../config/api.js";
import { getAccessToken } from "../../utils/authToken.js";

const API_BASE = API_ROUTES.schedules;

async function getToken() {
    return getAccessToken();
}

export async function getScheduleList() {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/list`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch schedules: ${res.status}`);
    return res.json();
}

export async function getScheduleClasses(term, year) {
    const token = await getToken();
    const params = new URLSearchParams({ term, year: String(year) });
    const res = await fetch(`${API_BASE}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch classes: ${res.status}`);
    return res.json();
}

export async function uploadScheduleIcs(file, options = {}) {
    const { onProgress, onStatusChange } = options;
    const token = await getToken();

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("ics", file);

        xhr.open("POST", API_BASE);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable && onProgress) {
                onProgress((event.loaded / event.total) * 100);
            }
            if (onStatusChange) {
                onStatusChange("uploading");
            }
        });

        xhr.addEventListener("load", () => {
            let payload = {};
            try {
                payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            } catch {
                payload = {};
            }

            if (xhr.status >= 200 && xhr.status < 300) {
                if (onStatusChange) {
                    onStatusChange("queued");
                }
                resolve(payload);
                return;
            }

            reject(new Error(payload.error || `Upload failed: ${xhr.status}`));
        });

        xhr.addEventListener("error", () => {
            reject(new Error("Upload failed. Please try again."));
        });

        xhr.send(formData);
    });
}

/**
 * Add schedule courses manually by CRN payload
 * @param {string} term - term (fall, spring, summer)
 * @param {string|number} year - schedule year
 * @param {Array<object>} courses - course identifiers for backend resolution
 * @returns {Promise<object>} API response payload
 */
export async function addScheduleCourses(term, year, courses) {
    const token = await getToken();
    const params = new URLSearchParams({ term, year: String(year) });
    const res = await fetch(`${API_BASE}/courses?${params}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ courses }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Add courses failed: ${res.status}`);
    }
    return res.json();
}

export async function getScheduleJob(jobId) {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch job: ${res.status}`);
    }
    return res.json();
}

export async function waitForScheduleJob(jobId, options = {}) {
    const { onStatusChange, intervalMs = 1500 } = options;

    while (true) {
        const job = await getScheduleJob(jobId);
        if (onStatusChange) {
            onStatusChange(job.status);
        }
        if (["completed", "failed", "canceled"].includes(job.status)) {
            return job;
        }
        await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
}

export async function deleteSchedule(term, year) {
    const token = await getToken();
    const params = new URLSearchParams({ term, year: String(year) });
    const res = await fetch(`${API_BASE}?${params}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Delete failed: ${res.status}`);
    }
    return res.json();
}

export async function deleteCourses(term, year, crns) {
    const token = await getToken();
    const params = new URLSearchParams({ term, year: String(year) });
    const res = await fetch(`${API_BASE}/courses?${params}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ crns }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Delete courses failed: ${res.status}`);
    }
    return res.json();
}
