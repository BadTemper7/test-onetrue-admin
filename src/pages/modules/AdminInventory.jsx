import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Database, LogOut, MapPin, PackageCheck, Plus, RefreshCw, Search, SlidersHorizontal, Upload, Warehouse } from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import { api, getApiError, resolveFileUrl } from "../../lib/api"
import Pagination from "../../components/ui/Pagination"
import TableCrudActions from "../../components/ui/TableCrudActions"
import TableActionButton from "../../components/ui/TableActionButton"
import TableLoadingRow from "../../components/ui/TableLoadingRow"
import WorkflowDecisionPanel from "../../components/ui/WorkflowDecisionPanel"
import ContainerClassificationBadges from "../../components/ui/ContainerClassificationBadges"
import ContainerClassificationFilters from "../../components/ui/ContainerClassificationFilters"
import AvailableSlotPicker from "../../components/ui/AvailableSlotPicker"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"
import { useAuthStore } from "../../stores/authStore"
import { hasModulePermission } from "../../lib/permissions"

const DEFAULT_INVENTORY_STATUS = "gate_in_approved"

const bookingStatusesForInventory = [
  "gate_in_approved",
  "stored_in_assigned_area",
  "gate_out_requested",
  "gate_out_approved",
  "gate_out_reversal_requested",
]

const statusLabel = {
  approved_area_assigned: "Approved / Area Assigned",
  gate_in_approved: "Gate-In Approved",
  stored_in_assigned_area: "Stored in Assigned Area",
  gate_out_requested: "Gate-Out Requested",
  gate_out_approved: "Gate-Out Approved",
  gate_out_reversal_requested: "Gate-Out Reversal Requested",
  completed_gate_out_done: "Completed / Gate-Out Done",
}

const billingLabel = {
  unpaid: "Unpaid",
  payment_submitted: "Payment Submitted",
  payment_under_review: "Payment Under Review",
  payment_rejected: "Payment Rejected",
  additional_payment_required: "Additional Payment Required",
  paid_approved: "Paid / Approved",
}

const statusClass = (status) => {
  if (status === "gate_in_approved") return "bg-amber-50 text-amber-700"
  if (status === "stored_in_assigned_area") return "bg-blue-50 text-blue-700"
  if (["gate_out_requested", "gate_out_approved", "gate_out_reversal_requested"].includes(status)) return "bg-blue-50 text-blue-700"
  return "bg-slate-100 text-slate-700"
}

const billingClass = (status) => {
  if (status === "paid_approved") return "bg-blue-50 text-blue-700"
  if (status === "payment_under_review" || status === "payment_submitted") return "bg-amber-50 text-amber-700"
  if (status === "additional_payment_required") return "bg-amber-50 text-amber-700"
  if (status === "payment_rejected") return "bg-red-50 text-red-700"
  return "bg-slate-100 text-slate-700"
}

const formatDate = (value) => {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}


const getRequiredBlockCapacity = (containerSize, blockContainerSize) => {
  if (Number(blockContainerSize) === 20) return Number(containerSize) === 40 ? 2 : 1
  return Number(containerSize) === 20 ? 0.5 : 1
}

const blockHasContainerCapacity = (block, containerSize) => {
  if (!block) return false
  return Number(block.availableSlots || 0) >= getRequiredBlockCapacity(containerSize, block.containerSize)
}

const blockHasRelocationCapacity = (block, container) => {
  if (!block || !container) return false
  const required = getRequiredBlockCapacity(container.containerSize, block.containerSize)
  const currentCredit = String(block.id) === String(container.block || "") ? required : 0
  return Number(block.availableSlots || 0) + currentCredit >= required
}

const chooseAreaLocationBlock = ({ blocks = [], area, containerSize, container = null, preferredBlockId = "" }) => {
  const activeBlocks = blocks.filter((block) => (block.status || "active") === "active")
  const withCapacity = activeBlocks.filter((block) => container
    ? blockHasRelocationCapacity(block, container)
    : blockHasContainerCapacity(block, containerSize))

  if (preferredBlockId) {
    const preferred = withCapacity.find((block) => String(block.id) === String(preferredBlockId))
    if (preferred) return preferred
  }

  const areaCode = String(area?.code || "").trim().toLowerCase()
  const areaName = String(area?.name || "").trim().toLowerCase()
  return withCapacity.find((block) => areaCode && String(block.code || "").trim().toLowerCase() === areaCode)
    || withCapacity.find((block) => areaName && String(block.name || "").trim().toLowerCase() === areaName)
    || withCapacity[0]
    || null
}

const getPlacementKeys = ({ bay, row, tier, containerSize, blockContainerSize }) => {
  if (!bay || !row || !tier) return []
  const firstBay = Number(bay)
  const keys = [`${firstBay}-${Number(row)}-${Number(tier)}`]
  if (Number(containerSize) === 40 && Number(blockContainerSize) === 20) {
    keys.push(`${firstBay + 1}-${Number(row)}-${Number(tier)}`)
  }
  return keys
}

const getInventoryEnteredTime = (container) => {
  const value = container.inventoryEnteredAt
    || container.gateInApprovedAt
    || container.storedAt
    || container.storageStartDate
    || container.createdAt
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

const getAreaSlotLabel = (container) => {
  if (container?.bay && container?.row && container?.tier) {
    return `B${container.bay}-R${container.row}-T${container.tier}`
  }
  return container?.slotNumber || "No slot"
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

const LocationModal = ({ open, container, areas, blocks, slots, loadingBlocks, loadingSlots, saving, onClose, onAreaChange, onSubmit, form, setForm }) => {
  const selectedArea = areas.find((area) => area.id === form.areaId)
  const selectedBlock = blocks.find((block) => block.id === form.blockId)
  const isCurrentBlock = Boolean(selectedBlock && String(selectedBlock.id) === String(container?.block || ""))
  const selectedBlockHasCapacity = blockHasRelocationCapacity(selectedBlock, container)
  const ignoredUnavailableKeys = isCurrentBlock
    ? getPlacementKeys({
        bay: container?.bay,
        row: container?.row,
        tier: container?.tier,
        containerSize: container?.containerSize,
        blockContainerSize: selectedBlock?.containerSize,
      })
    : []
  const hasSelectedSlot = Boolean(form.areaId && form.blockId && form.bay && form.row && form.tier)

  if (!open || !container) return null

  return (
    <div className="fixed inset-0 z-[9998] grid place-items-center bg-slate-950/[0.55] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
              <MapPin size={14} /> Relocate Container
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">{container.containerNumber}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Current location: {container.areaName || "No area"} / {getAreaSlotLabel(container)}
            </p>
          </div>
          <ModalCloseButton onClick={onClose} label="Close location form" />
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-5">
          <Field label="Yard Area" hint="Choose an area and the system will show all available Bay, Row, and Tier positions.">
            <select className="input" name="areaId" value={form.areaId} onChange={(event) => onAreaChange(event.target.value)} required>
              <option value="">Select area</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.name} • {area.availableSlots ?? 0} TEU available</option>
              ))}
            </select>
          </Field>

          {form.areaId && loadingBlocks && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-600">
              Loading available slots for this yard area...
            </div>
          )}

          {selectedBlock && !loadingBlocks && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
              {selectedArea?.name || "Selected yard area"}: Bay {selectedBlock.bayCount || selectedBlock.lineCount || 1}, Row {selectedBlock.rowCount || 1}, Tier {selectedBlock.tierCount || 1}. {hasSelectedSlot ? `Selected location: B${form.bay}-R${form.row}-T${form.tier}.` : "Choose an available slot below."}
            </div>
          )}

          {form.areaId && !loadingBlocks && selectedBlock && (
            <AvailableSlotPicker
              block={selectedBlock}
              unavailableSlots={slots}
              containerSize={container.containerSize}
              selectedBay={form.bay}
              selectedRow={form.row}
              selectedTier={form.tier}
              ignoredUnavailableKeys={ignoredUnavailableKeys}
              loading={loadingSlots}
              disabled={!selectedBlockHasCapacity}
              emptyMessage="No available slot can fit this container in the selected yard area. Choose another area."
              onSelect={(slot) => setForm((current) => ({ ...current, bay: slot.bay, row: slot.row, tier: slot.tier }))}
            />
          )}

          {form.areaId && !loadingBlocks && !selectedBlock && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
              No available slot can fit this container in the selected yard area. Choose another area.
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !hasSelectedSlot}>{saving ? "Saving..." : "Save New Location"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


const legacyConditionOptions = ["GOOD", "DENTED", "RUST", "HOLE", "DOOR DAMAGE", "OTHER"]

const createLegacyForm = () => ({
  clientId: "",
  containerNumber: "",
  containerSize: "20",
  containerType: "dry",
  containerLoadStatus: "empty",
  rateType: "local",
  shippingLine: "",
  sealNumber: "",
  sealIntact: "",
  gateInConditions: ["GOOD"],
  gateInConditionOther: "",
  inspectionRemarks: "",
  truckPlateNumber: "",
  driverName: "",
  driverLicenseNumber: "",
  hauler: "",
  scheduledDateIn: new Date().toISOString().slice(0, 10),
  scheduledTimeIn: new Date().toTimeString().slice(0, 5),
  historicalSourceReference: "",
  legacyRegistrationReason: "Existing container was already stored before the OTLI system was implemented.",
  areaId: "",
  blockId: "",
  bay: "",
  row: "",
  tier: "",
  billingStartMethod: "historical_gate_in",
  isVatApplicable: "true",
  openingBalanceAmount: "0",
  openingCreditAmount: "0",
})

const LegacyContainerModal = ({ open, areas, onClose, onCreated }) => {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(createLegacyForm)
  const [clients, setClients] = useState([])
  const [blocks, setBlocks] = useState([])
  const [slots, setSlots] = useState([])
  const [supportingDocument, setSupportingDocument] = useState(null)
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalAlert, setModalAlert] = useState({ type: "", message: "" })
  const slotRequestRef = useRef(0)

  const selectedClient = clients.find((client) => client.id === form.clientId)
  const selectedArea = areas.find((area) => area.id === form.areaId)
  const selectedBlock = blocks.find((block) => block.id === form.blockId)
  const selectedBlockHasCapacity = blockHasContainerCapacity(selectedBlock, form.containerSize)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setForm(createLegacyForm())
    setBlocks([])
    setSlots([])
    setSupportingDocument(null)
    setModalAlert({ type: "", message: "" })
    setLoadingClients(true)
    api.get("/admin/inventory/clients")
      .then(({ data }) => setClients(data.clients || []))
      .catch((error) => setModalAlert({ type: "error", message: getApiError(error) }))
      .finally(() => setLoadingClients(false))
  }, [open])

  if (!open) return null

  const setValue = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setModalAlert({ type: "", message: "" })
  }

  const loadSlots = async (blockId) => {
    setForm((current) => ({ ...current, blockId, bay: "", row: "", tier: "" }))
    setSlots([])
    const requestId = slotRequestRef.current + 1
    slotRequestRef.current = requestId
    if (!blockId) {
      setLoadingSlots(false)
      return
    }
    try {
      setLoadingSlots(true)
      const { data } = await api.get(`/admin/inventory/blocks/${blockId}/slots`)
      if (slotRequestRef.current === requestId) setSlots(data.slots || [])
    } catch (error) {
      if (slotRequestRef.current === requestId) {
        setModalAlert({ type: "error", message: getApiError(error) })
      }
    } finally {
      if (slotRequestRef.current === requestId) setLoadingSlots(false)
    }
  }

  const loadAreaSlots = async (areaId, containerSize = form.containerSize) => {
    setForm((current) => ({ ...current, areaId, blockId: "", bay: "", row: "", tier: "" }))
    setBlocks([])
    setSlots([])
    slotRequestRef.current += 1
    setLoadingSlots(false)
    setModalAlert({ type: "", message: "" })
    if (!areaId) {
      setLoadingBlocks(false)
      return
    }

    try {
      setLoadingBlocks(true)
      const { data } = await api.get(`/admin/inventory/areas/${areaId}/blocks`)
      const nextBlocks = (data.blocks || []).filter((block) => (block.status || "active") === "active")
      setBlocks(nextBlocks)

      const area = areas.find((item) => item.id === areaId)
      const areaBlock = chooseAreaLocationBlock({ blocks: nextBlocks, area, containerSize })
      if (!areaBlock) {
        setModalAlert({
          type: "error",
          message: "No available slot can fit this container in the selected yard area. Choose another area.",
        })
        return
      }

      await loadSlots(areaBlock.id)
    } catch (error) {
      setModalAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoadingBlocks(false)
    }
  }

  const toggleCondition = (condition) => {
    setForm((current) => {
      const exists = current.gateInConditions.includes(condition)
      return {
        ...current,
        gateInConditions: exists
          ? current.gateInConditions.filter((item) => item !== condition)
          : [...current.gateInConditions, condition],
      }
    })
  }

  const validateStep = () => {
    if (step === 1) {
      const requiredValues = [
        form.containerNumber,
        form.containerSize,
        form.containerType,
        form.containerLoadStatus,
        form.rateType,
        form.scheduledDateIn,
        form.scheduledTimeIn,
        form.shippingLine,
        form.areaId,
        form.blockId,
        form.bay,
        form.row,
        form.tier,
      ]
      if (requiredValues.some((value) => !String(value || "").trim())) {
        setModalAlert({
          type: "error",
          message: "Complete the required details and select an available yard slot before continuing.",
        })
        return false
      }
    }
    if (step === 2) {
      if (form.gateInConditions.includes("OTHER") && !form.gateInConditionOther.trim()) {
        setModalAlert({ type: "error", message: "Specify the Other container condition." })
        return false
      }
    }
    if (step === 3) {
      if (Number(form.openingBalanceAmount) < 0 || Number(form.openingCreditAmount) < 0) {
        setModalAlert({ type: "error", message: "Opening balance and credit cannot be negative." })
        return false
      }
    }
    setModalAlert({ type: "", message: "" })
    return true
  }

  const nextStep = () => {
    if (!validateStep()) return
    setStep((current) => Math.min(current + 1, 4))
  }

  const submit = async () => {
    try {
      setSaving(true)
      setModalAlert({ type: "", message: "" })
      const payload = new FormData()
      const scheduledDateTime = new Date(`${form.scheduledDateIn}T${form.scheduledTimeIn}:00`)
      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, key === "gateInConditions" ? JSON.stringify(value) : value ?? "")
      })
      if (!Number.isNaN(scheduledDateTime.getTime())) payload.append("scheduledDateTimeIn", scheduledDateTime.toISOString())
      if (supportingDocument) payload.append("supportingDocument", supportingDocument)
      const { data } = await api.post("/admin/inventory/containers/legacy", payload)
      onCreated(data)
      onClose()
    } catch (error) {
      setModalAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSaving(false)
    }
  }

  const stepTitles = ["Required Details", "Optional Details", "Billing", "Review"]

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
              <Database size={14} /> Existing Container Registration
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Add Legacy Inventory Container</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Register a container that was already inside the yard before the system was implemented.</p>
          </div>
          <ModalCloseButton onClick={onClose} label="Close existing container form" />
        </div>

        <div className="p-5">
          <div className="mb-5 grid gap-2 sm:grid-cols-4">
            {stepTitles.map((title, index) => {
              const number = index + 1
              const active = step === number
              const complete = step > number
              return (
                <div key={title} className={`rounded-2xl border px-3 py-3 ${active ? "border-emerald-300 bg-emerald-50" : complete ? "border-emerald-100 bg-white" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${active || complete ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>{complete ? <CheckCircle2 size={15} /> : number}</span>
                    <span className={`text-xs font-black uppercase tracking-wide ${active ? "text-emerald-800" : "text-slate-500"}`}>{title}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <Alert type={modalAlert.type}>{modalAlert.message}</Alert>

          {step === 1 && (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                Fields marked with <strong>*</strong> are required. All client, transport, condition, document, and opening-balance details are optional.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Client / Container Owner (Optional)">
                  <select className="input" value={form.clientId} onChange={(event) => setValue("clientId", event.target.value)} disabled={loadingClients}>
                    <option value="">{loadingClients ? "Loading clients..." : "Leave unassigned or select a verified client"}</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name} • {client.email}</option>)}
                  </select>
                </Field>
                <Field label="Container Number *">
                  <input className="input uppercase" value={form.containerNumber} onChange={(event) => setValue("containerNumber", event.target.value.toUpperCase())} placeholder="e.g., ABCD1234567" required />
                </Field>
                <Field label="Container Size *">
                  <select
                    className="input"
                    value={form.containerSize}
                    onChange={(event) => {
                      const containerSize = event.target.value
                      const areaId = form.areaId
                      setForm((current) => ({ ...current, containerSize, blockId: "", bay: "", row: "", tier: "" }))
                      setSlots([])
                      slotRequestRef.current += 1
                      setLoadingSlots(false)
                      setModalAlert({ type: "", message: "" })
                      if (areaId) loadAreaSlots(areaId, containerSize)
                    }}
                    required
                  ><option value="20">20 FT</option><option value="40">40 FT</option></select>
                </Field>
                <Field label="Type *">
                  <select className="input" value={form.containerType} onChange={(event) => setValue("containerType", event.target.value)} required>
                    <option value="dry">Dry</option><option value="reefer">Reefer</option><option value="tank">Tank</option><option value="open_top">Open Top</option><option value="flat_rack">Flat Rack</option>
                  </select>
                </Field>
                <Field label="Load Status *">
                  <select className="input" value={form.containerLoadStatus} onChange={(event) => setValue("containerLoadStatus", event.target.value)} required><option value="empty">Empty</option><option value="laden">Laden</option></select>
                </Field>
                <Field label="Transaction Classification *">
                  <select className="input" value={form.rateType} onChange={(event) => setValue("rateType", event.target.value)} required><option value="local">Local</option><option value="international">International</option></select>
                </Field>
                <Field label="Scheduled Date In *">
                  <input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={form.scheduledDateIn} onChange={(event) => setValue("scheduledDateIn", event.target.value)} required />
                </Field>
                <Field label="Scheduled Time In *">
                  <input className="input" type="time" value={form.scheduledTimeIn} onChange={(event) => setValue("scheduledTimeIn", event.target.value)} required />
                </Field>
                <Field label="Shipping Line *">
                  <input className="input" value={form.shippingLine} onChange={(event) => setValue("shippingLine", event.target.value)} placeholder="Shipping line" required />
                </Field>
                <Field label="Yard Area *" hint="Choose the yard area and the system will show all available Bay, Row, and Tier positions.">
                  <select className="input" value={form.areaId} onChange={(event) => loadAreaSlots(event.target.value)} required>
                    <option value="">Select yard area</option>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.name} • {area.availableSlots ?? 0} TEU available</option>)}
                  </select>
                </Field>
              </div>
              {selectedClient && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Selected owner: <strong>{selectedClient.name}</strong> • {selectedClient.email}</div>}
              {selectedArea && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Selected yard area: <strong>{selectedArea.name}</strong>. Choose the exact available Bay, Row, and Tier below.</div>}
              {form.areaId && loadingBlocks && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-600">
                  Loading available slots for this yard area...
                </div>
              )}
              {form.areaId && !loadingBlocks && selectedBlock && (
                <AvailableSlotPicker
                  block={selectedBlock}
                  unavailableSlots={slots}
                  containerSize={form.containerSize}
                  selectedBay={form.bay}
                  selectedRow={form.row}
                  selectedTier={form.tier}
                  loading={loadingSlots}
                  disabled={!selectedBlockHasCapacity}
                  emptyMessage="No available slot can fit this container in the selected yard area. Choose another area."
                  onSelect={(slot) => setForm((current) => ({ ...current, bay: slot.bay, row: slot.row, tier: slot.tier }))}
                />
              )}
              {form.areaId && !loadingBlocks && !selectedBlock && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                  No available slot can fit this container in the selected yard area. Choose another area.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Original Reference Number (Optional)">
                  <input className="input" value={form.historicalSourceReference} onChange={(event) => setValue("historicalSourceReference", event.target.value)} placeholder="Old pass, ledger, or invoice number" />
                </Field>
                <Field label="Supporting Document (Optional)">
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 hover:border-emerald-400 hover:bg-emerald-50">
                    <Upload size={18} /> {supportingDocument ? supportingDocument.name : "Upload old Gate-In pass or source document"}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setSupportingDocument(event.target.files?.[0] || null)} />
                  </label>
                </Field>
                <Field label="Seal Number (Optional)"><input className="input" value={form.sealNumber} onChange={(event) => setValue("sealNumber", event.target.value)} /></Field>
                <Field label="Seal Intact (Optional)"><select className="input" value={form.sealIntact} onChange={(event) => setValue("sealIntact", event.target.value)}><option value="">Not recorded</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
                <Field label="Truck Plate Number (Optional)"><input className="input" value={form.truckPlateNumber} onChange={(event) => setValue("truckPlateNumber", event.target.value)} /></Field>
                <Field label="Driver Name (Optional)"><input className="input" value={form.driverName} onChange={(event) => setValue("driverName", event.target.value)} /></Field>
                <Field label="Driver License Number (Optional)"><input className="input" value={form.driverLicenseNumber} onChange={(event) => setValue("driverLicenseNumber", event.target.value)} /></Field>
                <Field label="Hauler (Optional)"><input className="input" value={form.hauler} onChange={(event) => setValue("hauler", event.target.value)} /></Field>
              </div>
              <Field label="Container Condition on Entry (Optional)" hint="Multiple conditions may be selected.">
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {legacyConditionOptions.map((condition) => (
                    <label key={condition} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                      <input type="checkbox" checked={form.gateInConditions.includes(condition)} onChange={() => toggleCondition(condition)} className="h-4 w-4 rounded text-emerald-600" /> {condition}
                    </label>
                  ))}
                  {form.gateInConditions.includes("OTHER") && <input className="input sm:col-span-2 lg:col-span-3" value={form.gateInConditionOther} onChange={(event) => setValue("gateInConditionOther", event.target.value)} placeholder="Specify other condition" />}
                </div>
              </Field>
              <Field label="Inspection / Damage Remarks (Optional)"><textarea className="input min-h-24" value={form.inspectionRemarks} onChange={(event) => setValue("inspectionRemarks", event.target.value)} /></Field>
              <Field label="Registration Remarks (Optional)"><textarea className="input min-h-24" value={form.legacyRegistrationReason} onChange={(event) => setValue("legacyRegistrationReason", event.target.value)} /></Field>
            </div>
          )}

          {step === 3 && (
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Billing Start Method (Optional)">
                  <select className="input" value={form.billingStartMethod} onChange={(event) => setValue("billingStartMethod", event.target.value)}><option value="historical_gate_in">Start from Scheduled Date and Time In</option><option value="migration_date">Start from registration date — future storage only</option></select>
                </Field>
                <Field label="VAT Treatment (Optional)">
                  <select className="input" value={form.isVatApplicable} onChange={(event) => setValue("isVatApplicable", event.target.value)}><option value="true">VAT applicable</option><option value="false">Non-VAT</option></select>
                </Field>
                <Field label="Opening Balance Before VAT (Optional)"><input className="input" type="number" min="0" step="0.01" value={form.openingBalanceAmount} onChange={(event) => setValue("openingBalanceAmount", event.target.value)} /></Field>
                <Field label="Opening Credit / Previous Payment (Optional)"><input className="input" type="number" min="0" step="0.01" value={form.openingCreditAmount} onChange={(event) => setValue("openingCreditAmount", event.target.value)} /></Field>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">The container will be registered in <strong>{selectedArea?.name || "the selected yard area"}</strong> at <strong>Bay {form.bay || "-"}, Row {form.row || "-"}, Tier {form.tier || "-"}</strong>.</div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Billing from Scheduled Date and Time In may calculate historical storage charges. Registration-date billing calculates only future charges. Opening balances remain separately identified.</div>
            </div>
          )}

          {step === 4 && (
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Client / Owner" value={selectedClient?.name || "Unassigned"} />
                <Detail label="Container" value={`${form.containerNumber} • ${form.containerSize}FT • ${form.containerType.replaceAll("_", " ")}`} />
                <Detail label="Classification" value={`${form.containerLoadStatus === "laden" ? "Laden" : "Empty"} • ${form.rateType === "international" ? "International" : "Local"}`} />
                <Detail label="Scheduled Date / Time In" value={`${form.scheduledDateIn} • ${form.scheduledTimeIn}`} />
                <Detail label="Shipping Line" value={form.shippingLine} />
                <Detail label="Yard Location" value={`${selectedArea?.name || "-"} • B${form.bay || "-"}-R${form.row || "-"}-T${form.tier || "-"}`} />
                <Detail label="Billing Start" value={form.billingStartMethod === "historical_gate_in" ? "Scheduled Date and Time In" : "Registration date"} />
                <Detail label="VAT Treatment" value={form.isVatApplicable === "false" ? "Non-VAT" : "VAT applicable"} />
                <Detail label="Opening Balance" value={`PHP ${Number(form.openingBalanceAmount || 0).toLocaleString()}`} />
                <Detail label="Opening Credit" value={`PHP ${Number(form.openingCreditAmount || 0).toLocaleString()}`} />
                <Detail label="Source Document" value={supportingDocument?.name || "None uploaded"} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"><strong>Confirmation:</strong> This creates a stored legacy inventory record at the exact available yard slot selected above. Optional ownership, transport, condition, document, and opening-balance information is preserved when provided.</div>
            </div>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className="btn-secondary" onClick={() => step === 1 ? onClose() : setStep((current) => current - 1)} disabled={saving}><ChevronLeft size={16} /> {step === 1 ? "Cancel" : "Back"}</button>
            {step < 4 ? <button type="button" className="btn-primary" onClick={nextStep}>Continue <ChevronRight size={16} /></button> : <button type="button" className="btn-primary" onClick={submit} disabled={saving}><Database size={16} /> {saving ? "Registering..." : "Register Existing Container"}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}


const toDateTimeLocalValue = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (number) => String(number).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const getDefaultGateOutDateTime = () => {
  const date = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000))
  date.setSeconds(0, 0)
  if (date.getMinutes() > 0) date.setHours(date.getHours() + 1, 0, 0, 0)
  return toDateTimeLocalValue(date)
}

const InventoryGateOutModal = ({ container, form, setForm, saving, onClose, onSubmit }) => {
  if (!container) return null
  const isRelease = container.bookingStatus === "gate_out_approved"
  const toggleCondition = (condition) => {
    setForm((current) => {
      const exists = current.gateOutConditions.includes(condition)
      return {
        ...current,
        gateOutConditions: exists
          ? current.gateOutConditions.filter((item) => item !== condition)
          : [...current.gateOutConditions, condition],
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[9998] grid place-items-center bg-slate-950/[0.55] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
              <LogOut size={14} /> {isRelease ? "Complete Gate Out" : "Gate Out from Inventory"}
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">{container.containerNumber}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{container.bookingReference} • {container.clientName || "Client"}</p>
            <ContainerClassificationBadges
              loadStatus={container.containerLoadStatus || container.containerStatus}
              rateType={container.rateType}
              className="mt-3"
            />
          </div>
          <ModalCloseButton onClick={onClose} label="Close Gate-Out form" />
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-5">
          {isRelease ? (
            <>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
                This container already has an approved Gate-Out and paid transaction. Completing Gate Out will physically release the container, free its yard slot, and generate the final release report.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Scheduled Gate Out" value={formatDate(container.outDate)} />
                <Detail label="Billing Status" value={billingLabel[container.billingStatus] || container.billingStatus} />
                <Detail label="Balance Due" value={`PHP ${Number(container.paymentBalanceDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                <Detail label="Current Location" value={`${container.areaName || "-"} • ${getAreaSlotLabel(container)}`} />
              </div>

              <Field label="Gate-Out Container Condition">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {legacyConditionOptions.map((condition) => (
                    <label key={condition} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.gateOutConditions.includes(condition)}
                        onChange={() => toggleCondition(condition)}
                        className="h-4 w-4 rounded text-emerald-600"
                      />
                      {condition}
                    </label>
                  ))}
                </div>
              </Field>

              {form.gateOutConditions.includes("OTHER") && (
                <Field label="Other Condition">
                  <input
                    className="input"
                    value={form.gateOutConditionOther}
                    onChange={(event) => setForm((current) => ({ ...current, gateOutConditionOther: event.target.value }))}
                    placeholder="Describe the other condition"
                    required
                  />
                </Field>
              )}
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                Starting Gate Out here creates the same Gate-Out transaction used by the dedicated Gate Out module. The selected Date Out is used to compute storage and applicable Gate-Out charges using the correct Empty/Loaded and Local/International rate configuration.
              </div>
              <Field label="Date and Time Out" hint="Gate-Out time slots remain subject to yard capacity and the existing Gate-Out scheduling rules.">
                <input
                  type="datetime-local"
                  step="3600"
                  className="input"
                  value={form.outDate}
                  onChange={(event) => setForm((current) => ({ ...current, outDate: event.target.value }))}
                  required
                />
              </Field>
            </>
          )}

          <Field label={isRelease ? "Release Remarks" : "Gate-Out Remarks"}>
            <textarea
              className="input min-h-24 resize-y"
              value={form.remarks}
              onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
              placeholder={isRelease ? "Optional physical release remarks" : "Optional Gate-Out request remarks"}
            />
          </Field>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <LogOut size={16} /> {saving ? (isRelease ? "Releasing..." : "Starting Gate Out...") : (isRelease ? "Complete Gate Out" : "Start Gate Out")}
            </button>
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
  const [inventoryStats, setInventoryStats] = useState({ totalContainers: 0, waitingStorage: 0, inventoryTeu: 0, inventoryFeu: 0 })
  const [inventoryTruncated, setInventoryTruncated] = useState(false)
  const [clientOptions, setClientOptions] = useState([])
  const [selectedClientId, setSelectedClientId] = useState("all")
  const [selectedAreaId, setSelectedAreaId] = useState("")
  const [selectedStatus, setSelectedStatus] = useState(DEFAULT_INVENTORY_STATUS)
  const [selectedLoadStatus, setSelectedLoadStatus] = useState("all")
  const [selectedRateType, setSelectedRateType] = useState("all")
  const [selectedRecordSource, setSelectedRecordSource] = useState("all")
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(true)
  const [alert, setAlert] = useState({ type: "", message: "" })

  const [modalOpen, setModalOpen] = useState(false)
  const [legacyModalOpen, setLegacyModalOpen] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState(null)
  const [editingContainer, setEditingContainer] = useState(null)
  const [deletingId, setDeletingId] = useState("")
  const [storingId, setStoringId] = useState("")
  const [locationForm, setLocationForm] = useState({ areaId: "", blockId: "", bay: "", row: "", tier: "" })
  const [modalBlocks, setModalBlocks] = useState([])
  const [modalSlots, setModalSlots] = useState([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [modalSlotsLoading, setModalSlotsLoading] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [gateOutContainer, setGateOutContainer] = useState(null)
  const [gateOutForm, setGateOutForm] = useState({ outDate: "", remarks: "", gateOutConditions: ["GOOD"], gateOutConditionOther: "" })
  const [gateOutSaving, setGateOutSaving] = useState(false)
  const modalSlotRequestRef = useRef(0)
  const inventoryRequestRef = useRef(0)
  const inventoryAbortRef = useRef(null)
  const inventoryInFlightRef = useRef({ key: "", promise: null })
  const inventoryStatsInFlightRef = useRef(null)
  const initialLoadStartedRef = useRef(false)
  const realtimeRefreshTimerRef = useRef(null)
  const realtimeRefreshFlagsRef = useRef({ inventory: false, yard: false })
  const user = useAuthStore((state) => state.user)
  const canDeleteBooking = hasModulePermission(user, "operations", "delete")
  const canManageInventoryGateOut = hasModulePermission(user, "inventory", "edit")
  const canCreateLegacyContainer = user?.role === "super_admin"

  const bookingContainers = useMemo(() => {
    return containers
      .filter((container) => container.source === "booking" && bookingStatusesForInventory.includes(container.bookingStatus))
      .sort((a, b) => {
        const aWaiting = a.bookingStatus === "gate_in_approved" ? 0 : 1
        const bWaiting = b.bookingStatus === "gate_in_approved" ? 0 : 1
        if (aWaiting !== bWaiting) return aWaiting - bWaiting
        return getInventoryEnteredTime(b) - getInventoryEnteredTime(a)
      })
  }, [containers])


  useClickOutside(filterRef, () => setShowFilters(false), showFilters);
  const filteredContainers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return bookingContainers.filter((container) => {
      const matchesArea = !selectedAreaId || container.area === selectedAreaId
      const matchesStatus = selectedStatus === "all" || container.bookingStatus === selectedStatus
      const normalizedLoadStatus = container.containerLoadStatus || container.containerStatus
      const matchesLoadStatus = selectedLoadStatus === "all" || normalizedLoadStatus === selectedLoadStatus
      const matchesRateType = selectedRateType === "all" || (container.rateType || "local") === selectedRateType
      const matchesRecordSource = selectedRecordSource === "all" || (container.recordSource || "client_booking") === selectedRecordSource
      const matchesClient = selectedClientId === "all" || String(container.client || "") === String(selectedClientId)
      const matchesSearch = !term || [container.containerNumber, container.bookingReference, container.legacyRegistrationNumber, container.clientName, container.areaName, container.slotNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
      return matchesArea && matchesStatus && matchesLoadStatus && matchesRateType && matchesRecordSource && matchesClient && matchesSearch
    })
  }, [bookingContainers, selectedAreaId, selectedClientId, selectedLoadStatus, selectedRateType, selectedRecordSource, selectedStatus, search])

  const inventoryFilterKey = `${selectedAreaId}|${selectedClientId}|${selectedStatus}|${selectedLoadStatus}|${selectedRateType}|${selectedRecordSource}|${search.trim()}`
  const inventoryFilterRef = useRef(null)
  inventoryFilterRef.current = {
    selectedAreaId,
    selectedClientId,
    selectedStatus,
    selectedLoadStatus,
    selectedRateType,
    selectedRecordSource,
    search: search.trim(),
  }
  const lastRequestedFilterKeyRef = useRef(inventoryFilterKey)

  const containerPagination = usePagination(
    filteredContainers,
    10,
    inventoryFilterKey,
  )

  const loadAreas = async () => {
    const { data } = await api.get("/admin/inventory/areas")
    setAreas(data.areas || [])
  }

  const loadSummary = async () => {
    const { data } = await api.get("/admin/inventory/summary")
    setSummary(data.summary || null)
  }

  const loadInventoryStats = async ({ refresh = false } = {}) => {
    if (inventoryStatsInFlightRef.current) return inventoryStatsInFlightRef.current

    const query = refresh ? "?refresh=true" : ""
    let requestPromise
    requestPromise = api.get(`/admin/inventory/stats${query}`, { timeout: 10000 })
      .then(({ data }) => {
        if (!data?.stats) return
        setInventoryStats({
          totalContainers: Number(data.stats.totalContainers) || 0,
          waitingStorage: Number(data.stats.waitingStorage) || 0,
          inventoryTeu: Number(data.stats.inventoryTeu) || 0,
          inventoryFeu: Number(data.stats.inventoryFeu) || 0,
        })
      })
      .catch((error) => {
        if (error?.code !== "ERR_CANCELED" && error?.name !== "CanceledError") {
          console.warn("Inventory totals could not be refreshed without blocking the table.", error)
        }
      })
      .finally(() => {
        if (inventoryStatsInFlightRef.current === requestPromise) inventoryStatsInFlightRef.current = null
      })

    inventoryStatsInFlightRef.current = requestPromise
    return requestPromise
  }

  const loadContainers = async ({ includeStats = false } = {}) => {
    const filters = inventoryFilterRef.current || {}
    const params = new URLSearchParams({
      source: "booking",
      limit: "80",
      includeStats: includeStats ? "true" : "false",
    })
    if (filters.selectedClientId && filters.selectedClientId !== "all") params.set("clientId", filters.selectedClientId)
    if (filters.selectedAreaId) params.set("areaId", filters.selectedAreaId)
    if (filters.selectedStatus && filters.selectedStatus !== "all") params.set("status", filters.selectedStatus)
    if (filters.selectedLoadStatus && filters.selectedLoadStatus !== "all") params.set("loadStatus", filters.selectedLoadStatus)
    if (filters.selectedRateType && filters.selectedRateType !== "all") params.set("rateType", filters.selectedRateType)
    if (filters.selectedRecordSource && filters.selectedRecordSource !== "all") params.set("recordSource", filters.selectedRecordSource)
    if (filters.search) params.set("search", filters.search)

    const requestKey = params.toString()
    const currentInFlight = inventoryInFlightRef.current
    if (currentInFlight.promise && currentInFlight.key === requestKey) {
      return currentInFlight.promise
    }

    if (inventoryAbortRef.current) inventoryAbortRef.current.abort()
    const controller = new AbortController()
    inventoryAbortRef.current = controller
    const requestId = ++inventoryRequestRef.current

    setTableLoading(true)
    let requestPromise
    requestPromise = api.get(`/admin/inventory/containers?${requestKey}`, { signal: controller.signal })
      .then(({ data }) => {
        if (requestId !== inventoryRequestRef.current) return
        setContainers(data.containers || [])
        if (data.stats) {
          setInventoryStats({
            totalContainers: Number(data.stats.totalContainers) || 0,
            waitingStorage: Number(data.stats.waitingStorage) || 0,
            inventoryTeu: Number(data.stats.inventoryTeu) || 0,
            inventoryFeu: Number(data.stats.inventoryFeu) || 0,
          })
        }
        setInventoryTruncated(Boolean(data.truncated))
      })
      .catch((error) => {
        if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || controller.signal.aborted) return
        throw error
      })
      .finally(() => {
        if (inventoryInFlightRef.current.promise === requestPromise) {
          inventoryInFlightRef.current = { key: "", promise: null }
        }
        if (inventoryAbortRef.current === controller) inventoryAbortRef.current = null
        if (requestId === inventoryRequestRef.current) setTableLoading(false)
      })

    inventoryInFlightRef.current = { key: requestKey, promise: requestPromise }
    return requestPromise
  }

  const loadClientOptions = async () => {
    const { data } = await api.get("/admin/inventory/clients")
    setClientOptions(data.clients || [])
  }

  const loadAll = async () => {
    try {
      setLoading(true)
      setAlert({ type: "", message: "" })
      loadInventoryStats().catch(() => {})
      await Promise.all([loadAreas(), loadSummary(), loadClientOptions(), loadContainers({ includeStats: false })])
    } catch (error) {
      if (error?.code !== "ERR_CANCELED" && error?.name !== "CanceledError") {
        setAlert({ type: "error", message: getApiError(error) })
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshInventory = async ({ refreshYard = false } = {}) => {
    if (realtimeRefreshTimerRef.current) {
      window.clearTimeout(realtimeRefreshTimerRef.current)
      realtimeRefreshTimerRef.current = null
      realtimeRefreshFlagsRef.current = { inventory: false, yard: false }
    }
    const jobs = [loadContainers({ includeStats: false })]
    loadInventoryStats({ refresh: true }).catch(() => {})
    if (refreshYard) jobs.push(loadAreas(), loadSummary())
    return Promise.all(jobs)
  }

  useEffect(() => {
    if (initialLoadStartedRef.current) return
    initialLoadStartedRef.current = true
    loadAll()
  }, [])

  useEffect(() => {
    if (lastRequestedFilterKeyRef.current === inventoryFilterKey) return undefined

    const timer = window.setTimeout(() => {
      lastRequestedFilterKeyRef.current = inventoryFilterKey
      loadContainers({ includeStats: false }).catch((error) => {
        if (error?.code !== "ERR_CANCELED" && error?.name !== "CanceledError") {
          setAlert({ type: "error", message: getApiError(error) })
        }
      })
    }, 350)

    return () => window.clearTimeout(timer)
  }, [inventoryFilterKey])

  useEffect(() => {
    const handleRealtime = (event) => {
      const eventType = event.detail?.type || ""
      const yardChanged = eventType.startsWith("yard:") || eventType.startsWith("inventory:block_")
      const inventoryChanged = eventType.startsWith("booking:")
        || eventType.startsWith("storage:")
        || ["inventory:container_assigned", "inventory:container_created", "inventory:legacy_container_created", "inventory:updated"].includes(eventType)

      if (!inventoryChanged && !yardChanged) return

      realtimeRefreshFlagsRef.current = {
        inventory: realtimeRefreshFlagsRef.current.inventory || inventoryChanged,
        yard: realtimeRefreshFlagsRef.current.yard || yardChanged,
      }

      if (realtimeRefreshTimerRef.current) window.clearTimeout(realtimeRefreshTimerRef.current)
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        const flags = realtimeRefreshFlagsRef.current
        realtimeRefreshFlagsRef.current = { inventory: false, yard: false }
        realtimeRefreshTimerRef.current = null

        const jobs = []
        if (flags.inventory) {
          jobs.push(loadContainers({ includeStats: false }))
          loadInventoryStats().catch(() => {})
        }
        if (flags.yard) jobs.push(loadAreas(), loadSummary())
        Promise.all(jobs).catch((error) => {
          if (error?.code !== "ERR_CANCELED" && error?.name !== "CanceledError") {
            setAlert({ type: "error", message: getApiError(error) })
          }
        })
      }, 400)
    }

    window.addEventListener("otli:realtime", handleRealtime)
    return () => {
      window.removeEventListener("otli:realtime", handleRealtime)
      if (realtimeRefreshTimerRef.current) window.clearTimeout(realtimeRefreshTimerRef.current)
    }
  }, [])

  const loadBlocksForArea = async (areaId) => {
    if (!areaId) {
      setModalBlocks([])
      return []
    }

    setLoadingBlocks(true)
    try {
      const { data } = await api.get(`/admin/inventory/areas/${areaId}/blocks`)
      const nextBlocks = (data.blocks || []).filter((block) => (block.status || "active") === "active")
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
    setModalSlots([])
    const requestId = modalSlotRequestRef.current + 1
    modalSlotRequestRef.current = requestId
    if (!blockId) {
      setModalSlotsLoading(false)
      return
    }

    try {
      setModalSlotsLoading(true)
      const { data } = await api.get(`/admin/inventory/blocks/${blockId}/slots`)
      if (modalSlotRequestRef.current === requestId) setModalSlots(data.slots || [])
    } catch (error) {
      if (modalSlotRequestRef.current === requestId) {
        setModalSlots([])
        setAlert({ type: "error", message: getApiError(error) })
      }
    } finally {
      if (modalSlotRequestRef.current === requestId) setModalSlotsLoading(false)
    }
  }

  const openLocationModal = async (container) => {
    const areaId = container.area || ""
    setEditingContainer(container)
    setModalOpen(true)
    setModalSlots([])
    setLocationForm({
      areaId,
      blockId: "",
      bay: "",
      row: "",
      tier: "",
    })

    const nextBlocks = await loadBlocksForArea(areaId)
    const area = areas.find((item) => item.id === areaId)
    const areaBlock = chooseAreaLocationBlock({
      blocks: nextBlocks,
      area,
      container,
      preferredBlockId: container.block || "",
    })

    if (!areaBlock) return

    const isCurrentLocation = String(areaBlock.id) === String(container.block || "")
    setLocationForm({
      areaId,
      blockId: areaBlock.id,
      bay: isCurrentLocation ? container.bay || "" : "",
      row: isCurrentLocation ? container.row || "" : "",
      tier: isCurrentLocation ? container.tier || "" : "",
    })
    await loadBlockSlots(areaBlock.id)
  }

  const closeLocationModal = () => {
    setModalOpen(false)
    setEditingContainer(null)
    modalSlotRequestRef.current += 1
    setModalSlotsLoading(false)
    setModalBlocks([])
    setModalSlots([])
    setLocationForm({ areaId: "", blockId: "", bay: "", row: "", tier: "" })
  }

  const handleModalAreaChange = async (areaId) => {
    setLocationForm((current) => ({ ...current, areaId, blockId: "", bay: "", row: "", tier: "" }))
    modalSlotRequestRef.current += 1
    setModalSlotsLoading(false)
    setModalSlots([])

    if (!areaId || !editingContainer) {
      setModalBlocks([])
      return
    }

    const nextBlocks = await loadBlocksForArea(areaId)
    const area = areas.find((item) => item.id === areaId)
    const areaBlock = chooseAreaLocationBlock({ blocks: nextBlocks, area, container: editingContainer })

    if (!areaBlock) {
      setAlert({ type: "error", message: "No available slot can fit this container in the selected yard area. Choose another area." })
      return
    }

    setLocationForm((current) => ({ ...current, areaId, blockId: areaBlock.id, bay: "", row: "", tier: "" }))
    await loadBlockSlots(areaBlock.id)
  }

  const handleLocationSubmit = async (event) => {
    event.preventDefault()
    if (!editingContainer) return
    if (!locationForm.areaId || !locationForm.blockId || !locationForm.bay || !locationForm.row || !locationForm.tier) {
      setAlert({ type: "error", message: "Select an available yard slot before saving the new location." })
      return
    }

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
      await refreshInventory({ refreshYard: true })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSavingLocation(false)
    }
  }

  const handleMarkStored = async (container) => {
    if (container.bookingStatus !== "gate_in_approved") return

    try {
      setStoringId(container.id)
      setAlert({ type: "", message: "" })
      await api.patch(`/admin/bookings/${container.id}/store`)
      setSelectedContainer(null)
      setAlert({ type: "success", message: "Container storage approved. Billing was computed and the record is now visible in Storage Monitoring." })
      await refreshInventory()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setStoringId("")
    }
  }

  const openInventoryGateOut = (container) => {
    if (!canManageInventoryGateOut) return
    if (!["stored_in_assigned_area", "gate_out_approved"].includes(container.bookingStatus)) return

    setSelectedContainer(null)
    setGateOutContainer(container)
    setGateOutForm({
      outDate: container.outDate ? toDateTimeLocalValue(container.outDate) : getDefaultGateOutDateTime(),
      remarks: "",
      gateOutConditions: container.gateOutConditions?.length
        ? container.gateOutConditions
        : container.gateInConditions?.length
          ? container.gateInConditions
          : ["GOOD"],
      gateOutConditionOther: container.gateOutConditionOther || container.gateInConditionOther || "",
    })
    setAlert({ type: "", message: "" })
  }

  const closeInventoryGateOut = () => {
    if (gateOutSaving) return
    setGateOutContainer(null)
    setGateOutForm({ outDate: "", remarks: "", gateOutConditions: ["GOOD"], gateOutConditionOther: "" })
  }

  const handleInventoryGateOutSubmit = async (event) => {
    event.preventDefault()
    if (!gateOutContainer || !canManageInventoryGateOut) return

    const isRelease = gateOutContainer.bookingStatus === "gate_out_approved"
    if (!isRelease) {
      const parsedOutDate = new Date(gateOutForm.outDate)
      if (!gateOutForm.outDate || Number.isNaN(parsedOutDate.getTime())) {
        setAlert({ type: "error", message: "Select a valid Gate-Out date and time." })
        return
      }
    }

    if (isRelease && gateOutForm.gateOutConditions.includes("OTHER") && !gateOutForm.gateOutConditionOther.trim()) {
      setAlert({ type: "error", message: "Describe the other Gate-Out container condition before completing release." })
      return
    }

    try {
      setGateOutSaving(true)
      setAlert({ type: "", message: "" })

      if (isRelease) {
        const { data } = await api.patch(`/admin/inventory/containers/${gateOutContainer.id}/gate-out/complete`, {
          actualContainerNumber: gateOutContainer.containerNumber,
          remarks: gateOutForm.remarks.trim(),
          gateOutConditions: gateOutForm.gateOutConditions,
          gateOutConditionOther: gateOutForm.gateOutConditionOther.trim(),
        })
        setAlert({ type: "success", message: data.message || "Container Gate-Out completed and the yard slot was released." })
        setGateOutContainer(null)
        await refreshInventory({ refreshYard: true })
      } else {
        const parsedOutDate = new Date(gateOutForm.outDate)
        const { data } = await api.post(`/admin/inventory/containers/${gateOutContainer.id}/gate-out-request`, {
          outDate: parsedOutDate.toISOString(),
          remarks: gateOutForm.remarks.trim(),
        })
        setAlert({ type: "success", message: data.message || "Gate-Out initiated from Inventory." })
        setGateOutContainer(null)
        await refreshInventory()
      }
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setGateOutSaving(false)
    }
  }

  const handleLegacyContainerCreated = async (data) => {
    setAlert({ type: "success", message: data.message || "Existing container registered successfully." })
    const nextStatus = "stored_in_assigned_area"
    const nextRecordSource = "legacy_migration"
    const nextFilterKey = `${selectedAreaId}|${selectedClientId}|${nextStatus}|${selectedLoadStatus}|${selectedRateType}|${nextRecordSource}|${search.trim()}`
    inventoryFilterRef.current = {
      ...inventoryFilterRef.current,
      selectedStatus: nextStatus,
      selectedRecordSource: nextRecordSource,
    }
    lastRequestedFilterKeyRef.current = nextFilterKey
    setSelectedStatus(nextStatus)
    setSelectedRecordSource(nextRecordSource)
    await refreshInventory({ refreshYard: true })
  }

  const deleteContainerRecord = async (container) => {
    if (!canDeleteBooking) return
    if (!window.confirm(`Delete booking ${container.bookingReference}? This permanently removes the container booking and its uploaded documents.`)) return

    try {
      setDeletingId(container.id)
      setAlert({ type: "", message: "" })
      const { data } = await api.delete(`/admin/bookings/${container.id}`)
      if (selectedContainer?.id === container.id) setSelectedContainer(null)
      setAlert({ type: "success", message: data.message || "Container booking deleted successfully." })
      await refreshInventory({ refreshYard: true })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setDeletingId("")
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
              Containers appear here after Gate-In approval. Authorized admins can register existing containers, manage storage locations, and start or complete eligible Gate-Out transactions directly from Inventory. Waiting-for-storage records remain prioritized first.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {canCreateLegacyContainer && (
              <button type="button" onClick={() => setLegacyModalOpen(true)} className="btn-primary shrink-0" title="Register an existing container">
                <Plus size={16} /> Add Existing Container
              </button>
            )}
            <button type="button" onClick={loadAll} className="btn-secondary shrink-0" disabled={loading || tableLoading}>
              <RefreshCw size={16} className={loading || tableLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Area Capacity" value={`${summary?.totalAreaCapacityTeu || 0} TEU`} icon={Warehouse} />
          <StatCard label="Total Containers" value={inventoryStats.totalContainers} icon={MapPin} />
          <StatCard label="Waiting Storage" value={inventoryStats.waitingStorage} icon={PackageCheck} />
          <StatCard label="Inventory TEU" value={Math.round(inventoryStats.inventoryTeu * 100) / 100} icon={CalendarClock} />
          <StatCard label="Inventory FEU" value={Math.round(inventoryStats.inventoryFeu * 100) / 100} icon={Database} />
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
                  {(selectedAreaId ? 1 : 0) + (selectedClientId !== "all" ? 1 : 0) + (selectedStatus !== "all" ? 1 : 0) + (selectedLoadStatus !== "all" ? 1 : 0) + (selectedRateType !== "all" ? 1 : 0) + (selectedRecordSource !== "all" ? 1 : 0)}
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
                        setSelectedClientId("all")
                        setSelectedStatus(DEFAULT_INVENTORY_STATUS)
                        setSelectedLoadStatus("all")
                        setSelectedRateType("all")
                        setSelectedRecordSource("all")
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-4">
                    <Field label="Client">
                      <select className="input" value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                        <option value="all">All clients</option>
                        {clientOptions.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                      </select>
                    </Field>
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
                    <Field label="Record Source">
                      <select className="input" value={selectedRecordSource} onChange={(event) => setSelectedRecordSource(event.target.value)}>
                        <option value="all">All record sources</option>
                        <option value="client_booking">Client booking</option>
                        <option value="legacy_migration">Legacy migration</option>
                        <option value="admin_manual">Admin manual</option>
                      </select>
                    </Field>
                    <ContainerClassificationFilters
                      loadStatus={selectedLoadStatus}
                      rateType={selectedRateType}
                      onLoadStatusChange={setSelectedLoadStatus}
                      onRateTypeChange={setSelectedRateType}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
          Showing {filteredContainers.length} matching containers • {inventoryStats.totalContainers} total in inventory{inventoryTruncated ? " • result limit reached; refine filters to narrow the list" : ""}
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
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(loading || tableLoading) && filteredContainers.length === 0 && <TableLoadingRow colSpan={7} rows={7} actionColumn label="Loading inventory containers" />}
              {filteredContainers.length === 0 && !loading && !tableLoading && (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center font-bold text-slate-500">No Gate-In accepted containers found.</td>
                </tr>
              )}
              {containerPagination.paginatedItems.map((container) => {
                const canRelocate = ["approved_area_assigned", "gate_in_approved", "stored_in_assigned_area"].includes(container.bookingStatus)
                const canStartGateOut = container.bookingStatus === "stored_in_assigned_area"
                const canCompleteGateOut = container.bookingStatus === "gate_out_approved"
                const gateOutPending = ["gate_out_requested", "gate_out_reversal_requested"].includes(container.bookingStatus)
                const showGateOutAction = canStartGateOut || canCompleteGateOut || gateOutPending
                const gateOutLabel = canStartGateOut
                  ? `Start Gate Out for ${container.containerNumber}`
                  : canCompleteGateOut
                    ? `Complete Gate Out and release ${container.containerNumber}`
                    : container.bookingStatus === "gate_out_reversal_requested"
                      ? `Gate-Out reversal for ${container.containerNumber} is pending review`
                      : `Gate-Out for ${container.containerNumber} is pending payment or approval`

                return (
                  <tr key={container.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="font-black text-slate-950">{container.containerNumber}</div>
                      <div className="text-xs font-semibold text-slate-500">{container.bookingReference}</div>
                      {container.recordSource === "legacy_migration" && <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">Legacy Record</span>}
                      <div className="mt-1 text-xs font-bold text-emerald-700">Gate-In accepted: {formatDate(container.inventoryEnteredAt || container.gateInApprovedAt || container.storedAt)}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600"><div>{container.clientName || "-"}</div>{container.isCMASpecialClient && <div className="mt-2 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">CMA: {container.cmaClientName || container.cmaClientCode || "Special Client"}</div>}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">
                      <div>{container.areaName || "No area"}</div>
                      <div className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">{getAreaSlotLabel(container)}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600">
                      <div>{container.containerSize}ft • {container.containerType?.replace("_", " ")}</div>
                      <ContainerClassificationBadges loadStatus={container.containerLoadStatus || container.containerStatus} rateType={container.rateType} className="mt-2" compact />
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(container.bookingStatus)}`}>{statusLabel[container.bookingStatus] || container.bookingStatus}</span>
                      {container.isOverstaying && <span className="mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">Overstaying</span>}
                    </td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${billingClass(container.billingStatus)}`}>{billingLabel[container.billingStatus] || container.billingStatus}</span></td>
                    <td className="px-5 py-4">
                      <TableCrudActions
                        recordLabel={container.containerNumber}
                        onView={() => setSelectedContainer(container)}
                        onEdit={() => openLocationModal(container)}
                        onDelete={() => deleteContainerRecord(container)}
                        editDisabled={!canRelocate}
                        editLabel={canRelocate ? `Edit location for ${container.containerNumber}` : `Location editing is unavailable for ${container.containerNumber} in its current status`}
                        deleteDisabled={!canDeleteBooking}
                        deleteLabel={canDeleteBooking ? `Delete ${container.containerNumber}` : "You do not have permission to delete container bookings"}
                        deleting={deletingId === container.id}
                      >
                        <TableActionButton
                          label={container.bookingStatus === "gate_in_approved"
                            ? `Mark ${container.containerNumber} as stored`
                            : `${container.containerNumber} is already stored or no longer eligible`}
                          variant="success"
                          disabled={container.bookingStatus !== "gate_in_approved"}
                          loading={storingId === container.id}
                          onClick={() => handleMarkStored(container)}
                        >
                          <PackageCheck size={17} aria-hidden="true" />
                        </TableActionButton>
                        {showGateOutAction && (
                          <TableActionButton
                            label={!canManageInventoryGateOut ? "You do not have permission to process Gate Out from Inventory" : gateOutLabel}
                            variant={canCompleteGateOut ? "success" : "warning"}
                            disabled={!canManageInventoryGateOut || gateOutPending}
                            loading={gateOutSaving && gateOutContainer?.id === container.id}
                            onClick={() => openInventoryGateOut(container)}
                          >
                            <LogOut size={17} aria-hidden="true" />
                          </TableActionButton>
                        )}
                      </TableCrudActions>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...containerPagination} />
      </div>


      {selectedContainer && (
        <div className="fixed inset-0 z-[9997] grid place-items-center bg-slate-950/[0.55] p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-emerald-700">Inventory Details</div>
                <div className="mt-2">
                  <h2 className="text-2xl font-black text-slate-950">{selectedContainer.containerNumber}</h2>
                  <ContainerClassificationBadges
                    loadStatus={selectedContainer.containerLoadStatus || selectedContainer.containerStatus}
                    rateType={selectedContainer.rateType}
                    className="mt-3"
                  />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedContainer.bookingReference} • {selectedContainer.clientName || "Client"}</p>
                {selectedContainer.recordSource === "legacy_migration" && <span className="mt-3 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700">Legacy / Migrated Record</span>}
                {selectedContainer.isCMASpecialClient && <span className="mt-3 ml-2 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700">CMA Special Client</span>}
              </div>
              <ModalCloseButton onClick={() => setSelectedContainer(null)} label="Close inventory details" />
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Booking Status" value={statusLabel[selectedContainer.bookingStatus] || selectedContainer.bookingStatus} />
                <Detail label="Billing Status" value={billingLabel[selectedContainer.billingStatus] || selectedContainer.billingStatus} />
                <Detail label="Container" value={`${selectedContainer.containerSize}ft • ${String(selectedContainer.containerType || "").replaceAll("_", " ")}`} />
                <Detail label="Load Status" value={(selectedContainer.containerLoadStatus || selectedContainer.containerStatus) === "laden" ? "Laden" : (selectedContainer.containerLoadStatus || selectedContainer.containerStatus) === "empty" ? "Empty" : "Unknown"} />
                <Detail label="Rate Classification" value={selectedContainer.rateType === "international" ? "International" : "Local"} />
                {selectedContainer.isCMASpecialClient && <Detail label="CMA Client" value={`${selectedContainer.cmaClientName || "CMA"}${selectedContainer.cmaClientCode ? ` (${selectedContainer.cmaClientCode})` : ""}`} />}
                {selectedContainer.isCMASpecialClient && <Detail label="CMA Identification" value={String(selectedContainer.cmaIdentificationSource || "").replaceAll("_", " ")} />}
                <Detail label="Yard Area" value={selectedContainer.areaName} />
                <Detail label="Slot" value={getAreaSlotLabel(selectedContainer)} />
                <Detail label="Gate-In Accepted" value={formatDate(selectedContainer.inventoryEnteredAt || selectedContainer.gateInApprovedAt)} />
                <Detail label="Stored At" value={formatDate(selectedContainer.storedAt)} />
                <Detail label="Date / Time Out" value={formatDate(selectedContainer.outDate)} />
                <Detail label="Gate-Out Schedule" value={selectedContainer.isOverstaying ? "Overstaying" : selectedContainer.gateOutScheduleStatus} />
                <Detail label="Overstay Started" value={formatDate(selectedContainer.gateOutOverstayStartedAt)} />
                {selectedContainer.recordSource === "legacy_migration" && <>
                  <Detail label="Legacy Registration No." value={selectedContainer.legacyRegistrationNumber} />
                  <Detail label="Registered By" value={selectedContainer.legacyRegisteredByName} />
                  <Detail label="Registered At" value={formatDate(selectedContainer.legacyRegisteredAt)} />
                  <Detail label="Registration Reason" value={selectedContainer.legacyRegistrationReason} />
                  <Detail label="Historical Date Quality" value={selectedContainer.historicalGateInDateType} />
                  <Detail label="Original Reference" value={selectedContainer.historicalSourceReference} />
                  <Detail label="Billing Start Method" value={selectedContainer.billingStartMethod === "historical_gate_in" ? "Historical Gate-In date" : "Migration date"} />
                  <Detail label="Opening Balance" value={`PHP ${Number(selectedContainer.openingBalanceAmount || 0).toLocaleString()}`} />
                  <Detail label="Opening Credit" value={`PHP ${Number(selectedContainer.openingCreditAmount || 0).toLocaleString()}`} />
                </>}
              </div>

              {selectedContainer.documents?.length > 0 && (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">Supporting Documents</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedContainer.documents.map((document, index) => (
                      <a key={`${document.publicId || document.url}-${index}`} href={resolveFileUrl(document.secureUrl || document.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50">
                        <Upload size={14} /> {document.label || document.fileName || `Document ${index + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <WorkflowDecisionPanel
                icon={PackageCheck}
                eyebrow="Inventory Review"
                title="Storage Decision"
                description="Confirm that the Gate-In accepted container is physically in its assigned slot before approving storage."
                approveLabel="Approve Storage / Mark Stored"
                approveIcon={PackageCheck}
                onApprove={() => handleMarkStored(selectedContainer)}
                approveDisabled={storingId === selectedContainer.id || selectedContainer.bookingStatus !== "gate_in_approved"}
                note={selectedContainer.bookingStatus === "gate_in_approved"
                  ? "Approving storage computes the billing start and moves this container into Storage Monitoring."
                  : "This storage action is already completed or is unavailable for the current status."}
              >
                <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div><span className="font-black text-slate-500">Assigned Area:</span> {selectedContainer.areaName || "-"}</div>
                  <div><span className="font-black text-slate-500">Assigned Slot:</span> {getAreaSlotLabel(selectedContainer)}</div>
                  <div><span className="font-black text-slate-500">Gate-In Accepted:</span> {formatDate(selectedContainer.inventoryEnteredAt || selectedContainer.gateInApprovedAt)}</div>
                  <div><span className="font-black text-slate-500">Storage Status:</span> {selectedContainer.bookingStatus === "gate_in_approved" ? "Waiting for approval" : "Completed"}</div>
                </div>
              </WorkflowDecisionPanel>

              {["stored_in_assigned_area", "gate_out_requested", "gate_out_approved", "gate_out_reversal_requested"].includes(selectedContainer.bookingStatus) && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <LogOut size={20} />
                      </span>
                      <div>
                        <div className="text-xs font-black uppercase tracking-wide text-emerald-700">Gate-Out Action</div>
                        <h3 className="mt-1 text-lg font-black text-slate-950">
                          {selectedContainer.bookingStatus === "stored_in_assigned_area"
                            ? "Start Gate Out from Inventory"
                            : selectedContainer.bookingStatus === "gate_out_approved"
                              ? "Complete Physical Gate Out"
                              : "Gate Out is already in progress"}
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                          {selectedContainer.bookingStatus === "stored_in_assigned_area"
                            ? "Select Date Out to compute the Gate-Out transaction using the container's current rate classification."
                            : selectedContainer.bookingStatus === "gate_out_approved"
                              ? "Payment and Gate-Out approval are complete. Record the final condition and release the container from its yard slot."
                              : selectedContainer.bookingStatus === "gate_out_reversal_requested"
                                ? "A Gate-Out reversal request is pending review. Release is temporarily blocked."
                                : "The Gate-Out request is waiting for payment and/or approval in the Gate Out workflow."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={selectedContainer.bookingStatus === "gate_out_approved" ? "btn-primary shrink-0" : "btn-secondary shrink-0"}
                      onClick={() => openInventoryGateOut(selectedContainer)}
                      disabled={!canManageInventoryGateOut || !["stored_in_assigned_area", "gate_out_approved"].includes(selectedContainer.bookingStatus)}
                    >
                      <LogOut size={16} />
                      {selectedContainer.bookingStatus === "gate_out_approved"
                        ? "Complete Gate Out"
                        : selectedContainer.bookingStatus === "stored_in_assigned_area"
                          ? "Start Gate Out"
                          : selectedContainer.bookingStatus === "gate_out_reversal_requested"
                            ? "Reversal Pending"
                            : "Gate Out Pending"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <InventoryGateOutModal
        container={gateOutContainer}
        form={gateOutForm}
        setForm={setGateOutForm}
        saving={gateOutSaving}
        onClose={closeInventoryGateOut}
        onSubmit={handleInventoryGateOutSubmit}
      />

      <LegacyContainerModal
        open={legacyModalOpen}
        areas={areas}
        onClose={() => setLegacyModalOpen(false)}
        onCreated={handleLegacyContainerCreated}
      />

      <LocationModal
        open={modalOpen}
        container={editingContainer}
        areas={areas}
        blocks={modalBlocks}
        slots={modalSlots}
        loadingBlocks={loadingBlocks}
        loadingSlots={modalSlotsLoading}
        saving={savingLocation}
        onClose={closeLocationModal}
        onAreaChange={handleModalAreaChange}
        onSubmit={handleLocationSubmit}
        form={locationForm}
        setForm={setLocationForm}
      />
    </div>
  )
}

const Detail = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 break-words text-sm font-bold text-slate-800">{value || "N/A"}</div>
  </div>
)

export default AdminInventory
