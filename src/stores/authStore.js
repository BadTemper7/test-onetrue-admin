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

export const useAuthStore = create((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: readStoredUser(),
  loading: false,
  initialized: false,
  error: "",

  saveSession: ({ token, user }) => {
    persistSession(token, user);
    set({ token, user, initialized: true, error: "" });
  },

  login: async ({ email, password, loginType }) => {
    set({ loading: true, error: "" });
    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
        loginType,
      });
      persistSession(data.token, data.user);
      set({
        token: data.token,
        user: data.user,
        loading: false,
        initialized: true,
      });
      return data;
    } catch (error) {
      const message = getApiError(error);
      set({ loading: false, error: message });
      throw error;
    }
  },

  refreshMe: async () => {
    const token = get().token || localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ initialized: true, loading: false, user: null });
      return null;
    }

    set({ loading: true });
    try {
      const { data } = await api.get("/auth/me");
      persistSession(token, data.user);
      set({
        token,
        user: data.user,
        loading: false,
        initialized: true,
        error: "",
      });
      return data.user;
    } catch {
      clearSessionStorage();
      set({
        token: "",
        user: null,
        loading: false,
        initialized: true,
      });
      return null;
    }
  },

  logout: () => {
    clearSessionStorage();
    set({ token: "", user: null, error: "", initialized: true });
  },

  clearError: () => set({ error: "" }),
}));

if (typeof window !== "undefined") {
  window.addEventListener("otli:unauthorized", () => {
    useAuthStore.getState().logout();
  });
}
