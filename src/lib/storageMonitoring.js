/**
 * Storage Monitoring data access.
 *
 * New servers return every storage record and the occupancy summary in one
 * unpaginated response. Older servers silently ignore these newer query flags;
 * collect their existing paginated records in the background instead.
 * There is no pagination or page size in the user interface.
 */
const STORAGE_PAGE_SIZE = 100
const MAX_CONCURRENT_REQUESTS = 4

const numeric = (value) => Number(value) || 0
const asId = (value) => String(value == null ? "" : value)

export const summarizeStoredContainers = (containers = []) => {
  const areas = new Map()
  const blocks = new Map()
  const totals = {
    totalContainers: 0,
    totalTeu: 0,
    assignedContainers: 0,
    assignedTeu: 0,
    unassignedContainers: 0,
    unassignedTeu: 0,
  }

  for (const container of containers) {
    const areaId = asId(container.area)
    const blockId = asId(container.block)
    const usedTeu = numeric(container.containerSize) === 40 ? 2 : 1
    totals.totalContainers += 1
    totals.totalTeu += usedTeu

    if (!areaId) {
      totals.unassignedContainers += 1
      totals.unassignedTeu += usedTeu
      continue
    }

    totals.assignedContainers += 1
    totals.assignedTeu += usedTeu
    if (!areas.has(areaId)) areas.set(areaId, { areaId, containerCount: 0, usedTeu: 0 })
    const area = areas.get(areaId)
    area.containerCount += 1
    area.usedTeu += usedTeu

    if (blockId) {
      const key = `${areaId}:${blockId}`
      if (!blocks.has(key)) blocks.set(key, { areaId, blockId, containerCount: 0, usedTeu: 0 })
      const block = blocks.get(key)
      block.containerCount += 1
      block.usedTeu += usedTeu
    }
  }

  return { ...totals, areas: [...areas.values()], blocks: [...blocks.values()] }
}

export const filterStoredContainers = (containers = [], { areaId = "", blockId = "", loadStatus = "all", rateType = "all", search = "" } = {}) => {
  const term = search.trim().toLowerCase()
  return containers.filter((container) => {
    if (areaId && asId(container.area) !== areaId) return false
    if (blockId && asId(container.block) !== blockId) return false
    const load = String(container.containerLoadStatus || container.containerStatus || "").toLowerCase()
    if (loadStatus !== "all" && loadStatus !== "" && load !== (loadStatus === "loaded" ? "laden" : loadStatus)) return false
    if (rateType !== "all" && rateType !== "" && String(container.rateType || "local").toLowerCase() !== rateType) return false
    if (!term) return true
    return [
      container.containerNumber, container.bookingReference, container.preAdviceNumber,
      container.bookingNumber, container.clientName, container.customerName,
      container.areaName, container.blockName, container.blockCode,
      container.slotNumber, container.shippingLine, container.blNumber,
    ].some((value) => String(value || "").toLowerCase().includes(term))
  })
}

const dedupe = (rows) => {
  const unique = new Map()
  for (const row of rows) {
    const key = `${row.source || row.recordSource || ""}:${row.id}`
    if (!unique.has(key)) unique.set(key, row)
  }
  return [...unique.values()]
}

/** Fetch all storage rows using the original server's 100-record pages. */
export const fetchLegacyStoredContainers = async (api, signal) => {
  const fetchPage = async (page) => {
    const { data } = await api.get("/admin/inventory/containers", {
      signal,
      params: { view: "storage", page, limit: STORAGE_PAGE_SIZE, includeStats: "false" },
    })
    return data
  }

  const first = await fetchPage(1)
  const total = Math.max(numeric(first.pagination?.total), (first.containers || []).length)
  const pages = Math.max(1, Math.ceil(total / STORAGE_PAGE_SIZE))
  const results = Array.from({ length: pages }, () => [])
  results[0] = first.containers || []
  let nextPage = 2
  const worker = async () => {
    while (nextPage <= pages) {
      if (signal?.aborted) return
      const page = nextPage++
      const data = await fetchPage(page)
      results[page - 1] = data.containers || []
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, pages - 1) }, worker))
  return dedupe(results.flat())
}

/**
 * Loads all yard-area metadata and all stored rows without downloading or
 * rendering any block-level 3D geometry. Works with original and new servers.
 */
export const fetchStorageOverview = async (api, signal) => {
  const { data } = await api.get("/admin/inventory/module-data", {
    signal,
    params: {
      view: "storage",
      includeMeta: "true",
      includeStats: "false",
      includeStorageOccupancy: "true",
      unpaginated: "true",
    },
  })
  if (!Array.isArray(data.areas)) {
    throw new Error("Yard areas could not be loaded. Please check the server API.")
  }

  const initialRows = Array.isArray(data.containers) ? data.containers : []
  const total = numeric(data.pagination?.total)
  const isAllRows = data.unpaginated === true || (total <= initialRows.length && (!data.pagination || numeric(data.pagination.page || 1) === 1))
  const containers = isAllRows ? dedupe(initialRows) : await fetchLegacyStoredContainers(api, signal)

  // The old API has no storageOccupancy key; calculate identical totals from
  // the complete storage list rather than showing false zeros or throwing.
  const calculated = summarizeStoredContainers(containers)
  const validOccupancy = data.storageOccupancy && Array.isArray(data.storageOccupancy.areas)
    && Array.isArray(data.storageOccupancy.blocks)
  const occupancy = validOccupancy && numeric(data.storageOccupancy.totalContainers) === containers.length
    ? data.storageOccupancy
    : calculated

  return { areas: data.areas, containers, occupancy }
}

/** Detailed blocks are fetched only after an area is selected. */
export const fetchYardAreaBlocks = async (api, areaId, signal) => {
  if (!areaId) return []
  const { data } = await api.get(`/admin/inventory/areas/${encodeURIComponent(areaId)}/blocks`, { signal })
  if (!Array.isArray(data.blocks)) throw new Error("Yard blocks could not be loaded.")
  return data.blocks
}

/** One bounded page of server-side filtered storage data; no global container dump. */
export const fetchStoragePage = async (api, params, signal) => {
  const { data } = await api.get("/admin/storage-monitoring/containers", {
    signal,
    params: { page: params.page || 1, limit: params.limit || 25, areaId: params.areaId || "", blockId: params.blockId || "", loadStatus: params.loadStatus || "all", rateType: params.rateType || "all", search: params.search || "" },
  })
  if (!Array.isArray(data.containers) || !data.pagination) throw new Error("Invalid storage table response")
  return { containers: data.containers, pagination: data.pagination }
}

/** Yard area occupancy is independent of container pagination. */
export const fetchStorageAreaSummary = async (api, signal) => {
  const { data } = await api.get("/admin/storage-monitoring/areas", { signal })
  if (!Array.isArray(data.areas) || !data.storageOccupancy) throw new Error("Invalid yard area summary response")
  return { areas: data.areas, occupancy: data.storageOccupancy }
}

/** Load full 3D geometry only when a specific area is actually opened. */
export const fetchStorageSlotMap = async (api, areaId, signal) => {
  const { data } = await api.get(`/admin/storage-monitoring/areas/${encodeURIComponent(areaId)}/slot-map`, { signal })
  if (!Array.isArray(data.blocks) || !Array.isArray(data.visualContainers)) throw new Error("Invalid yard slot map response")
  return { blocks: data.blocks, containers: data.visualContainers }
}

/** Lightweight, read-only geometry metadata for one yard; never auto-creates blocks. */
export const fetchStorageBlockList = async (api, areaId, signal) => {
  if (!areaId) return []
  const { data } = await api.get(`/admin/storage-monitoring/areas/${encodeURIComponent(areaId)}/blocks`, { signal })
  if (!Array.isArray(data.blocks)) throw new Error("Invalid yard block response")
  return data.blocks
}
