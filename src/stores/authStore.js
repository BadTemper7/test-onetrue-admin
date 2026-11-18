import { create } from "zustand";
import { api, getApiError, TOKEN_KEY, USER_KEY } from "../lib/api";

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

const persistSession = (token, user) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearSessionStorage = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// A cached user allows an existing session's shell to render promptly.
// The backend still checks every protected request; /auth/me revalidates
// the cached session in the background and logs out a rejected token.
const storedToken = localStorage.getItem(TOKEN_KEY) || "";
const storedUser = storedToken ? readStoredUser() : null;

// React mounts/effects can ask for the same validation more than once.
// Only one /auth/me check should run per token at a time.
let refreshInFlight = null;

export const useAuthStore = create((set, get) => ({
  token: storedToken,
  user: storedUser,
  loading: false, // Login form submission only; never set by /auth/me
  refreshing: false,
  initialized: !storedToken || Boolean(storedUser),
  error: "",

  saveSession: ({ token, user }) => {
    persistSession(token, user);
    set({ token, user, initialized: true, loading: false, refreshing: false, error: "" });
  },

  login: async ({ email, password, loginType }) => {
    set({ loading: true, error: "" });
    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
        loginType,
      }, { timeout: 20000 }); // Fail visibly if the API is not reachable; never auto-retry logins.
      persistSession(data.token, data.user);
      set({
        token: data.token,
        user: data.user,
        loading: false,
        refreshing: false,
        initialized: true,
        error: "",
      });
      return data;
    } catch (error) {
      const message = getApiError(error);
      set({ loading: false, error: message });
      throw error;
    }
  },

  refreshMe: () => {
    const token = get().token || localStorage.getItem(TOKEN_KEY);
    if (!token) {
      // Bootstrapping a public page must not interfere with a login request.
      if (!get().loading) set({ initialized: true, refreshing: false, user: null });
      return Promise.resolve(null);
    }

    if (refreshInFlight?.token === token) return refreshInFlight.promise;

    set({ refreshing: true });
    // /auth/me is a background check, not a reason to block login for 60s.
    const task = (async () => {
      try {
        const { data } = await api.get("/auth/me", { timeout: 15000 });
        // A late response from an older login cannot overwrite a new session.
        if (get().token !== token || localStorage.getItem(TOKEN_KEY) !== token) {
          return get().user;
        }
        persistSession(token, data.user);
        set({ token, user: data.user, initialized: true, error: "" });
        return data.user;
      } catch (error) {
        if (get().token !== token || localStorage.getItem(TOKEN_KEY) !== token) {
          return get().user;
        }
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          clearSessionStorage();
          set({ token: "", user: null, initialized: true });
          return null;
        }

        // A timeout, 503 or temporary network error is NOT a logout.
        // Cached profile data is for UI only; API permissions remain server-side.
        const cachedUser = get().user || readStoredUser();
        set({
          token,
          user: cachedUser,
          initialized: true,
          error: getApiError(error),
        });
        return cachedUser;
      } finally {
        if (refreshInFlight?.promise === task) {
          refreshInFlight = null;
          set({ refreshing: false });
        }
      }
    })();

    refreshInFlight = { token, promise: task };
    return task;
  },

  logout: () => {
    clearSessionStorage();
    set({ token: "", user: null, loading: false, refreshing: false, error: "", initialized: true });
  },

  clearError: () => set({ error: "" }),
}));

if (typeof window !== "undefined") {
  window.addEventListener("otli:unauthorized", () => {
    useAuthStore.getState().logout();
  });
}
