export function getUserErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const message = error instanceof Error ? error.message : "";
  const status = Number(error?.status) || Number(message.match(/\b([45]\d{2})\b/)?.[1]);
  const normalized = message.toLowerCase();

  if (/passwords? do not match/.test(normalized)) {
    return "Passwords don't match. Please enter them again.";
  }

  if (status === 413 || /payload too large|request entity too large|file.*too large/.test(normalized)) {
    return "That file is too large to upload. Choose a smaller file and try again.";
  }

  if (status === 401) {
    return "Your session has ended. Please sign in again and try once more.";
  }

  if (status === 403) {
    return "You don't have permission to do that.";
  }

  if (status === 404) {
    return "We couldn't find what you were looking for. It may no longer be available.";
  }

  if (status === 409) {
    return "This has changed already. Refresh the page and try again.";
  }

  if (status === 422 || status === 400) {
    return "Please check the information you entered and try again.";
  }

  if (status === 429) {
    return "You've made too many attempts. Please wait a moment and try again.";
  }

  if (
    error instanceof TypeError ||
    /network error|failed to fetch$|load failed|network request failed/.test(normalized)
  ) {
    return "We couldn't connect to ClassMatch. Check your connection and try again.";
  }

  return fallback;
}
