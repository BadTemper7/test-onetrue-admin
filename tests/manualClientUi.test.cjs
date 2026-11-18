"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.resolve(__dirname, "../src/pages/modules/AdminClients.jsx"), "utf8");
test("Client Verification has permission-gated Add Client form and required documents", () => {
  assert.match(src, /hasModulePermission\(authenticatedUser, "clientVerification", "create"\)/);
  assert.match(src, /Add Client Account/);
  assert.match(src, /"\/admin\/clients"/);
  for (const field of ["businessPermit", "birCertificate", "validId"]) assert.match(src, new RegExp(field));
  assert.match(src, /status: "pending"|Created as pending/);
});
test("Manual approval requires active administrator attestation and never silently verifies email", () => {
  assert.match(src, /manualVerificationConfirmed/);
  assert.match(src, /confirmManualVerification/);
  assert.match(src, /Email ownership is not confirmed/);
});
