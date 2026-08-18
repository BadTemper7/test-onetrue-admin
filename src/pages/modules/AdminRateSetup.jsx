import { useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Globe2,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import Pagination from "../../components/ui/Pagination"
import TableCrudActions from "../../components/ui/TableCrudActions"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"
import { api, getApiError } from "../../lib/api"

const baseDescriptionOptions = [
  "Lift On",
  "Lift Off",
  "Total Handling per Container Cycle",
  "Storage",
  "Congestion Surcharge",
]

const getDescriptionOptions = (rateType) => rateType === "international"
  ? [...baseDescriptionOptions, "Documentation"]
  : baseDescriptionOptions

const unitSuggestions = [
  "per 20 ft container",
  "per 40 ft container",
  "per 20 ft container/day",
  "per 40 ft container/day",
  "per container",
  "per transaction",
  "fixed charge",
]

const fallbackUnitLabels = {
  per_container: "per container",
  per_teu: "per 20 ft equivalent",
  per_day: "per day",
  storage_day: "per container/day",
  fixed: "fixed charge",
}

const rateTypeOptions = [
  {
    value: "international",
    label: "International Rates",
    shortLabel: "International",
    description: "Configure charges applied to international container transactions.",
    icon: Globe2,
  },
  {
    value: "local",
    label: "Local Rates",
    shortLabel: "Local",
    description: "Configure charges applied to local container transactions.",
    icon: MapPinned,
  },
]

const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const getUnitLabel = (rate) => rate.unitLabel || fallbackUnitLabels[rate.unit] || rate.unit || "-"
const getRateType = (rate) => rate?.rateType === "international" ? "international" : "local"
const getRateTypeLabel = (rateType) => rateType === "international" ? "International" : "Local"
const normalizeValue = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase()

const initialForm = {
  description: "",
  unit: "",
  rateAmount: "",
}

const AdminRateSetup = () => {
  const [rates, setRates] = useState([])
  const [activeRateType, setActiveRateType] = useState("local")
  const [filters, setFilters] = useState({ search: "", unit: "all" })
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [form, setForm] = useState(initialForm)
  const [editingRate, setEditingRate] = useState(null)
  const [selectedRate, setSelectedRate] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [alert, setAlert] = useState({ type: "", message: "" })

  const loadRates = async () => {
    try {
      setLoading(true)
      const { data } = await api.get("/admin/billing-rates")
      setRates((data.rates || []).filter((rate) => rate.billingScope !== "optional_stripping_stuffing"))
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRates()
  }, [])

  const ratesByType = useMemo(() => {
    return rates.reduce((counts, rate) => {
      counts[getRateType(rate)] += 1
      return counts
    }, { local: 0, international: 0 })
  }, [rates])

  const selectedTypeRates = useMemo(() => {
    return rates.filter((rate) => getRateType(rate) === activeRateType)
  }, [activeRateType, rates])

  const availableUnits = useMemo(() => {
    return [...new Set(selectedTypeRates.map(getUnitLabel).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  }, [selectedTypeRates])

  const filteredRates = useMemo(() => {
    const term = filters.search.trim().toLowerCase()
    return selectedTypeRates.filter((rate) => {
      const unitLabel = getUnitLabel(rate)
      const matchesSearch = !term || [rate.description, unitLabel]
        .some((value) => String(value || "").toLowerCase().includes(term))
      const matchesUnit = filters.unit === "all" || unitLabel === filters.unit
      return matchesSearch && matchesUnit
    })
  }, [filters, selectedTypeRates])

  const pagination = usePagination(
    filteredRates,
    10,
    `${activeRateType}|${filters.search}|${filters.unit}`,
  )

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  const selectRateType = (rateType) => {
    setActiveRateType(rateType)
    setFilters({ search: "", unit: "all" })
    setShowFilters(false)
  }

  const openAdd = () => {
    setEditingRate(null)
    setForm(initialForm)
    setFormError("")
    setModalOpen(true)
  }

  const openEdit = (rate) => {
    const rateType = getRateType(rate)
    setActiveRateType(rateType)
    setEditingRate(rate)
    setForm({
      description: rate.description || "",
      unit: getUnitLabel(rate),
      rateAmount: String(rate.rateAmount ?? ""),
    })
    setFormError("")
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditingRate(null)
    setForm(initialForm)
    setFormError("")
  }

  const submitRate = async (event) => {
    event.preventDefault()

    const description = form.description.trim()
    const unit = form.unit.trim()
    const rateAmount = Number(form.rateAmount)
    const rateType = editingRate ? getRateType(editingRate) : activeRateType

    if (!description || !unit || !Number.isFinite(rateAmount) || rateAmount <= 0) {
      setFormError("Please complete Description, Unit, and a valid Rate (PHP).")
      return
    }

    const duplicateRate = rates.find((rate) => {
      if (editingRate && rate.id === editingRate.id) return false
      return getRateType(rate) === rateType
        && normalizeValue(rate.description) === normalizeValue(description)
        && normalizeValue(getUnitLabel(rate)) === normalizeValue(unit)
    })

    if (duplicateRate) {
      setFormError(`A ${getRateTypeLabel(rateType).toLowerCase()} rate with the same Description and Unit already exists.`)
      return
    }

    const payload = { description, unitLabel: unit, rateAmount, rateType }

    try {
      setSaving(true)
      setFormError("")
      setAlert({ type: "", message: "" })
      if (editingRate) await api.patch(`/admin/billing-rates/${editingRate.id}`, payload)
      else await api.post("/admin/billing-rates", payload)
      setAlert({
        type: "success",
        message: editingRate
          ? `${getRateTypeLabel(rateType)} billing rate updated.`
          : `${getRateTypeLabel(rateType)} billing rate added.`,
      })
      setModalOpen(false)
      setEditingRate(null)
      setForm(initialForm)
      await loadRates()
    } catch (error) {
      const message = getApiError(error)
      setFormError(message)
      setAlert({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const deleteRate = async (rate) => {
    const rateTypeLabel = getRateTypeLabel(getRateType(rate))
    if (!window.confirm(`Delete ${rateTypeLabel.toLowerCase()} rate ${rate.description}?`)) return
    try {
      await api.delete(`/admin/billing-rates/${rate.id}`)
      setAlert({ type: "success", message: `${rateTypeLabel} billing rate deleted.` })
      await loadRates()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    }
  }

  const activeRateTypeLabel = getRateTypeLabel(activeRateType)
  const descriptionOptions = getDescriptionOptions(activeRateType)

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Billing Management</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Rate Setup</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Select International or Local Rates, then maintain the charges shown on the client site and used by automatic billing.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={loadRates} className="btn-secondary shrink-0" disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
            <button type="button" onClick={openAdd} className="btn-primary shrink-0"><Plus size={18} /> Add {activeRateTypeLabel} Rate</button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {rateTypeOptions.map((option) => {
            const Icon = option.icon
            const selected = activeRateType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => selectRateType(option.value)}
                aria-pressed={selected}
                className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${selected
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${selected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700"}`}>
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-950">{option.label}</h3>
                        {selected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white"><CheckCircle2 size={12} /> Selected</span>}
                      </div>
                      <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{option.description}</p>
                    </div>
                  </div>
                  <div className={`shrink-0 rounded-xl px-3 py-2 text-xl font-black ${selected ? "bg-white text-emerald-700 shadow-sm" : "bg-slate-100 text-slate-700"}`}>{ratesByType[option.value]}</div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      <section className="card overflow-visible">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h3 className="text-lg font-black text-slate-950">{activeRateTypeLabel} Rates</h3><p className="text-sm font-semibold text-slate-500">Search or filter the selected rate group before editing a record.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative" data-field-control><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="input w-full !rounded-2xl !py-3 !pl-10 !pr-4 text-sm sm:w-[340px]" placeholder={`Search ${activeRateTypeLabel.toLowerCase()} rates`} value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
            <div className="relative" ref={filterRef}>
              <button type="button" onClick={() => setShowFilters((current) => !current)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:w-auto"><SlidersHorizontal size={18} /> Filters</button>
              {showFilters && (
                <div className="absolute right-0 z-40 mt-2 w-[290px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3"><p className="text-sm font-black text-slate-950">Filter Rates</p><button type="button" onClick={() => setFilters((current) => ({ ...current, unit: "all" }))} className="text-xs font-black text-emerald-700">Reset</button></div>
                  <label className="mt-4 block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Unit</span><select className="input !py-3" value={filters.unit} onChange={(event) => setFilters((current) => ({ ...current, unit: event.target.value }))}><option value="all">All units</option>{availableUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">Showing {filteredRates.length} of {selectedTypeRates.length} {activeRateTypeLabel.toLowerCase()} rates</div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Description</th><th className="px-5 py-4">Unit</th><th className="px-5 py-4">Rate (PHP)</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.paginatedItems.map((rate) => (
                <tr key={rate.id} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-black text-slate-950">{rate.description}</td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{getUnitLabel(rate)}</td>
                  <td className="px-5 py-4 text-lg font-black text-slate-950">{formatMoney(rate.rateAmount)}</td>
                  <td className="px-5 py-4">
                    <TableCrudActions
                      recordLabel={`${getRateTypeLabel(getRateType(rate))} ${rate.description} rate`}
                      onView={() => setSelectedRate(rate)}
                      onEdit={() => openEdit(rate)}
                      onDelete={() => deleteRate(rate)}
                    />
                  </td>
                </tr>
              ))}
              {!loading && filteredRates.length === 0 && <tr><td colSpan="4" className="px-5 py-16 text-center font-semibold text-slate-500">No {activeRateTypeLabel.toLowerCase()} billing rates found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </section>


      {selectedRate && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Billing Rate Details</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedRate.description}</h2>
              </div>
              <ModalCloseButton onClick={() => setSelectedRate(null)} label="Close billing rate details" />
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Detail label="Rate Group" value={getRateTypeLabel(getRateType(selectedRate))} />
              <Detail label="Description" value={selectedRate.description} />
              <Detail label="Unit" value={getUnitLabel(selectedRate)} />
              <Detail label="Rate" value={`PHP ${formatMoney(selectedRate.rateAmount)}`} />
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={submitRate} className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{activeRateTypeLabel} Rate Setup</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{editingRate ? `Edit ${activeRateTypeLabel} Rate` : `Add ${activeRateTypeLabel} Rate`}</h2>
                <p className="mt-1 text-sm text-slate-500">Set the billing description, unit, and amount for the selected rate group.</p>
              </div>
              <ModalCloseButton onClick={closeModal} label="Close rate form" />
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">Rate Group: {activeRateTypeLabel}</div>
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Description</span><select className={`input ${formError ? "border-red-300 focus:border-red-500 focus:ring-red-100" : ""}`} value={form.description} onChange={(event) => { setForm((current) => ({ ...current, description: event.target.value })); setFormError("") }} aria-invalid={Boolean(formError)} required><option value="" disabled>Select a billing description</option>{descriptionOptions.map((description) => <option key={description} value={description}>{description}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Unit</span><input className="input" list="billing-unit-suggestions" value={form.unit} onChange={(event) => { setForm((current) => ({ ...current, unit: event.target.value })); setFormError("") }} placeholder="Example: per 20 ft container/day" required /><datalist id="billing-unit-suggestions">{unitSuggestions.map((unit) => <option key={unit} value={unit} />)}</datalist></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Rate (PHP)</span><input className="input" type="number" min="0.01" step="0.01" value={form.rateAmount} onChange={(event) => { setForm((current) => ({ ...current, rateAmount: event.target.value })); setFormError("") }} placeholder="0.00" required /></label>
              {formError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{formError}</div>}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={closeModal} className="btn-secondary" disabled={saving}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : editingRate ? "Save Changes" : `Add ${activeRateTypeLabel} Rate`}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}

const Detail = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 break-words text-sm font-bold text-slate-800">{value || "N/A"}</div>
  </div>
)

export default AdminRateSetup
