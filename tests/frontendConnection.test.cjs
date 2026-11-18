"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, "src", name), "utf8");

function makeLocalStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function loadApi(initial = {}) {
  let requestInterceptor;
  const calls = [];
  const storage = makeLocalStorage(initial);
  const mockAxios = {
    create(defaults) {
      const request = (method, url, data, config = {}) => {
        let options = { ...defaults, ...config, headers: { ...config?.headers }, data };
        options = requestInterceptor(options);
        calls.push({ method, url, config: options });
        return Promise.resolve({ data: { ok: true } });
      };
      return {
        defaults,
        interceptors: {
          request: { use: (fn) => { requestInterceptor = fn; } },
          response: { use: () => {} },
        },
        get: (url, config) => request("GET", url, undefined, config),
        post: (url, data, config) => request("POST", url, data, config),
      };
    },
  };
  const context = {
    __test: { axios: mockAxios, env: {}, capture: null },
    FormData,
    URL, URLSearchParams,
    localStorage: storage,
    window: { location: { hostname: "onetrue.ph" }, dispatchEvent: () => {} },
    CustomEvent: class {},
    console,
  };
  let source = read("lib/api.js")
    .replace('import axios from "axios";', 'const axios = __test.axios;')
    .replaceAll("import.meta.env", "__test.env")
    .replace(/^export const /gm, "const ");
  source += "\n__test.capture = { api, API_URL, API_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, getApiError };\n";
  vm.runInNewContext(source, context, { filename: "src/lib/api.js" });
  return { ...context.__test.capture, calls, storage };
}

function loadAuthStore({ getError, getImpl, initial = {} } = {}) {
  const storage = makeLocalStorage(initial);
  const api = {
    get: getImpl || (async () => { throw getError || Object.assign(new Error("Service unavailable"), { response: { status: 503 } }); }),
  };
  const create = (initializer) => {
    let state = {};
    const set = (patch) => Object.assign(state, patch);
    const get = () => state;
    Object.assign(state, initializer(set, get));
    const useStore = () => state;
    useStore.getState = () => state;
    return useStore;
  };
  const context = {
    __test: {
      create, api, TOKEN_KEY: "otli_token", USER_KEY: "otli_user",
      getApiError: () => "Service temporarily unavailable", capture: null,
    },
    localStorage: storage,
    window: { addEventListener: () => {} },
    JSON,
  };
  let source = read("stores/authStore.js")
    .replace('import { create } from "zustand";', 'const { create, api, TOKEN_KEY, USER_KEY, getApiError } = __test;')
    .replace('import { api, getApiError, TOKEN_KEY, USER_KEY } from "../lib/api";', "")
    .replace(/^export const /gm, "const ");
  source += "\n__test.capture = useAuthStore;\n";
  vm.runInNewContext(source, context, { filename: "src/stores/authStore.js" });
  return { store: context.__test.capture, storage };
}

const loginState = {
  otli_token: "sample-jwt-token",
  otli_user: JSON.stringify({ id: "u1", userType: "client", status: "active" }),
};

test("default API URL uses the production HTTPS API endpoint", () => {
  assert.equal(loadApi().API_URL, "https://api.onetrue.ph/api");
});

test("regular API requests use 60-second timeout", async () => {
  const { api, calls, API_TIMEOUT_MS } = loadApi();
  await api.get("/auth/me");
  assert.equal(API_TIMEOUT_MS, 60000);
  assert.equal(calls[0].config.timeout, 60000);
});

test("FormData POST uploads automatically use 120-second timeout", async () => {
  const { api, calls, UPLOAD_TIMEOUT_MS } = loadApi();
  const form = new FormData();
  form.append("name", "Test company");
  await api.post("/auth/client/register/request-otp", form);
  assert.equal(UPLOAD_TIMEOUT_MS, 120000);
  assert.equal(calls[0].config.timeout, 120000);
});

test("explicit short and upload timeouts are respected", async () => {
  const { api, calls } = loadApi();
  await api.get("/admin/inventory/stats", { timeout: 10000 });
  await api.post("/upload", new FormData(), { timeout: 15000 });
  assert.equal(calls[0].config.timeout, 10000);
  assert.equal(calls[1].config.timeout, 15000);
});

test("identical default GETs can share one in-flight request", async () => {
  const { api, calls } = loadApi(loginState);
  const a = api.get("/admin/dashboard");
  const b = api.get("/admin/dashboard");
  assert.equal(a, b);
  await Promise.all([a, b]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.headers.Authorization, "Bearer sample-jwt-token");
});

test("GETs are not shared across sessions", async () => {
  const { api, calls, storage } = loadApi(loginState);
  const a = api.get("/auth/me");
  storage.setItem("otli_token", "different-token");
  const b = api.get("/auth/me");
  assert.notEqual(a, b);
  await Promise.all([a, b]);
  assert.equal(calls.length, 2);
});

test("GETs with different request options are not merged", async () => {
  const { api, calls } = loadApi(loginState);
  await Promise.all([
    api.get("/admin/inventory/stats", { timeout: 10000 }),
    api.get("/admin/inventory/stats"),
  ]);
  assert.equal(calls.length, 2);
});

test("errors are actionable without automatically retrying requests", () => {
  const { getApiError } = loadApi();
  assert.match(getApiError({ code: "ETIMEDOUT" }), /timed out/i);
  assert.match(getApiError({ code: "ERR_NETWORK" }), /Cannot reach/i);
  assert.equal(getApiError({ response: { data: { message: "Too many requests" } } }), "Too many requests");
});

test("temporary 503 during /auth/me does not erase token", async () => {
  const { store, storage } = loadAuthStore({ initial: loginState });
  const result = await store.getState().refreshMe();
  assert.equal(result?.id, "u1");
  assert.equal(storage.getItem("otli_token"), "sample-jwt-token");
  assert.equal(store.getState().initialized, true);
  assert.equal(store.getState().loading, false);
});

test("network timeout during /auth/me does not erase token", async () => {
  const err = Object.assign(new Error("timeout"), { code: "ECONNABORTED" });
  const { store, storage } = loadAuthStore({ initial: loginState, getError: err });
  await store.getState().refreshMe();
  assert.equal(storage.getItem("otli_token"), "sample-jwt-token");
});

test("real 401 during /auth/me still clears the session", async () => {
  const err = Object.assign(new Error("Unauthorized"), { response: { status: 401 } });
  const { store, storage } = loadAuthStore({ initial: loginState, getError: err });
  await store.getState().refreshMe();
  assert.equal(storage.getItem("otli_token"), null);
  assert.equal(store.getState().user, null);
});

test("registration OTP upload has explicit 120s limit and no auto retry", () => {
  const text = read("pages/Register.jsx");
  assert.match(text, /"\/auth\/client\/register\/request-otp"/);
  assert.match(text, /timeout: 120000/);
  assert.match(text, /I received an OTP - enter the code/);
  assert.match(text, /No automatic retry/);
});

test("a late failing request cannot resurrect a logged-out session", async () => {
  let fail;
  const { store, storage } = loadAuthStore({
    initial: loginState,
    getImpl: () => new Promise((_, reject) => { fail = reject; }),
  });
  const pending = store.getState().refreshMe();
  store.getState().logout();
  fail(Object.assign(new Error("Service unavailable"), { response: { status: 503 } }));
  await pending;
  assert.equal(storage.getItem("otli_token"), null);
  assert.equal(store.getState().token, "");
});
