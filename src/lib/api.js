import axios from "axios";

const browserHostname =
  typeof window !== "undefined" ? window.location.hostname : "localhost";
const isLocalhost = ["localhost", "127.0.0.1"].includes(browserHostname);

const defaultServerUrl = isLocalhost
  ? "http://localhost:5000"
  : "https://api.onetrue.ph";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const API_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL || `${defaultServerUrl}/api`,
);
export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_URL || defaultServerUrl,
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

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
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
  if (config?.signal) return axiosGet(url, config);

  const requestKey = `${url}::${stableParamsKey(config?.params)}`;
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
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new CustomEvent("otli:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export const getApiError = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong. Please try again.";
