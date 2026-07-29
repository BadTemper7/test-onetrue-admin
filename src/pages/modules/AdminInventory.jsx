import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Edit3, MapPin, PackageCheck, RefreshCw, Search, SlidersHorizontal, Warehouse, X } from "lucide-react"
import Alert from "../../components/Alert"
import { api, getApiError } from "../../lib/api"
import Pagination from "../../components/ui/Pagination"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"

const bookingStatusesForInventory = [
  "gate_in_approved",
  "stored_in_assigned_area",
  "gate_out_requested",
  "gate_out_approved",
]

const statusLabel = {
  approved_area_assigned: "Approved / Area Assigned",
  gate_in_approved: "Gate-In Approved",
  stored_in_assigned_area: "Stored in Assigned Area",
  gate_out_requested: "Gate-Out Requested",
  gate_out_approved: "Gate-Out Approved",
  completed_gate_out_done: "Completed / Gate-Out Done",
}

const billingLabel = {
  unpaid: "Unpaid",
  payment_submitted: "Payment Submitted",
  payment_under_review: "Payment Under Review",
  payment_rejected: "Payment Rejected",
  paid_approved: "Paid / Approved",
}

const statusClass = (status) => {
  if (status === "gate_in_approved") return "bg-amber-50 text-amber-700"
  if (status === "stored_in_assigned_area") return "bg-blue-50 text-blue-700"
  if (["gate_out_requested", "gate_out_approved"].includes(status)) return "bg-blue-50 text-blue-700"
  return "bg-slate-100 text-slate-700"
}

const billingClass = (status) => {
  if (status === "paid_approved") return "bg-blue-50 text-blue-700"
  if (status === "payment_under_review" || status === "payment_submitted") return "bg-amber-50 text-amber-700"
  if (status === "payment_rejected") return "bg-red-50 text-red-700"
  return "bg-slate-100 text-slate-700"
}

const formatDate = (value) => {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

const getTeu = (size) => Number(size) === 40 ? 2 : 1

const getInventoryEnteredTime = (container) => {
  const value = container.inventoryEnteredAt
    || container.gateInApprovedAt
    || container.storedAt
    || container.storageStartDate
    || container.createdAt
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs font-semibold text-slate-400">{hint}</span>}
  </label>
)

const StatCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
      </div>
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
        <Icon size={20} />
      </div>
    </div>
  </div>
)

const LocationModal = ({ open, container, areas, blocks, slots, loadingBlocks, saving, onClose, onAreaChange, onBlockChange, onSubmit, form, setForm }) => {
  const selectedBlock = blocks.find((block) => block.id === form.blockId)
  const currentSlotKey = container ? `${container.bay}-${container.row}-${container.tier}` : ""

  if (!open || !container) return null

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  return (
    <div className="fixed inset-0 z-[9998] grid place-items-center bg-slate-950/[0.55] p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
              <MapPin size={14} /> Relocate Container
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">{container.containerNumber}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Current location: {container.areaName || "No area"} / {container.blockCode || container.blockName || "No block"} / {container.slotNumber || "No slot"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Yard Area">
              <select className="input" name="areaId" value={form.areaId} onChange={(event) => onAreaChange(event.target.value)} required>
                <option value="">Select area</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name} • {area.availableSlots ?? 0} TEU available</option>
                ))}
              </select>
            </Field>

            <Field label="Block">
              <select className="input" name="blockId" value={form.blockId} onChange={(event) => onBlockChange(event.target.value)} required disabled={!form.areaId || loadingBlocks}>
                <option value="">{loadingBlocks ? "Loading blocks..." : "Select block"}</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>{block.code} - {block.name} • {block.containerSize}ft • {block.availableSlots ?? 0} TEU left</option>
                ))}
              </select>
            </Field>
          </div>

          {selectedBlock && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
              Block limit: Bay {selectedBlock.bayCount || selectedBlock.lineCount || 1}, Row {selectedBlock.rowCount || 1}, Tier {selectedBlock.tierCount || 1}. The backend will reject occupied or reserved slots.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Bay">
              <input className="input" name="bay" type="number" min="1" max={selectedBlock?.bayCount || selectedBlock?.lineCount || undefined} value={form.bay} onChange={handleChange} required />
            </Field>
            <Field label="Row">
              <input className="input" name="row" type="number" min="1" max={selectedBlock?.rowCount || undefined} value={form.row} onChange={handleChange} required />
            </Field>
            <Field label="Tier">
              <input className="input" name="tier" type="number" min="1" max={selectedBlock?.tierCount || undefined} value={form.tier} onChange={handleChange} required />
            </Field>
          </div>

          {slots.length > 0 && (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Unavailable slots in selected block</div>
              <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {slots.slice(0, 80).map((slot) => {
                  const isCurrent = slot.key === currentSlotKey
                  return (
                    <span key={`${slot.key}-${slot.reference}`} className={`rounded-full px-3 py-1 text-xs font-black ${isCurrent ? "bg-emerald-50 text-emerald-700" : slot.type === "occupied" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                      B{slot.bay} R{slot.row} T{slot.tier}{isCurrent ? " • current" : ""}
                    </span>
                  )
                })}
                {slots.length > 80 && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">+{slots.length - 80} more</span>}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save New Location"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const AdminInventory = () => {
  const [areas, setAreas] = useState([])
  const [containers, setContainers] = useState([])
  const [summary, setSummary] = useState(null)
  const [selectedAreaId, setSelectedAreaId] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState({ type: "", message: "" })

  const [modalOpen, setModalOpen] = useState(false)
  const [editingContainer, setEditingContainer] = useState(null)
  const [locationForm, setLocationForm] = useState({ areaId: "", blockId: "", bay: 1, row: 1, tier: 1 })
  const [modalBlocks, setModalBlocks] = useState([])
  const [modalSlots, setModalSlots] = useState([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)

  const bookingContainers = useMemo(() => {
    return containers
      .filter((container) => container.source === "booking" && bookingStatusesForInventory.includes(container.bookingStatus))
      .sort((a, b) => getInventoryEnteredTime(b) - getInventoryEnteredTime(a))
  }, [containers])


  useClickOutside(filterRef, () => setShowFilters(false), showFilters);
  const filteredContainers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return bookingContainers.filter((container) => {
      const matchesArea = !selectedAreaId || container.area === selectedAreaId
      const matchesStatus = selectedStatus === "all" || container.bookingStatus === selectedStatus
      const matchesSearch = !term || [container.containerNumber, container.bookingReference, container.clientName, container.areaName, container.blockCode, container.blockName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
      return matchesArea && matchesStatus && matchesSearch
    })
  }, [bookingContainers, selectedAreaId, selectedStatus, search])

  const containerPagination = usePagination(
    filteredContainers,
    10,
    `${selectedAreaId}|${selectedStatus}|${search}`,
  )

  const waitingForStorage = bookingContainers.filter((container) => container.bookingStatus === "gate_in_approved")
  const storedContainers = bookingContainers.filter((container) => ["stored_in_assigned_area", "gate_out_requested", "gate_out_approved"].includes(container.bookingStatus))
  const assignedTeu = bookingContainers.reduce((sum, container) => sum + getTeu(container.containerSize), 0)

  const loadAreas = async () => {
    const { data } = await api.get("/admin/inventory/areas")
    setAreas(data.areas || [])
  }

  const loadSummary = async () => {
    const { data } = await api.get("/admin/inventory/summary")
    setSummary(data.summary || null)
  }

  const loadContainers = async () => {
    const { data } = await api.get("/admin/inventory/containers")
    setContainers(data.containers || [])
  }

  const loadAll = async () => {
    try {
      setLoading(true)
      setAlert({ type: "", message: "" })
      await Promise.all([loadAreas(), loadSummary(), loadContainers()])
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    const handleRealtime = (event) => {
      const eventType = event.detail?.type || ""
      if (!eventType.startsWith("booking:") && !eventType.startsWith("inventory:") && !eventType.startsWith("storage:") && !eventType.startsWith("yard:")) return
      loadAll()
    }

    window.addEventListener("otli:realtime", handleRealtime)
    return () => window.removeEventListener("otli:realtime", handleRealtime)
  }, [])

  const loadBlocksForArea = async (areaId) => {
    if (!areaId) {
      setModalBlocks([])
      return []
    }

    setLoadingBlocks(true)
    try {
      const { data } = await api.get(`/admin/inventory/areas/${areaId}/blocks`)
      const nextBlocks = data.blocks || []
      setModalBlocks(nextBlocks)
      return nextBlocks
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
      setModalBlocks([])
      return []
    } finally {
      setLoadingBlocks(false)
    }
  }

  const loadBlockSlots = async (blockId) => {
    if (!blockId) {
      setModalSlots([])
      return
    }

    try {
      const { data } = await api.get(`/admin/inventory/blocks/${blockId}/slots`)
      setModalSlots(data.slots || [])
    } catch (error) {
      setModalSlots([])
      setAlert({ type: "error", message: getApiError(error) })
    }
  }

  const openLocationModal = async (container) => {
    setEditingContainer(container)
    setModalOpen(true)
    setModalSlots([])
    setLocationForm({
      areaId: container.area || "",
      blockId: container.block || "",
      bay: container.bay || 1,
      row: container.row || 1,
      tier: container.tier || 1,
    })

    const nextBlocks = await loadBlocksForArea(container.area || "")
    if (container.block && nextBlocks.some((block) => block.id === container.block)) {
      await loadBlockSlots(container.block)
    }
  }

  const closeLocationModal = () => {
    setModalOpen(false)
    setEditingContainer(null)
    setModalBlocks([])
    setModalSlots([])
    setLocationForm({ areaId: "", blockId: "", bay: 1, row: 1, tier: 1 })
  }

  const handleModalAreaChange = async (areaId) => {
    setLocationForm((current) => ({ ...current, areaId, blockId: "", bay: 1, row: 1, tier: 1 }))
    setModalSlots([])
    await loadBlocksForArea(areaId)
  }

  const handleModalBlockChange = async (blockId) => {
    const block = modalBlocks.find((item) => item.id === blockId)
    setLocationForm((current) => ({ ...current, blockId, bay: 1, row: 1, tier: 1 }))
    if (block) await loadBlockSlots(blockId)
  }

  const handleLocationSubmit = async (event) => {
    event.preventDefault()
    if (!editingContainer) return

    try {
      setSavingLocation(true)
      setAlert({ type: "", message: "" })
      await api.patch(`/admin/bookings/${editingContainer.id}/relocate`, {
        areaId: locationForm.areaId,
        blockId: locationForm.blockId,
        bay: Number(locationForm.bay),
        row: Number(locationForm.row),
        tier: Number(locationForm.tier),
      })
      setAlert({ type: "success", message: "Container location updated successfully." })
      closeLocationModal()
      await loadAll()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSavingLocation(false)
    }
  }

  const handleMarkStored = async (container) => {
    if (container.bookingStatus !== "gate_in_approved") return

    try {
      setAlert({ type: "", message: "" })
      await api.patch(`/admin/bookings/${container.id}/store`)
      setAlert({ type: "success", message: "Container marked as stored. Billing was computed and it is now visible in Storage Monitoring." })
      await loadAll()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Inventory Module</div>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Gate-In Container Inventory</h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
              Containers appear here immediately after Gate-In approval. The most recently accepted Gate-In record is shown first.
            </p>
          </div>
          <button type="button" onClick={loadAll} className="btn-secondary shrink-0" disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Area Capacity" value={`${summary?.totalAreaCapacityTeu || 0} TEU`} icon={Warehouse} />
          <StatCard label="Inventory Containers" value={bookingContainers.length} icon={MapPin} />
          <StatCard label="Waiting Storage" value={waitingForStorage.length} icon={PackageCheck} />
          <StatCard label="Inventory TEU" value={Math.round(assignedTeu * 100) / 100} icon={CalendarClock} />
        </div>

        <div className="mt-4">
          <Alert type={alert.type}>{alert.message}</Alert>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Accepted Gate-In Inventory</h2>
            <p className="text-sm font-semibold text-slate-500">
              Search and filter containers before opening location or storage actions.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                className="input w-full !rounded-2xl !py-3 !pl-10 !pr-4 text-sm sm:w-[340px]"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search container, booking, client..."
              />
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
            </div>

            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                <SlidersHorizontal size={18} /> Filter
                <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs text-white">
                  {(selectedAreaId ? 1 : 0) + (selectedStatus !== "all" ? 1 : 0)}
                </span>
              </button>

              {showFilters && (
                <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">Inventory Filters</div>
                    <button
                      type="button"
                      className="text-xs font-black text-emerald-700"
                      onClick={() => {
                        setSelectedAreaId("")
                        setSelectedStatus("all")
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-4">
                    <Field label="Area">
                      <select className="input" value={selectedAreaId} onChange={(event) => setSelectedAreaId(event.target.value)}>
                        <option value="">All assigned areas</option>
                        {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select className="input" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
                        <option value="all">All inventory statuses</option>
                        {bookingStatusesForInventory.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
          Showing {filteredContainers.length} of {bookingContainers.length} Gate-In accepted containers • newest first
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Booking / Container</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Assigned Location</th>
                <th className="px-5 py-3">Size / Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Billing</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredContainers.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center font-bold text-slate-500">No Gate-In accepted containers found.</td>
                </tr>
              )}
              {containerPagination.paginatedItems.map((container) => {
                const canMarkStored = container.bookingStatus === "gate_in_approved"
                const canRelocate = ["approved_area_assigned", "gate_in_approved", "stored_in_assigned_area"].includes(container.bookingStatus)

                return (
                  <tr key={container.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="font-black text-slate-950">{container.containerNumber}</div>
                      <div className="text-xs font-semibold text-slate-500">{container.bookingReference}</div>
                      <div className="mt-1 text-xs font-bold text-emerald-700">Gate-In accepted: {formatDate(container.inventoryEnteredAt || container.gateInApprovedAt || container.storedAt)}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{container.clientName || "-"}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">
                      <div>{container.areaName || "No area"}</div>
                      <div className="text-xs text-slate-500">{container.blockCode || container.blockName || "No block"}</div>
                      <div className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">{container.slotNumber || "No slot"}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{container.containerSize}ft • {container.containerType?.replace("_", " ")}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(container.bookingStatus)}`}>{statusLabel[container.bookingStatus] || container.bookingStatus}</span></td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${billingClass(container.billingStatus)}`}>{billingLabel[container.billingStatus] || container.billingStatus}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        {canMarkStored && (
                          <button type="button" onClick={() => handleMarkStored(container)} className="btn-primary whitespace-nowrap">
                            <PackageCheck size={16} /> Mark Stored
                          </button>
                        )}
                        {canRelocate && (
                          <button type="button" onClick={() => openLocationModal(container)} className="btn-secondary whitespace-nowrap">
                            <Edit3 size={16} /> Edit Location
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...containerPagination} />
      </div>

      <LocationModal
        open={modalOpen}
        container={editingContainer}
        areas={areas}
        blocks={modalBlocks}
        slots={modalSlots}
        loadingBlocks={loadingBlocks}
        saving={savingLocation}
        onClose={closeLocationModal}
        onAreaChange={handleModalAreaChange}
        onBlockChange={handleModalBlockChange}
        onSubmit={handleLocationSubmit}
        form={locationForm}
        setForm={setLocationForm}
      />
    </div>
  )
}

export default AdminInventory
