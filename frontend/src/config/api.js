import { readOptionalPublicUrlEnv } from "./env.js";

// In production, an empty origin sends requests through the frontend's Nginx
// reverse proxy. VITE_API_BASE_URL remains available for unusual deployments.
const API_ORIGIN = readOptionalPublicUrlEnv("VITE_API_BASE_URL");

export const API_ROUTES = {
    groups: `${API_ORIGIN}/api/groups`,
    schedules: `${API_ORIGIN}/api/schedules`,
    users: `${API_ORIGIN}/api/users`,
};
