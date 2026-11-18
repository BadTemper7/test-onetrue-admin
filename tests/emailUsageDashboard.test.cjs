"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const file = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("Dashboard includes registration email usage near the top", () => {
  const dashboard = file("src/pages/Dashboard.jsx");
  assert.match(dashboard, /import RegistrationEmailUsage from/);
  assert.match(dashboard, /<RegistrationEmailUsage\s*\/>/);
  assert.ok(dashboard.indexOf("<RegistrationEmailUsage") < dashboard.indexOf("{stats.map"));
});

test("Email usage widget uses authenticated, read-only monitoring without email sends", () => {
  const widget = file("src/components/dashboard/RegistrationEmailUsage.jsx");
  assert.match(widget, /api\.get\("\/admin\/email-usage"/);
  assert.match(widget, /timeout: 12000/);
  assert.match(widget, /window\.setInterval\(refresh, 60000\)/);
  assert.match(widget, /controller\.abort\(\)/);
  assert.doesNotMatch(widget, /api\.(?:post|patch|put|delete)\(/);
  assert.match(widget, /Hostinger.*live quota/);
  assert.match(widget, /reserved OTP attempts/);
});

test("Email usage shows errors rather than stale or misleading quota figures", () => {
  const widget = file("src/components/dashboard/RegistrationEmailUsage.jsx");
  assert.match(widget, /setUsage\(null\)/);
  assert.match(widget, /role="alert"/);
  assert.match(widget, /24 hours/);
  assert.match(widget, /Next slot:/);
});
