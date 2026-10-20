import assert from "node:assert/strict"
import test from "node:test"
import {
  STORAGE_PAGE_SIZE,
  fetchStorageOverview,
  fetchStoragePage,
  fetchYardAreaSlotMap,
  getStoragePageKey,
} from "../src/lib/storageMonitoring.js"

const overviewData = {
  areas: [{ id: "area-a" }, { id: "area-b" }],
  filterBlocks: [{ id: "block-a", area: "area-a", code: "A" }],
  storageOccupancy: {
    totalContainers: 60,
    areas: [{ areaId: "area-a", usedTeu: 80, containerCount: 60 }],
    blocks: [{ areaId: "area-a", blockId: "block-a", usedTeu: 80, containerCount: 60 }],
  },
}

const pagedApi = (allRows) => {
  const calls = []
  const api = { get: async (url, { params } = {}) => {
    calls.push({ url, params })
    if (url === "/admin/storage-monitoring/areas") return { data: overviewData }
    if (url.includes("/slot-map")) return { data: {
      area: { id: "area-a" }, blocks: [{ id: "block-a" }],
      visualContainers: allRows.map((row) => ({ ...row, block: "block-a" })),
      visualizationTruncated: false,
    } }
    const page = params.page
    const limit = params.limit
    return { data: {
      containers: allRows.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total: allRows.length },
    } }
  } }
  return { api, calls }
}

test("yard overview returns every area and compact filter blocks in ONE request", async () => {
  const { api, calls } = pagedApi([])
  const overview = await fetchStorageOverview(api)
  assert.equal(overview.areas.length, 2)
  assert.equal(overview.filterBlocks.length, 1)
  assert.equal(overview.hasOccupancy, true)
  assert.equal(overview.occupancy.totalContainers, 60)
  assert.deepEqual(calls, [{ url: "/admin/storage-monitoring/areas", params: undefined }])
})

test("overview never requests any container page or slot-map", async () => {
  const { api, calls } = pagedApi(Array.from({ length: 3000 }, (_, i) => ({ id: `${i}` })))
  await fetchStorageOverview(api)
  assert.equal(calls.length, 1)
  assert.ok(!calls[0].url.includes("containers"))
  assert.ok(!calls[0].url.includes("slot-map"))
})

test("page 1, 2 and 3 with 60 rows each request exactly one page", async () => {
  const fixture = pagedApi(Array.from({ length: 60 }, (_, i) => ({ id: `stored-${i}` })))
  const first = await fetchStoragePage(fixture.api, { page: 1, pageSize: 25 })
  const second = await fetchStoragePage(fixture.api, { page: 2, pageSize: 25 })
  const third = await fetchStoragePage(fixture.api, { page: 3, pageSize: 25 })
  assert.deepEqual([first.containers.length, second.containers.length, third.containers.length], [25, 25, 10])
  assert.equal(third.pagination.totalPages, 3)
  assert.deepEqual(fixture.calls.map(({ params }) => params.page), [1, 2, 3])
  assert.ok(fixture.calls.every(({ url }) => url === "/admin/storage-monitoring/containers"))
})

test("table filters are forwarded only to the table endpoint", async () => {
  const calls = []
  const api = { get: async (url, options) => {
    calls.push({ url, params: options.params })
    return { data: { containers: [{ id: "a" }], pagination: { total: 1, page: 1 } } }
  } }
  await fetchStoragePage(api, {
    page: 1, pageSize: STORAGE_PAGE_SIZE,
    areaId: "area-a", blockId: "block-b",
    loadStatus: "laden", rateType: "international", search: " ABC 123 ",
  })
  assert.deepEqual(calls, [{ url: "/admin/storage-monitoring/containers", params: {
    page: 1, limit: 25, areaId: "area-a", blockId: "block-b",
    loadStatus: "laden", rateType: "international", search: "ABC 123",
  } }])
})

test("table with no filters sends no area ID even if a 3D yard was selected elsewhere", async () => {
  const { api, calls } = pagedApi([{ id: "stored" }])
  await fetchYardAreaSlotMap(api, "area-a")
  await fetchStoragePage(api, { page: 1 })
  assert.equal(calls[0].url, "/admin/storage-monitoring/areas/area-a/slot-map")
  assert.equal(calls[1].params.areaId, undefined)
})

test("3D is never requested without a yard; a selection makes exactly one request", async () => {
  const { api, calls } = pagedApi([{ id: "stored" }])
  assert.deepEqual(await fetchYardAreaSlotMap(api, ""), {
    area: null, blocks: [], containers: [], truncated: false,
  })
  assert.equal(calls.length, 0)
  const map = await fetchYardAreaSlotMap(api, "area-a")
  assert.equal(map.containers.length, 1)
  assert.equal(map.blocks.length, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "/admin/storage-monitoring/areas/area-a/slot-map")
})

test("slot-map preserves ALL coordinates without client-side page loops or truncation", async () => {
  const { api, calls } = pagedApi(Array.from({ length: 5200 }, (_, i) => ({ id: String(i) })))
  const result = await fetchYardAreaSlotMap(api, "area-a")
  assert.equal(result.containers.length, 5200)
  assert.equal(result.truncated, false)
  assert.equal(calls.length, 1)
})

test("server may clamp an out-of-range page and preserve the real page number", async () => {
  const api = { get: async () => ({ data: {
    containers: [{ id: "last" }], pagination: { total: 101, page: 5 },
  } }) }
  const result = await fetchStoragePage(api, { page: 100, pageSize: 25 })
  assert.equal(result.pagination.page, 5)
  assert.equal(result.pagination.totalPages, 5)
})

test("invalid 60-count empty response never masquerades as an empty yard", async () => {
  const api = { get: async () => ({ data: { containers: [], pagination: { total: 60, page: 1 } } }) }
  await assert.rejects(() => fetchStoragePage(api), /Unable to load stored containers/)
})

test("missing pagination or invalid returned rows are reported rather than hidden", async () => {
  const api = { get: async () => ({ data: { containers: [{ id: "x" }] } }) }
  await assert.rejects(() => fetchStoragePage(api), /Unable to load stored containers/)
  const tooMany = { get: async () => ({ data: {
    containers: Array.from({ length: 30 }, (_, i) => ({ id: String(i) })),
    pagination: { total: 30, page: 1 },
  } }) }
  await assert.rejects(() => fetchStoragePage(tooMany), /Unable to load stored containers/)
})

test("empty storage is an ordinary zero-row first page", async () => {
  const { api } = pagedApi([])
  const result = await fetchStoragePage(api)
  assert.equal(result.pagination.total, 0)
  assert.deepEqual(result.containers, [])
})

test("missing overview and 3D fields produce friendly error states", async () => {
  await assert.rejects(() => fetchStorageOverview({ get: async () => ({ data: { areas: [] } }) }), /Unable to load yard information/)
  await assert.rejects(() => fetchYardAreaSlotMap({ get: async () => ({ data: { containers: [] } }) }, "area"), /Unable to display this yard/)
})

test("query keys change only for table filters, not for 3D selection", () => {
  assert.notEqual(getStoragePageKey({ page: 1 }), getStoragePageKey({ page: 2 }))
  assert.notEqual(getStoragePageKey({ areaId: "a" }), getStoragePageKey({ areaId: "b" }))
  assert.equal(getStoragePageKey({ search: " XYZ " }), getStoragePageKey({ search: "XYZ" }))
})

test("abort signal passes unchanged to the selected-area and list requests", async () => {
  const calls = []
  const api = { get: async (_url, options) => {
    calls.push(options)
    if (_url.includes("slot-map")) return { data: { area: {}, blocks: [], visualContainers: [] } }
    return { data: { containers: [], pagination: { total: 0, page: 1 } } }
  } }
  const signal = new AbortController().signal
  await fetchStoragePage(api, {}, signal)
  await fetchYardAreaSlotMap(api, "area-a", signal)
  assert.equal(calls[0].signal, signal)
  assert.equal(calls[1].signal, signal)
})

test("React module does not bind table pagination to selected 3D yard or block", async () => {
  const { readFileSync } = await import("node:fs")
  const { fileURLToPath } = await import("node:url")
  const source = readFileSync(fileURLToPath(new URL("../src/pages/modules/AdminStorageMonitoring.jsx", import.meta.url)), "utf8")
  const tableQuery = source.match(/const pageQuery = \{([\s\S]*?)\n  \}/)?.[1] || ""
  assert.match(tableQuery, /areaId: tableAreaId, blockId: tableBlockId/)
  assert.doesNotMatch(tableQuery, /selectedAreaId|selectedBlockId/)
  const dependencies = source.match(/\}, \[page, pageSize, [^\]]+\]\)/)?.[0] || ""
  assert.match(dependencies, /tableAreaId, tableBlockId/)
  assert.doesNotMatch(dependencies, /selectedAreaId|selectedBlockId/)
  assert.equal((source.match(/fetchYardAreaSlotMap\(api,/g) || []).length, 1)
  assert.equal((source.match(/fetchStoragePage\(api,/g) || []).length, 1)
  assert.doesNotMatch(source, /fetchYardAreaBlocks\(|fetchYardAreaVisualization\(/)
})

test("3D coordinate mapping keeps tiers vertical, rows horizontal, and bays in depth", async () => {
  const { readFileSync } = await import("node:fs")
  const { fileURLToPath } = await import("node:url")
  const source = readFileSync(fileURLToPath(new URL("../src/pages/modules/AdminStorageMonitoring.jsx", import.meta.url)), "utf8")
  assert.match(source, /x: \(row - 1\) \* \(cubeW \+ gap\)/)
  assert.match(source, /y: -\(tier - 1\) \* \(cubeH \+ gap\)/)
  assert.match(source, /z: \(bay - 1\) \* \(cubeD \+ gap\)/)
})
