import { useEffect, useMemo, useRef, useState } from "react"
import {
  Edit3,
  Layers3,
  MapPinned,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import { api, getApiError } from "../../lib/api"
import Pagination from "../../components/ui/Pagination"
import TableCrudActions from "../../components/ui/TableCrudActions"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"

const emptyAreaForm = {
  name: "",
  lineCount: 1,
  rowCount: 1,
  tierCount: 1,
  containerSize: 20,
  capacityTeu: 1,
  status: "active",
  color: "#087A55",
  description: "",
  isCongestionArea: false,
}

const areaStatuses = ["active", "inactive", "maintenance"]
const containerSizes = [20, 40]

const numberValue = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const getCapacityUnit = (containerSize) => Number(containerSize) === 20 ? "TEU" : "FEU"

const calculateAreaCapacity = (form) => {
  const bays = Math.max(numberValue(form.lineCount, 1), 1)
  const rows = Math.max(numberValue(form.rowCount, 1), 1)
  const tiers = Math.max(numberValue(form.tierCount, 1), 1)
  return Math.max(bays * rows * tiers, 1)
}

const normalizeDimensions = (form) => {
  const rows = Math.max(numberValue(form.rowCount, 1), 1)
  const tiers = Math.max(numberValue(form.tierCount, 1), 1)
  const capacity = Math.max(numberValue(form.capacityTeu, 1), 1)
  const minimumBays = Math.ceil(capacity / Math.max(rows * tiers, 1))
  const bays = Math.max(numberValue(form.lineCount, 1), minimumBays)
  return { bays, rows, tiers, capacity, boxCount: bays * rows * tiers }
}

const statusClass = (status) => {
  if (status === "active") return "bg-blue-100 text-blue-700"
  if (status === "maintenance") return "bg-amber-100 text-amber-700"
  if (status === "inactive") return "bg-red-100 text-red-700"
  return "bg-slate-100 text-slate-700"
}

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs font-semibold text-slate-400">{hint}</span>}
  </label>
)

const AdminYardAreas = () => {
  const [summary, setSummary] = useState({
    areaCount: 0,
    totalAreaCapacityTeu: 0,
    totalAreaCapacityFeu: 0,
    totalBoxes: 0,
    blockCount: 0,
  })
  const [areas, setAreas] = useState([])
  const [areaForm, setAreaForm] = useState(emptyAreaForm)
  const [editingAreaId, setEditingAreaId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [selectedStatuses, setSelectedStatuses] = useState(areaStatuses)
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [selectedArea, setSelectedArea] = useState(null)


  useClickOutside(filterRef, () => setShowFilters(false), showFilters);
  const autoCapacity = useMemo(
    () => calculateAreaCapacity(areaForm),
    [areaForm.lineCount, areaForm.rowCount, areaForm.tierCount, areaForm.containerSize],
  )

  const filteredAreas = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return areas.filter((area) => {
      const matchesSearch =
        !keyword ||
        [area.name, area.code, area.description, area.status, area.containerSize]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword))

      return matchesSearch && selectedStatuses.includes(area.status)
    })
  }, [areas, searchTerm, selectedStatuses])

  const areaPagination = usePagination(
    filteredAreas,
    10,
    `${searchTerm}-${selectedStatuses.join("|")}`,
  )

  const loadSummary = async () => {
    const { data } = await api.get("/admin/yard/summary")
    setSummary(
      data.summary || {
        areaCount: 0,
        totalAreaCapacityTeu: 0,
        totalAreaCapacityFeu: 0,
        totalBoxes: 0,
        blockCount: 0,
      },
    )
  }

  const loadAreas = async () => {
    const { data } = await api.get("/admin/yard/areas")
    setAreas(data.areas || [])
  }

  const loadAll = async () => {
    try {
      setLoading(true)
      setError("")
      await Promise.all([loadSummary(), loadAreas()])
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target

    setAreaForm((current) => {
      const next = { ...current, [name]: type === "checkbox" ? checked : value }

      if (
        ["lineCount", "rowCount", "tierCount"].includes(name)
      ) {
        next.capacityTeu = calculateAreaCapacity(next)
      }

      return next
    })
  }

  const resetForm = () => {
    setAreaForm(emptyAreaForm)
    setEditingAreaId("")
  }

  const closeAreaModal = () => {
    setShowAreaModal(false)
    resetForm()
  }

  const openCreateModal = () => {
    resetForm()
    setShowAreaModal(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const dimensions = normalizeDimensions(areaForm)
      const payload = {
        ...areaForm,
        lineCount: dimensions.bays,
        rowCount: dimensions.rows,
        tierCount: dimensions.tiers,
        containerSize: numberValue(areaForm.containerSize, 20),
        capacityTeu: dimensions.capacity,
      }

      if (editingAreaId) {
        await api.patch(`/admin/yard/areas/${editingAreaId}`, payload)
        setSuccess("Yard area updated successfully.")
      } else {
        await api.post("/admin/yard/areas", payload)
        setSuccess("Yard area created successfully.")
      }

      closeAreaModal()
      await loadAll()
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (area) => {
    setSelectedArea(null)
    setEditingAreaId(area.id)
    setAreaForm({
      name: area.name || "",
      lineCount: area.lineCount || 1,
      rowCount: area.rowCount || 1,
      tierCount: area.tierCount || 1,
      containerSize: area.containerSize || 20,
      capacityTeu: area.capacityTeu || 1,
      status: area.status || "active",
      color: area.color || "#087A55",
      description: area.description || "",
      isCongestionArea: Boolean(area.isCongestionArea),
    })
    setShowAreaModal(true)
  }

  const handleDelete = async (area) => {
    const confirmed = window.confirm(
      `Delete ${area.name}? Occupied areas cannot be removed. Empty blocks inside the area can be removed after a second confirmation.`,
    )
    if (!confirmed) return

    try {
      setError("")
      setSuccess("")
      try {
        await api.delete(`/admin/yard/areas/${area.id}`)
      } catch (err) {
        if (err?.response?.data?.canForceDelete) {
          const removeEmptyBlocks = window.confirm(`${err.response.data.message} Continue?`)
          if (!removeEmptyBlocks) return
          await api.delete(`/admin/yard/areas/${area.id}?force=true`)
        } else {
          throw err
        }
      }
      setSelectedArea(null)
      setSuccess("Yard area and its empty blocks were removed successfully.")
      await loadAll()
    } catch (err) {
      setError(getApiError(err))
    }
  }

  const toggleStatus = (status) => {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    )
  }

  const stats = [
    { label: "Total Areas", value: summary.areaCount || 0, icon: MapPinned, tone: "slate" },
    { label: "20 FT Capacity", value: `${summary.totalAreaCapacityTeu || 0} TEU`, icon: Warehouse, tone: "blue" },
    { label: "40 FT Capacity", value: `${summary.totalAreaCapacityFeu || 0} FEU`, icon: Layers3, tone: "orange" },
    { label: "Physical Boxes", value: summary.totalBoxes || 0, icon: Ruler, tone: "amber" },
  ]

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Yard Area Module</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Yard Area Setup</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Create and maintain the physical yard areas used for block placement, container assignment, and capacity monitoring.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={loadAll} className="btn-secondary" disabled={loading}>
              <RefreshCw size={17} /> Refresh
            </button>
            <button type="button" onClick={openCreateModal} className="btn-primary">
              <Plus size={17} /> Add Area
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <Alert type="error">{error}</Alert>
          <Alert type="success">{success}</Alert>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Configured Yard Areas</h3>
            <p className="text-sm font-semibold text-slate-500">
              Search, filter, and open an area before editing its dimensions or status.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                type="text"
                className="input w-full !rounded-2xl !py-3 !pl-10 !pr-4 text-sm sm:w-[320px]"
                placeholder="Search area, code, status..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
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
                <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs text-white">{selectedStatuses.length}</span>
              </button>

              {showFilters && (
                <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">Status Filter</div>
                    <button
                      type="button"
                      onClick={() => setSelectedStatuses(areaStatuses)}
                      className="text-xs font-black text-emerald-700"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-2">
                    {areaStatuses.map((status) => (
                      <label key={status} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                          className="h-4 w-4 accent-slate-950"
                        />
                        <span className="text-sm font-bold capitalize text-slate-700">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
          Showing {filteredAreas.length} of {areas.length} yard areas
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Dimensions</th>
                <th className="px-4 py-3">Container Size</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Blocks</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center font-bold text-slate-500">Loading areas...</td>
                </tr>
              )}

              {!loading && filteredAreas.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center font-bold text-slate-500">No yard areas found.</td>
                </tr>
              )}

              {areaPagination.paginatedItems.map((area) => (
                <tr key={area.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full shadow-sm" style={{ background: area.color }} />
                      <div>
                        <div className="font-black text-slate-950">{area.name}</div>
                        <div className="mt-1 text-xs font-black uppercase tracking-wide text-slate-500">{area.code || "No code"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {area.lineCount} bay × {area.rowCount} row × {area.tierCount} tier
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{area.containerSize} FT</td>
                  <td className="px-4 py-4 font-black text-slate-950">{area.capacityTeu} {area.capacityUnit || getCapacityUnit(area.containerSize)}</td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{area.blockCount || 0}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${area.isCongestionArea ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                      {area.isCongestionArea ? "Congestion Area" : "Regular Yard"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusClass(area.status)}`}>{area.status}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <TableCrudActions
                      recordLabel={area.name}
                      onView={() => setSelectedArea(area)}
                      onEdit={() => handleEdit(area)}
                      onDelete={() => handleDelete(area)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination {...areaPagination} />
      </div>

      {showAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Yard Area Form</div>
                <h3 className="mt-1 text-2xl font-black text-slate-950">{editingAreaId ? "Edit Yard Area" : "Create Yard Area"}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Set the physical dimensions, container size, and capacity.</p>
              </div>
              <ModalCloseButton onClick={closeAreaModal} label="Close yard area form" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <Field label="Area Name">
                <input className="input" name="name" value={areaForm.name} onChange={handleChange} placeholder="Alpha Yard" required />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Bay">
                  <input className="input" name="lineCount" type="number" min="1" value={areaForm.lineCount} onChange={handleChange} required />
                </Field>
                <Field label="Row">
                  <input className="input" name="rowCount" type="number" min="1" value={areaForm.rowCount} onChange={handleChange} required />
                </Field>
                <Field label="Tier">
                  <input className="input" name="tierCount" type="number" min="1" value={areaForm.tierCount} onChange={handleChange} required />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Container Size">
                  <select className="input" name="containerSize" value={areaForm.containerSize} onChange={handleChange}>
                    {containerSizes.map((size) => <option key={size} value={size}>{size} FT</option>)}
                  </select>
                </Field>
                <Field label={`Capacity (${getCapacityUnit(areaForm.containerSize)})`} hint={`Physical boxes: ${autoCapacity}. Bay automatically increases when capacity is higher than the box count.`}>
                  <input className="input" name="capacityTeu" type="number" min="1" step="0.01" value={areaForm.capacityTeu} onChange={handleChange} required />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status">
                  <select className="input" name="status" value={areaForm.status} onChange={handleChange}>
                    {areaStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </Field>
                <Field label="Color">
                  <input className="input h-[46px]" name="color" type="color" value={areaForm.color} onChange={handleChange} />
                </Field>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <input
                  type="checkbox"
                  name="isCongestionArea"
                  checked={areaForm.isCongestionArea}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 accent-amber-600"
                />
                <span>
                  <span className="block text-sm font-black text-amber-900">Designated congestion surcharge area</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-amber-700">
                    Containers are assigned here from the Pre-Advice module only when regular yard capacity is unavailable. The configured congestion surcharge is added automatically.
                  </span>
                </span>
              </label>

              <Field label="Notes">
                <textarea className="input min-h-28 resize-y" name="description" value={areaForm.description} onChange={handleChange} placeholder="Optional notes for this area." />
              </Field>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeAreaModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {editingAreaId ? <Edit3 size={17} /> : <Plus size={17} />}
                  {saving ? "Saving..." : editingAreaId ? "Update Area" : "Create Area"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Area Details</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="h-5 w-5 rounded-full" style={{ background: selectedArea.color }} />
                  <h3 className="text-2xl font-black text-slate-950">{selectedArea.name}</h3>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{selectedArea.code || "No code"}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusClass(selectedArea.status)}`}>{selectedArea.status}</span>
                </div>
              </div>
              <ModalCloseButton onClick={() => setSelectedArea(null)} label="Close yard area details" />
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Dimensions" value={`${selectedArea.lineCount} bay × ${selectedArea.rowCount} row × ${selectedArea.tierCount} tier`} />
              <Detail label="Container Size" value={`${selectedArea.containerSize} FT`} />
              <Detail label="Capacity" value={`${selectedArea.capacityTeu} ${selectedArea.capacityUnit || getCapacityUnit(selectedArea.containerSize)}`} />
              <Detail label="Physical Boxes" value={selectedArea.boxCount || calculateAreaCapacity(selectedArea)} />
              <Detail label="Inventory Blocks" value={selectedArea.blockCount || 0} />
              <Detail label="Area Purpose" value={selectedArea.isCongestionArea ? "Designated Congestion Area" : "Regular Yard Area"} />
              <Detail label="Status" value={selectedArea.status} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 lg:col-span-3">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">Notes</div>
                <div className="mt-1 text-sm font-bold leading-6 text-slate-800">{selectedArea.description || "No notes added."}</div>
              </div>
            </div>


          </div>
        </div>
      )}
    </div>
  )
}

const StatCard = ({ label, value, icon: Icon, tone }) => {
  const toneClass = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    orange: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  }[tone]

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-wide opacity-75">{label}</div>
          <div className="mt-2 text-3xl font-black">{value}</div>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/80 shadow-sm">
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

const Detail = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 text-sm font-bold text-slate-800">{value || "N/A"}</div>
  </div>
)

export default AdminYardAreas
