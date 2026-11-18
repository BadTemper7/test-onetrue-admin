"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const source = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
let fetchStoragePage, fetchStorageAreaSummary, fetchStorageSlotMap, fetchStorageBlockList;
test.before(async () => {
  ({ fetchStoragePage, fetchStorageAreaSummary, fetchStorageSlotMap, fetchStorageBlockList } = await import(pathToFileURL(path.join(__dirname, "..", "src/lib/storageMonitoring.js")).href));
});

test("storage list loads only requested records and forwards filters to server", async () => {
  const calls = [];
  const api = { get: async (route, config) => { calls.push({ route, config }); return { data: { containers: [{ id: "x1" }], pagination: { page: 4, limit: 25, total: 99, totalPages: 4 } } }; } };
  const controller = new AbortController();
  const result = await fetchStoragePage(api, { page: 4, limit: 25, areaId: "a1", blockId: "b1", loadStatus: "laden", rateType: "local", search: "ABC" }, controller.signal);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].route, "/admin/storage-monitoring/containers");
  assert.deepEqual(calls[0].config.params, { page: 4, limit: 25, areaId: "a1", blockId: "b1", loadStatus: "laden", rateType: "local", search: "ABC" });
  assert.equal(calls[0].config.signal, controller.signal);
  assert.equal(result.containers.length, 1);
  assert.equal(result.pagination.total, 99);
});

test("storage overview reads metadata only and skips 3D containers", async () => {
  const calls = [];
  const api = { get: async (route) => { calls.push(route); return { data: { areas: [{ id: "a" }], storageOccupancy: { totalContainers: 45000, areas: [], blocks: [] } } }; } };
  const result = await fetchStorageAreaSummary(api);
  assert.deepEqual(calls, ["/admin/storage-monitoring/areas"]);
  assert.equal(result.occupancy.totalContainers, 45000);
});

test("3D containers fetch only the selected area, never all storage rows", async () => {
  const calls = [];
  const api = { get: async (route) => { calls.push(route); return { data: { blocks: [{ id: "b" }], visualContainers: [{ id: "1" }, { id: "2" }] } }; } };
  const response = await fetchStorageSlotMap(api, "a:b /?", undefined);
  assert.deepEqual(calls, ["/admin/storage-monitoring/areas/a%3Ab%20%2F%3F/slot-map"]);
  assert.equal(response.containers.length, 2);
});


test("selecting a yard loads small block metadata; 3D visualization is user-initiated", async () => {
  const calls = [];
  const api = { get: async (route) => { calls.push(route); return { data: { blocks: [{ id: "block-a", code: "A" }] } }; } };
  const blocks = await fetchStorageBlockList(api, "area-1");
  assert.deepEqual(calls, ["/admin/storage-monitoring/areas/area-1/blocks"]);
  assert.equal(blocks.length, 1);
  const page = source("src/pages/modules/AdminStorageMonitoring.jsx");
  assert.match(page, /showVisualization &&/);
  assert.match(page, /Open 3D Yard View/);
  assert.match(page, /if \(!showVisualization \|\| !selectedAreaId\) return undefined/);
});

test("the six requested admin pages are code-split and retain protected routes", () => {
  const app = source("src/App.jsx");
  for (const page of ["AdminInventory", "AdminStorageMonitoring", "AdminPaymentTypes", "AdminBilling", "AdminGateOut", "AdminReports"]) {
    assert.match(app, new RegExp(`const ${page} = lazy\\(\\(\\) => import`));
  }
  for (const route of ["yard/inventory", "yard/storage-monitoring", "billing/payment-types", "billing/payment-verification", "billing/gate-out", "reports/analytics"]) {
    assert.ok(app.includes(`path="${route}"`), route);
  }
  assert.match(app, /PermissionRoute/);
  assert.match(app, /<Suspense fallback=/);
});

test("payment and gate-out requests abort outdated pages and load summary separately", () => {
  const page = source("src/pages/modules/AdminBookingModule.jsx");
  assert.match(page, /params\.set\("includeSummary", "false"\)/);
  assert.match(page, /summaryOnly: "true"/);
  assert.match(page, /bookingsAbortRef\.current\?\.abort\(\)/);
  assert.match(page, /const \[debouncedSearch, setDebouncedSearch\]/);
  assert.match(page, /setTimeout\(\(\) => setDebouncedSearch\(filters\.search\.trim\(\)\), 350\)/);
});

test("inventory table is not held hostage by stats and meta queries", () => {
  const page = source("src/pages/modules/AdminInventory.jsx");
  assert.match(page, /await loadContainers\(\{ includeStats: false, includeMeta: false \}\)/);
  assert.match(page, /Promise\.allSettled\(\[loadAreas\(\), loadSummary\(\), loadClientOptions\(\), loadInventoryStats\(\)\]\)/);
});

test("analytics aborts stale requests instead of overwriting newer filter results", () => {
  const page = source("src/pages/modules/AdminReports.jsx");
  assert.match(page, /reportAbortRef\.current\?\.abort\(\)/);
  assert.match(page, /requestId !== reportRequestIdRef\.current/);
});
