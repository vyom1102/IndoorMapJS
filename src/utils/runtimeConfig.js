const KNOWN_ENV_OVERRIDES = {
  dev: {
    baseUrl: import.meta.env.VITE_BASE_URL || "https://dev.iwayplus.in",
    apiKey: import.meta.env.VITE_API_KEY || "",
  },
  prod: {
    baseUrl: "https://maps.iwayplus.in",
    apiKey: "23a06030-e7c2-11f0-9e47-354845042064",
  },
};

const normalizeBaseUrl = (value) => {
  if (!value) return "";
  return String(value).replace(/\/+$/, "");
};

const getWindow = () => (typeof window !== "undefined" ? window : null);

const readUrlOverride = () => {
  const win = getWindow();
  if (!win?.location) return null;

  const candidates = [win.location.search, win.location.hash];
  for (const candidate of candidates) {
    if (!candidate) continue;

    const raw = candidate.startsWith("#") ? candidate.slice(1) : candidate;
    const query = raw.startsWith("?") ? raw.slice(1) : raw;
    const params = new URLSearchParams(query);

    const env = params.get("env") || params.get("mode") || params.get("__env");
    const baseUrl = params.get("baseUrl") || params.get("__baseUrl");
    const apiKey = params.get("apiKey") || params.get("__apiKey");

    if (env || baseUrl || apiKey) {
      return { env, baseUrl, apiKey };
    }
  }

  return null;
};

export const getRuntimeConfig = () => {
  const fallback = {
    baseUrl: normalizeBaseUrl(import.meta.env.VITE_BASE_URL || ""),
    apiKey: import.meta.env.VITE_API_KEY || "",
  };

  const override = readUrlOverride() || {};

  if (override.env && KNOWN_ENV_OVERRIDES[override.env]) {
    return {
      baseUrl: normalizeBaseUrl(KNOWN_ENV_OVERRIDES[override.env].baseUrl),
      apiKey: KNOWN_ENV_OVERRIDES[override.env].apiKey,
    };
  }

  return {
    baseUrl: normalizeBaseUrl(override.baseUrl || fallback.baseUrl),
    apiKey: override.apiKey || fallback.apiKey,
  };
};

export const setRuntimeConfigOverride = (override = {}) => {
  const win = getWindow();
  if (!win?.location || !win?.history) return;

  const nextUrl = new URL(win.location.href);
  const params = nextUrl.searchParams;

  if (override.env) {
    params.set("env", override.env);
  } else {
    params.delete("env");
  }

  if (override.baseUrl) {
    params.set("baseUrl", override.baseUrl);
  } else {
    params.delete("baseUrl");
  }

  if (override.apiKey) {
    params.set("apiKey", override.apiKey);
  } else {
    params.delete("apiKey");
  }

  nextUrl.search = params.toString() ? `?${params.toString()}` : "";
  win.history.replaceState({}, "", nextUrl.toString());
};

export const clearRuntimeConfigOverride = () => {
  const win = getWindow();
  if (!win?.location || !win?.history) return;

  const nextUrl = new URL(win.location.href);
  nextUrl.searchParams.delete("env");
  nextUrl.searchParams.delete("baseUrl");
  nextUrl.searchParams.delete("apiKey");
  nextUrl.search = nextUrl.searchParams.toString() ? `?${nextUrl.searchParams.toString()}` : "";
  win.history.replaceState({}, "", nextUrl.toString());
};
