import axios from "axios";

const browserHostname =
  typeof window !== "undefined" ? window.location.hostname : "localhost";
const isLocalhost = ["localhost", "127.0.0.1"].includes(browserHostname);

const defaultServerUrl = isLocalhost
  ? "http://localhost:3000"
  : "https://api.onetrue.ph";

const trimTrailingSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

// Both apps use the same Express /api prefix. Also accept an API hostname
// supplied without /api, a common cause of 404s in hosting build settings.
const normalizeApiUrl = (value) => {
  const base = trimTrailingSlash(value);
  try {
    const url = new URL(base);
    if (url.pathname === "/" || url.pathname === "") return `${url.origin}/api`;
  } catch {
    // Relative/proxied bases are preserved as configured.
  }
  return base;
};

export const API_URL = normalizeApiUrl(
  import.meta.env.VITE_API_URL || `${defaultServerUrl}/api`,
);
// Derive the realtime hostname from the effective API URL so changing one
// deployment target does not silently send Socket.IO to the old backend.
export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_URL || new URL(API_URL, `${defaultServerUrl}/`).origin,
);

export const resolveFileUrl = (value) => {
  const fileUrl = String(value || "").trim();
  if (!fileUrl) return "";

  if (/^(https?:)?\/\//i.test(fileUrl) || fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")) {
    return fileUrl;
  }

  return `${SOCKET_URL}/${fileUrl.replace(/^\/+/, "")}`;
};

export const TOKEN_KEY = "otli_token";
export const USER_KEY = "otli_user";

// Most API requests are bounded to 60s. File uploads can need more time.
// An extended browser timeout does not override the hosting proxy timeout.
export const API_TIMEOUT_MS = 60000;
export const UPLOAD_TIMEOUT_MS = 120000;

export const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  // Preserve explicit per-request timeouts, including short polling deadlines.
  // Longer upload requests are not retried automatically: the server may have
  // saved data even if the browser disconnects before it sees the response.
  if (
    typeof FormData !== "undefined" &&
    config.data instanceof FormData &&
    config.timeout === API_TIMEOUT_MS
  ) {
    config.timeout = UPLOAD_TIMEOUT_MS;
  }

  // The public login request must not carry a stale session token.
  const isLoginRequest = /(?:^|\/)auth\/login(?:$|[?#])/.test(String(config.url || ""));
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !isLoginRequest) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


// Coalesce identical GET requests that are already in flight. This prevents
// duplicate network calls when multiple effects/components request the same
// table metadata at the same time. Requests with an AbortSignal are left
// untouched because sharing them could let one consumer cancel another.
const inFlightGetRequests = new Map();
const axiosGet = api.get.bind(api);

const stableParamsKey = (params) => {
  if (!params) return "";
  if (params instanceof URLSearchParams) return params.toString();
  if (typeof params !== "object") return String(params);
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key] ?? "")}`)
    .join("&");
};

api.get = (url, config = {}) => {
  // Do not merge requests with different cancellation, timeouts or headers.
  // Each authenticated session has its own in-flight request group.
  if (
    config?.signal || config?.cancelToken || config?.headers ||
    config?.timeout != null || config?.responseType ||
    config?.withCredentials != null || config?.baseURL ||
    config?.paramsSerializer || config?.onDownloadProgress
  ) {
    return axiosGet(url, config);
  }

  const token = localStorage.getItem(TOKEN_KEY) || "";
  const requestKey = `${token}::${url}::${stableParamsKey(config?.params)}`;
  const existing = inFlightGetRequests.get(requestKey);
  if (existing) return existing;

  const request = axiosGet(url, config).finally(() => {
    if (inFlightGetRequests.get(requestKey) === request) {
      inFlightGetRequests.delete(requestKey);
    }
  });
  inFlightGetRequests.set(requestKey, request);
  return request;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // /auth/me manages its own 401 in authStore, where the originally checked
    // token is compared to the current session. This prevents an old bootstrap
    // response from interrupting a login already in progress.
    const isBootstrapRequest = /(?:^|\/)auth\/me(?:$|[?#])/.test(String(error?.config?.url || ""));
    if (error?.response?.status === 401 && !isBootstrapRequest) {
      // Only the token actually rejected by the server may be invalidated.
      // A previous /auth/me response must never sign out a NEW login.
      const sentAuthorization = String(error?.config?.headers?.Authorization || "");
      const rejectedToken = sentAuthorization.startsWith("Bearer ")
        ? sentAuthorization.slice(7)
        : "";
      const activeToken = localStorage.getItem(TOKEN_KEY);
      if (rejectedToken && activeToken && rejectedToken === activeToken) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.dispatchEvent(new CustomEvent("otli:unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);

export const getApiError = (error) => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (
    error?.code === "ECONNABORTED" ||
    error?.code === "ETIMEDOUT" ||
    /timeout of \d+ms exceeded/i.test(error?.message || "")
  ) {
    return "The request timed out. The server may still have processed it. Check the result before submitting again.";
  }
  if (!error?.response && (error?.code === "ERR_NETWORK" || error?.message === "Network Error")) {
    return "Cannot reach the server right now. Check your connection or try again shortly.";
  }
  return error?.message || "Something went wrong. Please try again.";
};
