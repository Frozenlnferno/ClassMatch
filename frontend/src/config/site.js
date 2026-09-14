import { readOptionalPublicUrlEnv } from "./env.js";

const FRONTEND_ORIGIN = readOptionalPublicUrlEnv("VITE_FRONTEND_ORIGIN");

export function getPublicAppOrigin() {
  if (FRONTEND_ORIGIN) {
    return FRONTEND_ORIGIN;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  throw new Error("Unable to determine the public app origin");
}

export function buildPublicAppUrl(path = "/") {
  return new URL(path, `${getPublicAppOrigin()}/`).toString();
}
