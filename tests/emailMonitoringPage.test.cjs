"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("Email monitoring page is added under Reports with reports permission", () => {
  const app = source("src/App.jsx");
  const nav = source("src/components/layout/Sidebar.jsx");
  assert.match(app, /AdminEmailMonitoring = lazy/);
  assert.match(app, /path="reports\/email-monitoring"/);
  assert.match(app, /ProtectedModule moduleName="reports"><AdminEmailMonitoring/);
  assert.match(nav, /name: "Email monitoring", path: "\/reports\/email-monitoring"/);
  assert.match(nav, /"\/reports\/email-monitoring": "reports"/);
});

test("Email monitoring reports stay read-only; only Super Admin may reconcile unused slots", () => {
  const page = source("src/pages/modules/AdminEmailMonitoring.jsx");
  assert.match(page, /api\.get\("\/admin\/email-monitoring"/);
  assert.match(page, /api\.get\("\/admin\/email-monitoring\/export"/);
  assert.match(page, /responseType: "blob"/);
  assert.match(page, /controller\.abort\(\)/);
  assert.match(page, /Custom date range/);
  assert.match(page, /rateLimited/);
  assert.match(page, /RegistrationEmailUsage/);
  assert.match(page, /api\.post\("\/admin\/email-usage\/reconcile"/);
  assert.match(page, /isSuperAdmin &&/);
  assert.doesNotMatch(page, /api\.(?:patch|put|delete)\(/);
  assert.doesNotMatch(page, /sendRegistrationOtpEmail|SMTP_PASS/);
});

test("UI makes masked data, Philippine timezone and SMTP limitations visible", () => {
  const page = source("src/pages/modules/AdminEmailMonitoring.jsx");
  assert.match(page, /Asia\/Manila/);
  assert.match(page, /Recipient addresses are masked/);
  assert.match(page, /SMTP acceptance does not guarantee inbox delivery/);
  assert.match(page, /Unconfirmed/);
  assert.match(page, /date-filtered report/);
});

test("admin omits the all sentinel for compatibility with older API deployments", () => {
  const page = source("src/pages/modules/AdminEmailMonitoring.jsx");
  assert.match(page, /eventType !== "all" \? \{ type: eventType \} : \{\}/);
  assert.equal((page.match(/eventType !== "all"/g) || []).length, 2, "list and CSV export omit all sentinel");
});
