export function normalizeName(raw) {
  if (!raw) return "";

  let clean = raw.trim();
  clean = clean.replace(/\s+/g, " ");
  clean = clean
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return clean;
}

export function normalizeEmail(raw) {
  return raw.trim().toLowerCase();
}
