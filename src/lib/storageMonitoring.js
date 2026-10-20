/**
 * Storage Monitoring V6: three independent reads.
 * - Overview: all yard cards + compact block filter options, no containers
 * - Table: exactly ONE requested paginated storage page
 * - 3D: ONE selected yard's full layout and compact container positions
 * No compatibility sweeps, background page enumeration, or table requests
 * are ever used to build the 3D view.
 */
export const STORAGE_PAGE_SIZE = 25
const BASE = "/admin/storage-monitoring"
const LIST_ERROR = "Unable to load stored containers. Please try again."
const MAP_ERROR = "Unable to display this yard right now. Please try again."
const OVERVIEW_ERROR = "Unable to load yard information. Please try again."

const positiveInteger = (value, fallback) => {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}

export const fetchStorageOverview = async (api, signal) => {
  const { data } = await api.get(`${BASE}/areas`, { signal })
  if (!Array.isArray(data?.areas) || !Array.isArray(data?.filterBlocks)) throw new Error(OVERVIEW_ERROR)
  const occupancy = data.storageOccupancy
  const hasOccupancy = Boolean(
    occupancy && Array.isArray(occupancy.areas) && Array.isArray(occupancy.blocks),
  )
  return {
    areas: data.areas,
    filterBlocks: data.filterBlocks,
    occupancy: hasOccupancy ? occupancy : null,
    hasOccupancy,
  }
}

export const getStoragePageKey = ({
  page = 1, pageSize = STORAGE_PAGE_SIZE, areaId = "", blockId = "",
  loadStatus = "all", rateType = "all", search = "",
} = {}) => JSON.stringify([
  positiveInteger(page, 1), positiveInteger(pageSize, STORAGE_PAGE_SIZE),
  areaId, blockId, loadStatus, rateType, search.trim(),
])

export const fetchStoragePage = async (api, {
  page = 1, pageSize = STORAGE_PAGE_SIZE, areaId = "", blockId = "",
  loadStatus = "all", rateType = "all", search = "",
} = {}, signal) => {
  const requestedPage = positiveInteger(page, 1)
  const limit = Math.min(100, positiveInteger(pageSize, STORAGE_PAGE_SIZE))
  const params = {
    page: requestedPage, limit,
    ...(areaId ? { areaId } : {}),
    ...(blockId ? { blockId } : {}),
    ...(loadStatus && loadStatus !== "all" ? { loadStatus } : {}),
    ...(rateType && rateType !== "all" ? { rateType } : {}),
    ...(search?.trim() ? { search: search.trim() } : {}),
  }
  const { data } = await api.get(`${BASE}/containers`, { params, signal })
  if (!Array.isArray(data?.containers)) throw new Error(LIST_ERROR)
  const total = Number(data?.pagination?.total)
  const returnedPage = Number(data?.pagination?.page ?? data?.pagination?.currentPage)
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(returnedPage) || returnedPage < 1) {
    throw new Error(LIST_ERROR)
  }
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pageNumber = Math.min(returnedPage, totalPages)
  const expectedLength = Math.min(limit, Math.max(0, total - (pageNumber - 1) * limit))
  // Do not silently display an empty table when a broken API reports stored
  // records but fails to return its requested page.
  if (data.containers.length > limit || (expectedLength > 0 && data.containers.length === 0)) throw new Error(LIST_ERROR)
  return {
    containers: data.containers,
    pagination: { total, totalPages, page: pageNumber },
  }
}

/** Called only when an actual yard area is selected. */
export const fetchYardAreaSlotMap = async (api, areaId, signal) => {
  if (!areaId) return { area: null, blocks: [], containers: [], truncated: false }
  const { data } = await api.get(`${BASE}/areas/${encodeURIComponent(areaId)}/slot-map`, { signal })
  if (!data?.area || !Array.isArray(data?.blocks) || !Array.isArray(data?.visualContainers)) {
    throw new Error(MAP_ERROR)
  }
  return {
    area: data.area,
    blocks: data.blocks,
    containers: data.visualContainers,
    truncated: Boolean(data.visualizationTruncated),
  }
}
