import { useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Globe2,
  MapPinned,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import Pagination from "../../components/ui/Pagination"
import TableCrudActions from "../../components/ui/TableCrudActions"
import TableLoadingRow from "../../components/ui/TableLoadingRow"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"
import { api, getApiError } from "../../lib/api"

const rateTypeOptions = [
  {
    value: "local",
    label: "Local Rates",
    shortLabel: "Local",
    description: "Configure Lift On, Lift Off, and Storage rates for local container transactions.",
    icon: MapPinned,
  },
  {
    value: "international",
    label: "International Rates",
    shortLabel: "International",
    description: "Configure Lift On, Lift Off, and Storage rates for international container transactions.",
    icon: Globe2,
  },
]

const chargeTypeOptions = [
  {
    value: "lift_on",
    label: "Lift On",
    description: "Handling charge applied when the container is lifted on.",
    billingDescription: "Lift On",
    loadSpecific: true,
  },
  {
    value: "lift_off",
    label: "Lift Off",
    description: "Handling charge applied when the container is lifted off.",
    billingDescription: "Lift Off",
    loadSpecific: true,
  },
  {
    value: "storage",
    label: "Storage",
    description: "Daily storage charge based on the billable storage days.",
    billingDescription: "Storage",
    loadSpecific: true,
  },
  {
    value: "total_handling",
    label: "Total Handling Reference",
    description: "Display-only reference rate retained for existing configurations.",
    billingDescription: "Total Handling per Container Cycle",
    loadSpecific: false,
  },
  {
    value: "congestion",
    label: "Congestion Surcharge",
    description: "Manual reference charge retained for existing configurations.",
    billingDescription: "Congestion Surcharge",
    loadSpecific: false,
  },
  {
    value: "other",
    label: "Other / Existing",
    description: "Use only for an existing custom rate that does not match the standard charge types.",
    billingDescription: "",
    loadSpecific: false,
  },
]

const coreChargeTypes = ["lift_on", "lift_off", "storage"]
const containerSizes = ["20", "40"]

const fallbackUnitLabels = {
  per_container: "per container",
  per_teu: "per 20 ft equivalent",
  per_day: "per day",
  storage_day: "per container/day",
  fixed: "fixed charge",
}

const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatDate = (value) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

const normalizeValue = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase()
const getUnitLabel = (rate) => rate?.unitLabel || fallbackUnitLabels[rate?.unit] || rate?.unit || "-"
const getRateType = (rate) => rate?.rateType === "international" ? "international" : "local"
const getRateTypeLabel = (rateType) => rateType === "international" ? "International" : "Local"
const getLoadStatus = (rate) => ["empty", "laden"].includes(rate?.loadStatus) ? rate.loadStatus : "all"
const getLoadStatusLabel = (status) => status === "empty" ? "Empty" : status === "laden" ? "Loaded" : "All load statuses"

const getChargeType = (rate) => {
  if (chargeTypeOptions.some((option) => option.value === rate?.chargeType)) return rate.chargeType
  const text = `${rate?.chargeCode || ""} ${rate?.description || ""}`.toLowerCase()
  if (/lift[_\s-]*(on|in)/.test(text)) return "lift_on"
  if (/lift[_\s-]*(off|out)/.test(text)) return "lift_off"
  if (/storage/.test(text)) return "storage"
  if (/total[_\s-]*handling/.test(text)) return "total_handling"
  if (/congestion/.test(text)) return "congestion"
  return "other"
}

const getChargeOption = (chargeType) => chargeTypeOptions.find((option) => option.value === chargeType) || chargeTypeOptions.at(-1)
const getChargeLabel = (chargeType) => getChargeOption(chargeType)?.label || "Other"
const isLoadSpecificCharge = (chargeType) => coreChargeTypes.includes(chargeType)

const getContainerSize = (rate) => {
  if (["20", "40"].includes(String(rate?.containerSize))) return String(rate.containerSize)
  const codeMatch = String(rate?.chargeCode || "").match(/(?:^|_)(20|40)(?:_|$)/)
  if (codeMatch?.[1]) return codeMatch[1]
  const unitMatch = getUnitLabel(rate).match(/\b(20|40)\b/)
  return unitMatch?.[1] || "all"
}

const getStandardUnit = (chargeType, containerSize) => {
  if (chargeType === "storage") return `per ${containerSize} ft container/day`
  return `per ${containerSize} ft container`
}

const getStandardDescription = (chargeType) => getChargeOption(chargeType)?.billingDescription || ""

const initialForm = {
  chargeType: "lift_on",
  containerSize: "20",
  loadStatus: "empty",
  description: "",
  unit: "",
  rateAmount: "",
}

const AdminRateSetup = () => {
  const [rates, setRates] = useState([])
  const [activeRateType, setActiveRateType] = useState("local")
  const [filters, setFilters] = useState({ search: "", chargeType: "all", containerSize: "all", loadStatus: "all" })
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

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  const ratesByType = useMemo(() => rates.reduce((counts, rate) => {
    counts[getRateType(rate)] += 1
    return counts
  }, { local: 0, international: 0 }), [rates])

  const selectedTypeRates = useMemo(
    () => rates.filter((rate) => getRateType(rate) === activeRateType),
    [activeRateType, rates],
  )

  const coreConfiguration = useMemo(() => coreChargeTypes.map((chargeType) => {
    const matching = selectedTypeRates.filter((rate) => getChargeType(rate) === chargeType)
    const explicitCount = (loadStatus) => containerSizes.filter((size) => matching.some((rate) => (
      getLoadStatus(rate) === loadStatus && getContainerSize(rate) === size
    ))).length
    const legacyFallbacks = matching.filter((rate) => getLoadStatus(rate) === "all").length

    return {
      chargeType,
      emptyCount: explicitCount("empty"),
      ladenCount: explicitCount("laden"),
      legacyFallbacks,
    }
  }), [selectedTypeRates])

  const filteredRates = useMemo(() => {
    const term = filters.search.trim().toLowerCase()
    return selectedTypeRates.filter((rate) => {
      const chargeType = getChargeType(rate)
      const size = getContainerSize(rate)
      const loadStatus = getLoadStatus(rate)
      const matchesSearch = !term || [
        rate.description,
        rate.chargeCode,
        getChargeLabel(chargeType),
        getUnitLabel(rate),
        loadStatus === "laden" ? "loaded" : loadStatus,
        size,
      ].some((value) => String(value || "").toLowerCase().includes(term))
      const matchesCharge = filters.chargeType === "all" || chargeType === filters.chargeType
      const matchesSize = filters.containerSize === "all" || size === filters.containerSize
      const matchesLoad = filters.loadStatus === "all" || loadStatus === filters.loadStatus
      return matchesSearch && matchesCharge && matchesSize && matchesLoad
    })
  }, [filters, selectedTypeRates])

  const pagination = usePagination(
    filteredRates,
    10,
    `${activeRateType}|${filters.search}|${filters.chargeType}|${filters.containerSize}|${filters.loadStatus}`,
  )

  const selectRateType = (rateType) => {
    setActiveRateType(rateType)
    setFilters({ search: "", chargeType: "all", containerSize: "all", loadStatus: "all" })
    setShowFilters(false)
  }

  const openAdd = (preset = {}) => {
    const chargeType = preset.chargeType || "lift_on"
    setEditingRate(null)
    setForm({
      ...initialForm,
      chargeType,
      containerSize: preset.containerSize || "20",
      loadStatus: preset.loadStatus || (isLoadSpecificCharge(chargeType) ? "empty" : "all"),
    })
    setFormError("")
    setModalOpen(true)
  }

  const openEdit = (rate) => {
    const rateType = getRateType(rate)
    const chargeType = getChargeType(rate)
    setActiveRateType(rateType)
    setEditingRate(rate)
    setForm({
      chargeType,
      containerSize: getContainerSize(rate) === "all" ? "20" : getContainerSize(rate),
      loadStatus: getLoadStatus(rate),
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

    const rateType = editingRate ? getRateType(editingRate) : activeRateType
    const chargeType = form.chargeType
    const standardCharge = chargeType !== "other"
    const loadStatus = isLoadSpecificCharge(chargeType)
      ? (form.loadStatus === "laden" ? "laden" : form.loadStatus === "all" && editingRate ? "all" : "empty")
      : "all"
    const containerSize = standardCharge ? form.containerSize : (getContainerSize(editingRate) === "all" ? "all" : form.containerSize)
    const description = standardCharge ? getStandardDescription(chargeType) : form.description.trim()
    const unit = standardCharge ? getStandardUnit(chargeType, containerSize) : form.unit.trim()
    const rateAmount = Number(form.rateAmount)

    if (!description || !unit || !Number.isFinite(rateAmount) || rateAmount <= 0) {
      setFormError("Please complete the charge configuration and enter a valid Rate (PHP).")
      return
    }

    if (isLoadSpecificCharge(chargeType) && !["empty", "laden", "all"].includes(loadStatus)) {
      setFormError("Choose Empty or Loaded for this charge.")
      return
    }

    const duplicateRate = rates.find((rate) => {
      if (editingRate && rate.id === editingRate.id) return false
      if (getRateType(rate) !== rateType) return false

      if (chargeType === "other") {
        return normalizeValue(rate.description) === normalizeValue(description)
          && normalizeValue(getUnitLabel(rate)) === normalizeValue(unit)
          && getLoadStatus(rate) === loadStatus
      }

      return getChargeType(rate) === chargeType
        && getContainerSize(rate) === containerSize
        && getLoadStatus(rate) === loadStatus
    })

    if (duplicateRate) {
      setFormError(`A ${getRateTypeLabel(rateType).toLowerCase()} ${getLoadStatusLabel(loadStatus).toLowerCase()} ${getChargeLabel(chargeType).toLowerCase()} rate already exists for ${containerSize}ft containers.`)
      return
    }

    const payload = {
      description,
      unitLabel: unit,
      containerSize,
      rateAmount,
      rateType,
      loadStatus,
    }

    try {
      setSaving(true)
      setFormError("")
      setAlert({ type: "", message: "" })
      if (editingRate) await api.patch(`/admin/billing-rates/${editingRate.id}`, payload)
      else await api.post("/admin/billing-rates", payload)
      setAlert({
        type: "success",
        message: editingRate
          ? `${getRateTypeLabel(rateType)} ${getChargeLabel(chargeType)} rate saved as a new version.`
          : `${getRateTypeLabel(rateType)} ${getChargeLabel(chargeType)} rate added.`,
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
    const chargeLabel = getChargeLabel(getChargeType(rate))
    if (!window.confirm(`Deactivate this ${rateTypeLabel.toLowerCase()} ${chargeLabel} rate? Historical transactions will remain unchanged.`)) return
    try {
      await api.delete(`/admin/billing-rates/${rate.id}`)
      setAlert({ type: "success", message: `${rateTypeLabel} ${chargeLabel} rate deactivated.` })
      await loadRates()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    }
  }

  const activeRateTypeLabel = getRateTypeLabel(activeRateType)
  const selectedChargeOption = getChargeOption(form.chargeType)
  const standardCharge = form.chargeType !== "other"
  const formUnit = standardCharge ? getStandardUnit(form.chargeType, form.containerSize) : form.unit
  const formDescription = standardCharge ? getStandardDescription(form.chargeType) : form.description
  const showLegacyLoadFallback = Boolean(editingRate && isLoadSpecificCharge(form.chargeType) && getLoadStatus(editingRate) === "all")

  return (
    <div className="space-y-6">
      <Alert type={alert.type}>{alert.message}</Alert>

      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Billing Management</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Rate Setup</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
              Maintain separate Local and International rates for Lift On, Lift Off, and Storage. Each charge can have independent Empty and Loaded rates for 20ft and 40ft containers.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={loadRates} className="btn-secondary shrink-0" disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={() => openAdd()} className="btn-primary shrink-0">
              <Plus size={18} /> Add {activeRateTypeLabel} Rate
            </button>
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
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${selected ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                      <Icon size={22} />
                    </span>
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black text-slate-950">{option.label}</span>
                        {selected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white"><CheckCircle2 size={12} /> Selected</span>}
                      </span>
                      <span className="mt-1 block text-sm font-semibold leading-5 text-slate-500">{option.description}</span>
                    </span>
                  </div>
                  <span className={`shrink-0 rounded-xl px-3 py-2 text-xl font-black ${selected ? "bg-white text-emerald-700 shadow-sm" : "bg-slate-100 text-slate-700"}`}>{ratesByType[option.value]}</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{activeRateTypeLabel} Core Rate Matrix</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Lift On, Lift Off, and Storage</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Each Empty and Loaded classification should have both a 20ft and 40ft rate.</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-800">
              Existing “All load statuses” rates remain fallback rates only. New specific rates take priority without changing previous transactions.
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {coreConfiguration.map((item) => (
              <div key={item.chargeType} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{getChargeLabel(item.chargeType)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Separate by load status and container size</p>
                  </div>
                  <button type="button" onClick={() => openAdd({ chargeType: item.chargeType })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 hover:border-emerald-300">Configure</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MatrixStatus label="Empty" count={item.emptyCount} />
                  <MatrixStatus label="Loaded" count={item.ladenCount} />
                </div>
                {item.legacyFallbacks > 0 && <p className="mt-3 text-[11px] font-bold text-amber-700">{item.legacyFallbacks} legacy fallback rate{item.legacyFallbacks === 1 ? "" : "s"} still active.</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-xl">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-11"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder={`Search ${activeRateTypeLabel.toLowerCase()} rates`}
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button type="button" onClick={() => setShowFilters((current) => !current)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:w-auto">
              <SlidersHorizontal size={18} /> Filters
            </button>
            {showFilters && (
              <div className="absolute right-0 z-40 mt-2 w-[310px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <p className="text-sm font-black text-slate-950">Filter Rates</p>
                  <button type="button" onClick={() => setFilters((current) => ({ ...current, chargeType: "all", containerSize: "all", loadStatus: "all" }))} className="text-xs font-black text-emerald-700">Reset</button>
                </div>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Charge Type</span>
                  <select className="input !py-3" value={filters.chargeType} onChange={(event) => setFilters((current) => ({ ...current, chargeType: event.target.value }))}>
                    <option value="all">All charge types</option>
                    {chargeTypeOptions.filter((option) => option.value !== "other").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    <option value="other">Other / Existing</option>
                  </select>
                </label>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Container Size</span>
                  <select className="input !py-3" value={filters.containerSize} onChange={(event) => setFilters((current) => ({ ...current, containerSize: event.target.value }))}>
                    <option value="all">All sizes</option>
                    <option value="20">20ft</option>
                    <option value="40">40ft</option>
                  </select>
                </label>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Container Load</span>
                  <select className="input !py-3" value={filters.loadStatus} onChange={(event) => setFilters((current) => ({ ...current, loadStatus: event.target.value }))}>
                    <option value="all">All load statuses</option>
                    <option value="empty">Empty</option>
                    <option value="laden">Loaded</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
          Showing {filteredRates.length} of {selectedTypeRates.length} {activeRateTypeLabel.toLowerCase()} rates
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1020px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Charge</th>
                <th className="px-5 py-4">Container Load</th>
                <th className="px-5 py-4">Size</th>
                <th className="px-5 py-4">Unit</th>
                <th className="px-5 py-4">Rate (PHP)</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rates.length === 0 && <TableLoadingRow colSpan={6} rows={6} actionColumn label="Loading billing rates" />}
              {pagination.paginatedItems.map((rate) => {
                const chargeType = getChargeType(rate)
                const loadStatus = getLoadStatus(rate)
                const size = getContainerSize(rate)
                return (
                  <tr key={rate.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-950">{getChargeLabel(chargeType)}</p>
                      {chargeType === "other" && <p className="mt-1 text-xs font-semibold text-slate-500">{rate.description}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${loadStatus === "empty" ? "bg-sky-100 text-sky-700" : loadStatus === "laden" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                        {getLoadStatusLabel(loadStatus)}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-black text-slate-800">{size === "all" ? "All sizes" : `${size}ft`}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{getUnitLabel(rate)}</td>
                    <td className="px-5 py-4 text-lg font-black text-slate-950">{formatMoney(rate.rateAmount)}</td>
                    <td className="px-5 py-4">
                      <TableCrudActions
                        recordLabel={`${getRateTypeLabel(getRateType(rate))} ${getChargeLabel(chargeType)} rate`}
                        onView={() => setSelectedRate(rate)}
                        onEdit={() => openEdit(rate)}
                        onDelete={() => deleteRate(rate)}
                      />
                    </td>
                  </tr>
                )
              })}
              {!loading && filteredRates.length === 0 && <tr><td colSpan="6" className="px-5 py-16 text-center font-semibold text-slate-500">No {activeRateTypeLabel.toLowerCase()} billing rates found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </section>

      {selectedRate && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Billing Rate Details</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{getChargeLabel(getChargeType(selectedRate))}</h2>
              </div>
              <ModalCloseButton onClick={() => setSelectedRate(null)} label="Close billing rate details" />
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Detail label="Rate Group" value={getRateTypeLabel(getRateType(selectedRate))} />
              <Detail label="Charge Type" value={getChargeLabel(getChargeType(selectedRate))} />
              <Detail label="Container Load" value={getLoadStatusLabel(getLoadStatus(selectedRate))} />
              <Detail label="Container Size" value={getContainerSize(selectedRate) === "all" ? "All sizes" : `${getContainerSize(selectedRate)}ft`} />
              <Detail label="Unit" value={getUnitLabel(selectedRate)} />
              <Detail label="Rate" value={`PHP ${formatMoney(selectedRate.rateAmount)}`} />
              <Detail label="Rate Version" value={`Version ${selectedRate.version || 1}`} />
              <Detail label="Effective From" value={formatDate(selectedRate.effectiveDate)} />
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={submitRate} className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{activeRateTypeLabel} Rate Setup</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{editingRate ? `Edit ${activeRateTypeLabel} Rate` : `Add ${activeRateTypeLabel} Rate`}</h2>
                <p className="mt-1 text-sm text-slate-500">Configure the charge, Empty/Loaded classification, container size, and amount independently.</p>
              </div>
              <ModalCloseButton onClick={closeModal} label="Close rate form" />
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">Rate Group: {activeRateTypeLabel}</div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Charge Type</span>
                  <select
                    className="input"
                    value={form.chargeType}
                    onChange={(event) => {
                      const chargeType = event.target.value
                      setForm((current) => ({
                        ...current,
                        chargeType,
                        loadStatus: isLoadSpecificCharge(chargeType) ? (current.loadStatus === "laden" ? "laden" : "empty") : "all",
                      }))
                      setFormError("")
                    }}
                    disabled={Boolean(editingRate && form.chargeType === "other")}
                  >
                    {chargeTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <span className="mt-1.5 block text-xs font-semibold text-slate-400">{selectedChargeOption.description}</span>
                </label>

                {isLoadSpecificCharge(form.chargeType) ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Container Load</span>
                    <select className="input" value={form.loadStatus} onChange={(event) => { setForm((current) => ({ ...current, loadStatus: event.target.value })); setFormError("") }}>
                      <option value="empty">Empty container</option>
                      <option value="laden">Loaded container</option>
                      {showLegacyLoadFallback && <option value="all">All load statuses (legacy fallback)</option>}
                    </select>
                  </label>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Container Load</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">All load statuses</p>
                  </div>
                )}

                {form.chargeType !== "other" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Container Size</span>
                    <select className="input" value={form.containerSize} onChange={(event) => { setForm((current) => ({ ...current, containerSize: event.target.value })); setFormError("") }}>
                      <option value="20">20ft container</option>
                      <option value="40">40ft container</option>
                    </select>
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Container Size</span>
                    <select className="input" value={form.containerSize} onChange={(event) => setForm((current) => ({ ...current, containerSize: event.target.value }))}>
                      <option value="20">20ft container</option>
                      <option value="40">40ft container</option>
                      <option value="all">All sizes</option>
                    </select>
                  </label>
                )}
              </div>

              {form.chargeType === "other" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Description</span>
                    <input className="input" value={form.description} onChange={(event) => { setForm((current) => ({ ...current, description: event.target.value })); setFormError("") }} required />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Unit</span>
                    <input className="input" value={form.unit} onChange={(event) => { setForm((current) => ({ ...current, unit: event.target.value })); setFormError("") }} required />
                  </label>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Billing Description</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{formDescription || "Custom rate"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{formUnit || "Custom unit"}</p>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Rate (PHP)</span>
                  <input className="input" type="number" min="0.01" step="0.01" value={form.rateAmount} onChange={(event) => { setForm((current) => ({ ...current, rateAmount: event.target.value })); setFormError("") }} placeholder="0.00" required />
                </label>
              </div>

              {editingRate && <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-800">Saving an edit creates a new effective rate version. Existing and previous transactions keep the exact rate snapshot that was used when they were billed.</div>}
              {formError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{formError}</div>}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeModal} className="btn-secondary" disabled={saving}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : editingRate ? "Save New Rate Version" : `Add ${activeRateTypeLabel} Rate`}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const MatrixStatus = ({ label, count }) => {
  const complete = count === containerSizes.length
  return (
    <div className={`rounded-xl border px-3 py-2 ${complete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-black ${complete ? "text-emerald-800" : "text-amber-800"}`}>{label}</span>
        <span className={`text-xs font-black ${complete ? "text-emerald-700" : "text-amber-700"}`}>{count}/2</span>
      </div>
      <p className={`mt-1 text-[10px] font-bold ${complete ? "text-emerald-600" : "text-amber-600"}`}>{complete ? "20ft and 40ft configured" : "Complete both sizes"}</p>
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
