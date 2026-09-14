function readEnv(name) {
  const value = import.meta.env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function requirePublicEnv(name) {
  return readEnv(name);
}

export function requirePublicUrlEnv(name) {
  const value = readEnv(name);

  return validatePublicUrlEnv(name, value);
}

export function readOptionalPublicUrlEnv(name) {
  const value = import.meta.env[name];
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return validatePublicUrlEnv(name, value.trim());
}

function validatePublicUrlEnv(name, value) {
  const normalizedValue = value.trim();

  try {
    const parsed = new URL(normalizedValue);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new Error(`Invalid URL environment variable: ${name}`);
  }

  return normalizedValue.replace(/\/$/, "");
}
