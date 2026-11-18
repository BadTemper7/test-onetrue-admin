"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, "src", file), "utf8");
const apiSource = read("lib/api.js");

const apiConfig = (hostname, env = {}) => {
  let source = apiSource
    .replace('import axios from "axios";', 'const axios = __test.axios;')
    .replaceAll("import.meta.env", "__test.env")
    .replace(/^export const /gm, "const ");
  source += "\n__test.urls = { API_URL, SOCKET_URL };";
  const context = {
    __test: {
      env,
      urls: null,
      axios: { create: () => ({
        get: () => Promise.resolve({}),
        interceptors: { request: { use() {} }, response: { use() {} } },
      }) },
    },
    window: { location: { hostname } },
    localStorage: { getItem: () => null, removeItem() {} },
    URL, URLSearchParams, FormData,
  };
  vm.runInNewContext(source, context);
  return context.__test.urls;
};

test("localhost admin/client connects to Express at port 3000", () => {
  for (const host of ["localhost", "127.0.0.1"]) {
    const result = apiConfig(host);
    assert.equal(result.API_URL, "http://localhost:3000/api");
    assert.equal(result.SOCKET_URL, "http://localhost:3000");
  }
});

test("production API and realtime URLs connect to the same backend", () => {
  const result = apiConfig("onetrue.ph");
  assert.equal(result.API_URL, "https://api.onetrue.ph/api");
  assert.equal(result.SOCKET_URL, "https://api.onetrue.ph");
});

test("configured VITE_API_URL without /api is normalized", () => {
  const result = apiConfig("onetrue.ph", { VITE_API_URL: "https://staging.example.test/" });
  assert.equal(result.API_URL, "https://staging.example.test/api");
  assert.equal(result.SOCKET_URL, "https://staging.example.test");
});

test("an explicit Socket.IO URL can still target a custom reverse proxy", () => {
  const result = apiConfig("onetrue.ph", {
    VITE_API_URL: "https://staging.example.test/api",
    VITE_SOCKET_URL: "https://realtime.example.test/",
  });
  assert.equal(result.SOCKET_URL, "https://realtime.example.test");
});

test("Socket.IO starts with polling and can upgrade when supported", () => {
  const source = read("hooks/useSocket.js");
  assert.match(source, /transports: \["polling", "websocket"\]/);
  assert.match(source, /upgrade: true/);
  assert.match(source, /reconnectionAttempts: Infinity/);
});

test("login requests have their own bounded timeout and never auto-retry", () => {
  const source = read("stores/authStore.js");
  assert.match(source, /timeout: 20000/);
  assert.doesNotMatch(source, /retry\s*:\s*(?:true|[1-9])/);
});

test("password-help page never calls the disabled OTP reset endpoint", () => {
  const source = read("pages/ForgotPassword.jsx");
  assert.doesNotMatch(source, /api\.(?:get|post|patch)\(/);
  assert.match(source, /contact OTLI support/i);
  assert.match(source, /Back to login/);
});
