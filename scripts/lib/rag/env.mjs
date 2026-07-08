export function readEnv(env, key, fallback = "") {
  if (env && env[key] != null) return env[key];

  if (
    typeof process !== "undefined" &&
    process.env &&
    process.env[key] != null
  ) {
    return process.env[key];
  }

  return fallback;
}

export function readBooleanEnv(env, key, fallback = false) {
  const value = readEnv(env, key, fallback ? "true" : "false");
  return String(value).toLowerCase() === "true";
}

export function readNumberEnv(env, key, fallback) {
  const value = Number(readEnv(env, key, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}
