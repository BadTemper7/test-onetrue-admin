"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, "src", name), "utf8");

function makeStorage(data = {}) {
  const map = new Map(Object.entries(data));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

const cached = {
  otli_token: "previous-session",
  otli_user: JSON.stringify({ id: "old", userType: "admin" }),
};

function loadStore({ initial = cached, getImpl, postImpl } = {}) {
  const storage = makeStorage(initial);
  let refreshCount = 0;
  const api = {
    get: (...args) => { refreshCount += 1; return getImpl ? getImpl(...args) : Promise.resolve({ data: { user: { id: "old" } } }); },
    post: (...args) => postImpl ? postImpl(...args) : Promise.resolve({ data: { token: "new-session", user: { id: "new", userType: "admin" } } }),
  };
  const create = (init) => {
    let state = {};
    const get = () => state;
    const set = (part) => Object.assign(state, part);
    Object.assign(state, init(set, get));
    const store = () => state;
    store.getState = () => state;
    return store;
  };
  const listeners = new Map();
  const context = {
    __test: { create, api, TOKEN_KEY: "otli_token", USER_KEY: "otli_user", getApiError: () => "service temporarily unavailable", store: null },
    localStorage: storage,
    window: { addEventListener: (event, cb) => listeners.set(event, cb) },
  };
  let source = read("stores/authStore.js")
    .replace('import { create } from "zustand";', 'const { create, api, TOKEN_KEY, USER_KEY, getApiError } = __test;')
    .replace('import { api, getApiError, TOKEN_KEY, USER_KEY } from "../lib/api";', "")
    .replace(/^export const /gm, "const ");
  source += "\n__test.store = useAuthStore;";
  vm.runInNewContext(source, context, { filename: "stores/authStore.js" });
  return { state: context.__test.store.getState(), storage, listeners, getRefreshCount: () => refreshCount };
}

function loadApi(initial = cached) {
  const storage = makeStorage(initial);
  let requestMiddleware;
  let errorMiddleware;
  const authEvents = [];
  const calls = [];
  const axios = {
    create() {
      const run = (url, config = {}) => {
        const prepared = requestMiddleware({ ...config, url, headers: { ...config.headers } });
        calls.push(prepared);
        return Promise.resolve({ data: { ok: true } });
      };
      return {
        interceptors: {
          request: { use: (cb) => { requestMiddleware = cb; } },
          response: { use: (_, onError) => { errorMiddleware = onError; } },
        },
        get: run,
        post: (url, data, config) => run(url, { ...config, data }),
      };
    },
  };
  const context = {
    __test: { axios, env: {}, api: null },
    FormData, URL, URLSearchParams, localStorage: storage,
    window: { location: { hostname: "admin.onetrue.ph" }, dispatchEvent: (ev) => authEvents.push(ev.type) },
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  let source = read("lib/api.js")
    .replace('import axios from "axios";', 'const axios = __test.axios;')
    .replaceAll("import.meta.env", "__test.env")
    .replace(/^export const /gm, "const ");
  source += "\n__test.api = api;";
  vm.runInNewContext(source, context, { filename: "lib/api.js" });
  return { api: context.__test.api, calls, storage, authEvents, errorMiddleware };
}

test("cached session is initialized immediately, while /auth/me revalidates", () => {
  const { state } = loadStore();
  assert.equal(state.initialized, true);
  assert.equal(state.loading, false);
});

test("slow background /auth/me never disables login submission", async () => {
  let complete;
  const { state } = loadStore({ getImpl: () => new Promise((resolve) => { complete = resolve; }) });
  const background = state.refreshMe();
  assert.equal(state.refreshing, true);
  assert.equal(state.loading, false);
  const result = await state.login({ email: "dummy@example.test", password: "hidden", loginType: "admin" });
  assert.equal(result.token, "new-session");
  assert.equal(state.loading, false);
  complete({ data: { user: { id: "old" } } });
  await background;
  assert.equal(state.token, "new-session");
  assert.equal(state.user.id, "new");
});

test("late 401 from previous /auth/me cannot wipe newly signed-in user", async () => {
  let fail;
  const { state, storage } = loadStore({ getImpl: () => new Promise((_, reject) => { fail = reject; }) });
  const background = state.refreshMe();
  await state.login({ email: "dummy@example.test", password: "hidden", loginType: "admin" });
  fail(Object.assign(new Error("Unauthorized"), { response: { status: 401 } }));
  await background;
  assert.equal(state.token, "new-session");
  assert.equal(state.user.id, "new");
  assert.equal(storage.getItem("otli_token"), "new-session");
  assert.equal(state.refreshing, false);
});

test("401 on the current token still clears the stale session", async () => {
  const { state, storage } = loadStore({ getImpl: async () => { throw Object.assign(new Error("Unauthorized"), { response: { status: 401 } }); } });
  await state.refreshMe();
  assert.equal(state.token, "");
  assert.equal(state.user, null);
  assert.equal(storage.getItem("otli_token"), null);
  assert.equal(state.refreshing, false);
});

test("503 on /auth/me preserves current session and never blocks login", async () => {
  const { state, storage } = loadStore({ getImpl: async () => { throw Object.assign(new Error("Unavailable"), { response: { status: 503 } }); } });
  await state.refreshMe();
  assert.equal(state.token, "previous-session");
  assert.equal(storage.getItem("otli_token"), "previous-session");
  assert.equal(state.loading, false);
  assert.equal(state.refreshing, false);
});

test("concurrent /auth/me refreshes for one token share a request", async () => {
  let complete;
  const { state, getRefreshCount } = loadStore({ getImpl: () => new Promise((resolve) => { complete = resolve; }) });
  const a = state.refreshMe();
  const b = state.refreshMe();
  assert.equal(a, b);
  assert.equal(getRefreshCount(), 1);
  complete({ data: { user: { id: "old" } } });
  await Promise.all([a, b]);
});

test("public /auth/login never sends the previous session Authorization header", async () => {
  const { api, calls } = loadApi();
  await api.post("/auth/login", { email: "dummy@example.test" });
  await api.get("/auth/me");
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[1].headers.Authorization, "Bearer previous-session");
});

test("stale background /auth/me 401 is handled by authStore rather than global interceptor", async () => {
  const { errorMiddleware, storage, authEvents } = loadApi();
  await assert.rejects(errorMiddleware({ response: { status: 401 }, config: { url: "/auth/me", headers: { Authorization: "Bearer previous-session" } } }));
  assert.equal(storage.getItem("otli_token"), "previous-session");
  assert.deepEqual(authEvents, []);
});

test("401 from previous session cannot clear a newer session", async () => {
  const { errorMiddleware, storage, authEvents } = loadApi();
  storage.setItem("otli_token", "new-session");
  await assert.rejects(errorMiddleware({ response: { status: 401 }, config: { url: "/client/bookings", headers: { Authorization: "Bearer previous-session" } } }));
  assert.equal(storage.getItem("otli_token"), "new-session");
  assert.deepEqual(authEvents, []);
});

test("401 on current protected request still logs out", async () => {
  const { errorMiddleware, storage, authEvents } = loadApi();
  await assert.rejects(errorMiddleware({ response: { status: 401 }, config: { url: "/client/bookings", headers: { Authorization: "Bearer previous-session" } } }));
  assert.equal(storage.getItem("otli_token"), null);
  assert.deepEqual(authEvents, ["otli:unauthorized"]);
});

test("AuthBootstrap refreshes the session once on mount, without gating the login form", () => {
  const source = read("components/auth/AuthBootstrap.jsx");
  assert.match(source, /void refreshMe\(\)/);
  assert.doesNotMatch(source, /if \(!initialized\)/);
});
