import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Eye,
  MapPinned,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ShieldX,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react"
import Alert from "../../components/Alert"
import InputDate from "../../components/ui/InputDate"
import Pagination from "../../components/ui/Pagination"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"
import { api, getApiError, resolveFileUrl } from "../../lib/api"
import { useAuthStore } from "../../stores/authStore"
import { hasModulePermission } from "../../lib/permissions"

const statusLabels = {
  pending_admin_approval: "Pending Admin Approval",
  approved_area_assigned: "Approved / Area Assigned",
  rejected: "Rejected",
  gate_in_approved: "Gate-In Approved",
  stored_in_assigned_area: "Stored in Assigned Area",
  gate_out_requested: "Gate-Out Requested",
  gate_out_approved: "Gate-Out Approved",
  completed_gate_out_done: "Completed / Gate-Out Done",
  cancelled: "Cancelled",
}

const toDateOnlyString = (value) => {
  if (!value) return ""
  if (typeof value === "string") return value.slice(0, 10)

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const billingLabels = {
  unpaid: "Unpaid",
  payment_submitted: "Payment Submitted",
  payment_under_review: "Payment Under Review",
  payment_rejected: "Payment Rejected",
  paid_approved: "Paid / Approved",
}

const moduleConfig = {
  preAdvice: {
    badge: "Pre-Advice Verification",
    title: "Booking Pre-Advice Verification",
    description:
      "Every client booking automatically enters this queue as pre-advice. Verify the booking details, check yard capacity, and assign a yard area before approval.",
    icon: ClipboardList,
    defaultStatus: "pending_admin_approval",
    defaultBillingStatus: "all",
    primarySection: "approval",
    queueTitle: "Bookings Pending Pre-Advice Verification",
  },
  gateIn: {
    badge: "Gate-In Module",
    title: "Gate-In Verification and Inspection",
    description:
      "This is where gate staff checks booking details, assigned location, truck and driver details, physical container condition, and approves gate-in.",
    icon: Truck,
    defaultStatus: "approved_area_assigned",
    defaultBillingStatus: "all",
    primarySection: "gateIn",
    queueTitle: "Bookings Ready for Gate-In",
  },
  billing: {
    badge: "Payment Verification Module",
    title: "Payment Verification and Approval",
    description:
      "Review the system-generated payment reference, amount, payment proof, and approve or reject the client payment submission.",
    icon: Banknote,
    defaultStatus: "all",
    defaultBillingStatus: "payment_under_review",
    primarySection: "billing",
    queueTitle: "Payments Under Review",
  },
  gateOut: {
    badge: "Gate-Out Module",
    title: "Gate-Out Request and Release Approval",
    description:
      "This is where admin reviews client gate-out requests, confirms payment approval, checks for holds, approves release, and completes gate-out.",
    icon: PackageCheck,
    defaultStatus: "gate_out_requested",
    defaultBillingStatus: "all",
    primarySection: "gateOut",
    queueTitle: "Gate-Out Requests",
  },
}

const statusClass = (status) => {
  if (["stored_in_assigned_area", "completed_gate_out_done", "paid_approved"].includes(status)) return "bg-blue-50 text-blue-700"
  if (["approved_area_assigned", "gate_in_approved", "gate_out_approved"].includes(status)) return "bg-blue-50 text-blue-700"
  if (["rejected", "cancelled", "payment_rejected"].includes(status)) return "bg-red-50 text-red-700"
  return "bg-amber-50 text-amber-700"
}

const formatDate = (value) => {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

const getBookingInDate = (booking = {}) => booking.inDate || booking.expectedArrivalDate
const getBookingOutDate = (booking = {}) => booking.outDate

const getRequiredYardCapacity = (containerSize, yardContainerSize) => {
  const bookingSize = Number(containerSize) || 20
  const yardSize = Number(yardContainerSize) || 20
  if (yardSize === 20) return bookingSize === 40 ? 2 : 1
  return bookingSize === 20 ? 0.5 : 1
}

const blockHasCapacity = (block, booking) => {
  if (!block || !booking) return false
  return Number(block.availableSlots || 0) >= getRequiredYardCapacity(booking.containerSize, block.containerSize)
}

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs font-semibold text-slate-400">{hint}</span>}
  </label>
)

const initialGateIn = {
  actualContainerNumber: "",
  physicalCondition: "Good",
  sealNumber: "",
  truckPlateNumber: "",
  driverName: "",
  driverLicenseNumber: "",
  inspectionRemarks: "",
}

const AdminBookingModule = ({ mode }) => {
  const config = moduleConfig[mode] || moduleConfig.preAdvice
  const HeaderIcon = config.icon
  const isPreAdviceApprovalMode = mode === "preAdvice"
  const bookingBasePath = isPreAdviceApprovalMode ? "/admin/pre-advice-bookings" : "/admin/bookings"
  const yardBasePath = isPreAdviceApprovalMode ? "/admin/pre-advice-bookings/yard" : "/admin/yard"

  const [bookings, setBookings] = useState([])
  const [summary, setSummary] = useState({})
  const [areas, setAreas] = useState([])
  const [blocks, setBlocks] = useState([])
  const [slotAvailability, setSlotAvailability] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [filters, setFilters] = useState({ status: config.defaultStatus, billingStatus: config.defaultBillingStatus, search: "" })
  const [approval, setApproval] = useState({ areaId: "", blockId: "", bay: 1, row: 1, tier: 1 })
  const [gateIn, setGateIn] = useState(initialGateIn)
  const [rejectReason, setRejectReason] = useState("")
  const [paymentRejectReason, setPaymentRejectReason] = useState("")
  const [additionalCharge, setAdditionalCharge] = useState({ description: "", quantity: "1", rateAmount: "", notes: "" })
  const [cashPayment, setCashPayment] = useState({ paymentDate: new Date().toISOString().slice(0, 10), paymentReferenceNumber: "", paymentRemarks: "" })
  const [congestionOption, setCongestionOption] = useState(null)
  const [congestionLoading, setCongestionLoading] = useState(false)
  const [remarks, setRemarks] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const [alert, setAlert] = useState({ type: "", message: "" })
  const user = useAuthStore((state) => state.user)
  const canDeleteBooking = hasModulePermission(user, "operations", "delete")
  const bookingsRequestRef = useRef({ key: "", promise: null })
  const areasRequestRef = useRef({ key: "", promise: null })
  const blocksRequestRef = useRef({ key: "", promise: null })
  const slotsRequestRef = useRef({ key: "", promise: null })
  const realtimeRefreshTimerRef = useRef(null)

  const selectedBooking = useMemo(() => bookings.find((booking) => booking.id === selectedId) || null, [bookings, selectedId])
  const selectedBlock = useMemo(() => blocks.find((block) => String(block.id) === String(approval.blockId)), [blocks, approval.blockId])
  const usableBlocks = useMemo(() => blocks.filter((block) => {
    const isActive = !block.status || block.status === "active"

    // In the Pre-advice Module, the admin selects a Yard Area only.
    // The backend keeps an internal location record for slot tracking, but the UI does not expose Block anymore.
    if (isPreAdviceApprovalMode) return isActive

    const bookingSize = Number(selectedBooking?.containerSize)
    const blockSize = Number(block.containerSize)
    const matchesSize = !bookingSize || !blockSize || blockSize === bookingSize || (bookingSize === 40 && blockSize === 20)
    return matchesSize && isActive
  }).sort((left, right) => Number(Boolean(left.isCongestionArea)) - Number(Boolean(right.isCongestionArea))), [blocks, selectedBooking, isPreAdviceApprovalMode])
  const regularYardHasSpace = useMemo(
    () => usableBlocks.some((block) => !block.isCongestionArea && blockHasCapacity(block, selectedBooking)),
    [usableBlocks, selectedBooking],
  )
  const hasCongestionArea = useMemo(
    () => usableBlocks.some((block) => block.isCongestionArea),
    [usableBlocks],
  )
  const selectedBlockHasCapacity = selectedBlock ? blockHasCapacity(selectedBlock, selectedBooking) : false
  const selectedUsesCongestionArea = Boolean(selectedBlock?.isCongestionArea)
  const unavailableSlotKeys = useMemo(() => new Set(slotAvailability.map((slot) => slot.key)), [slotAvailability])
  const selectedSlotKeys = useMemo(() => {
    const bay = Number(approval.bay || 1)
    const row = Number(approval.row || 1)
    const tier = Number(approval.tier || 1)
    const keys = [`${bay}-${row}-${tier}`]
    if (Number(selectedBooking?.containerSize) === 40 && Number(selectedBlock?.containerSize) === 20) {
      keys.push(`${bay + 1}-${row}-${tier}`)
    }
    return keys
  }, [approval.bay, approval.row, approval.tier, selectedBooking?.containerSize, selectedBlock?.containerSize])
  const selectedSlotOutOfBounds = Boolean(
    approval.blockId &&
    Number(selectedBooking?.containerSize) === 40 &&
    Number(selectedBlock?.containerSize) === 20 &&
    Number(approval.bay || 1) + 1 > Number(selectedBlock?.bayCount || selectedBlock?.lineCount || 1),
  )
  const selectedSlotTaken = approval.blockId ? selectedSlotKeys.some((key) => unavailableSlotKeys.has(key)) : false
  const bayOptions = useMemo(() => Array.from({ length: selectedBlock?.bayCount || selectedBlock?.lineCount || 1 }, (_, index) => index + 1), [selectedBlock])
  const rowOptions = useMemo(() => Array.from({ length: selectedBlock?.rowCount || 1 }, (_, index) => index + 1), [selectedBlock])
  const tierOptions = useMemo(() => Array.from({ length: selectedBlock?.tierCount || 1 }, (_, index) => index + 1), [selectedBlock])

  const loadBookings = useCallback(async ({ force = false } = {}) => {
    const params = new URLSearchParams()
    if (filters.status) params.set("status", filters.status)
    if (filters.billingStatus) params.set("billingStatus", filters.billingStatus)
    if (filters.search) params.set("search", filters.search)

    const requestKey = `${bookingBasePath}?${params.toString()}`
    if (!force && bookingsRequestRef.current.key === requestKey && bookingsRequestRef.current.promise) {
      return bookingsRequestRef.current.promise
    }

    const request = (async () => {
      try {
        setLoading(true)
        const [{ data }, summaryResponse] = await Promise.all([
          api.get(requestKey),
          api.get("/admin/bookings/summary").catch(() => ({ data: { summary: {} } })),
        ])
        const nextBookings = data.bookings || []
        setBookings(nextBookings)
        setSummary(summaryResponse.data.summary || {})
        setSelectedId((current) => current && nextBookings.some((booking) => booking.id === current) ? current : "")
      } catch (error) {
        setAlert({ type: "error", message: getApiError(error) })
      } finally {
        if (bookingsRequestRef.current.promise === request) {
          bookingsRequestRef.current = { key: "", promise: null }
        }
        setLoading(false)
      }
    })()

    bookingsRequestRef.current = { key: requestKey, promise: request }
    return request
  }, [bookingBasePath, filters.billingStatus, filters.search, filters.status])

  const loadAreas = useCallback(async ({ force = false } = {}) => {
    const requestKey = isPreAdviceApprovalMode ? `${yardBasePath}/blocks` : `${yardBasePath}/areas`
    if (!force && areasRequestRef.current.key === requestKey && areasRequestRef.current.promise) {
      return areasRequestRef.current.promise
    }

    const request = (async () => {
      try {
        if (isPreAdviceApprovalMode) {
          const { data } = await api.get(requestKey)
          setAreas(data.areas || [])
          setBlocks(data.blocks || [])
          return
        }

        const { data } = await api.get(requestKey)
        setAreas(data.areas || [])
      } catch (error) {
        setAreas([])
        setBlocks([])
        setAlert({ type: "error", message: getApiError(error) })
      } finally {
        if (areasRequestRef.current.promise === request) {
          areasRequestRef.current = { key: "", promise: null }
        }
      }
    })()

    areasRequestRef.current = { key: requestKey, promise: request }
    return request
  }, [isPreAdviceApprovalMode, yardBasePath])

  const loadBlocks = useCallback(async (areaId, { force = false } = {}) => {
    if (!areaId) {
      setBlocks([])
      return Promise.resolve()
    }

    const requestKey = `${yardBasePath}/areas/${areaId}/blocks`
    if (!force && blocksRequestRef.current.key === requestKey && blocksRequestRef.current.promise) {
      return blocksRequestRef.current.promise
    }

    const request = (async () => {
      try {
        const { data } = await api.get(requestKey)
        setBlocks(data.blocks || [])
      } catch (error) {
        setAlert({ type: "error", message: getApiError(error) })
      } finally {
        if (blocksRequestRef.current.promise === request) {
          blocksRequestRef.current = { key: "", promise: null }
        }
      }
    })()

    blocksRequestRef.current = { key: requestKey, promise: request }
    return request
  }, [yardBasePath])

  const loadSlotAvailability = useCallback(async (blockId, { force = false } = {}) => {
    if (!blockId) {
      setSlotAvailability([])
      return Promise.resolve()
    }

    const requestKey = `${bookingBasePath}/yard/blocks/${blockId}/slots`
    if (!force && slotsRequestRef.current.key === requestKey && slotsRequestRef.current.promise) {
      return slotsRequestRef.current.promise
    }

    const request = (async () => {
      try {
        const { data } = await api.get(requestKey)
        setSlotAvailability(data.slots || [])
      } catch (error) {
        setSlotAvailability([])
        setAlert({ type: "error", message: getApiError(error) })
      } finally {
        if (slotsRequestRef.current.promise === request) {
          slotsRequestRef.current = { key: "", promise: null }
        }
      }
    })()

    slotsRequestRef.current = { key: requestKey, promise: request }
    return request
  }, [bookingBasePath])


  useEffect(() => {
    setFilters({ status: config.defaultStatus, billingStatus: config.defaultBillingStatus, search: "" })
    setSelectedId("")
    setAlert({ type: "", message: "" })
  }, [mode])

  useEffect(() => {
    loadBookings()
  }, [filters.status, filters.billingStatus])

  useEffect(() => {
    if (config.primarySection === "approval") loadAreas()
  }, [config.primarySection, loadAreas])

  useEffect(() => {
    if (!selectedBooking) return

    setApproval({
      areaId: selectedBooking.assignedArea || "",
      blockId: selectedBooking.assignedBlock || "",
      bay: selectedBooking.assignedBay || 1,
      row: selectedBooking.assignedRow || 1,
      tier: selectedBooking.assignedTier || 1,
    })

    setGateIn({
      actualContainerNumber: selectedBooking.actualContainerNumber || selectedBooking.containerNumber || "",
      physicalCondition: selectedBooking.physicalCondition || "Good",
      sealNumber: selectedBooking.sealNumber || "",
      truckPlateNumber: selectedBooking.truckPlateNumber || "",
      driverName: selectedBooking.driverName || "",
      driverLicenseNumber: selectedBooking.driverLicenseNumber || "",
      inspectionRemarks: selectedBooking.inspectionRemarks || "",
    })
    setCashPayment({
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentReferenceNumber: "",
      paymentRemarks: "",
    })

  }, [selectedBooking?.id])

  useEffect(() => {
    if (config.primarySection !== "approval" || !isPreAdviceApprovalMode || !selectedBooking?.id) {
      setCongestionOption(null)
      return
    }
    let active = true
    setCongestionLoading(true)
    api.get(`${bookingBasePath}/${selectedBooking.id}/congestion-surcharge`)
      .then(({ data }) => {
        if (active) setCongestionOption(data.option || null)
      })
      .catch(() => {
        if (active) setCongestionOption(null)
      })
      .finally(() => {
        if (active) setCongestionLoading(false)
      })
    return () => { active = false }
  }, [bookingBasePath, config.primarySection, isPreAdviceApprovalMode, selectedBooking?.id, selectedBooking?.updatedAt, blocks])

  useEffect(() => {
    if (config.primarySection === "approval" && !isPreAdviceApprovalMode) loadBlocks(approval.areaId)
  }, [approval.areaId, config.primarySection, isPreAdviceApprovalMode, loadBlocks])

  useEffect(() => {
    if (config.primarySection === "approval") loadSlotAvailability(approval.blockId)
  }, [approval.blockId, config.primarySection, loadSlotAvailability])

  const shouldRefreshForRealtimeEvent = useCallback((eventType) => {
    if (!eventType) return false
    if (isPreAdviceApprovalMode) return eventType.startsWith("booking:") || eventType.startsWith("preAdvice:") || eventType.startsWith("yard:")
    if (config.primarySection === "gateIn") return eventType.startsWith("gateIn:") || eventType === "booking:gate_in_approved" || eventType === "booking:approved" || eventType === "booking:rejected"
    if (config.primarySection === "billing") return eventType.includes("payment_") || eventType === "booking:billing_operation_updated" || eventType === "booking:gate_out_requested"
    if (config.primarySection === "gateOut") return eventType.includes("gate_out") || eventType === "booking:completed" || eventType === "booking:payment_approved"
    return eventType.startsWith("booking:") || eventType.startsWith("yard:") || eventType.startsWith("inventory:")
  }, [config.primarySection, isPreAdviceApprovalMode])

  useEffect(() => {
    const handleRealtime = (event) => {
      const eventType = event.detail?.type || ""
      if (!shouldRefreshForRealtimeEvent(eventType)) return

      window.clearTimeout(realtimeRefreshTimerRef.current)
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        loadBookings({ force: true })
        if (config.primarySection === "approval" && approval.blockId) {
          loadSlotAvailability(approval.blockId, { force: true })
        }
      }, 350)
    }

    window.addEventListener("otli:realtime", handleRealtime)
    return () => {
      window.removeEventListener("otli:realtime", handleRealtime)
      window.clearTimeout(realtimeRefreshTimerRef.current)
    }
  }, [approval.blockId, config.primarySection, loadBookings, loadSlotAvailability, shouldRefreshForRealtimeEvent])

  const runAction = async (callback, message) => {
    if (!selectedBooking) return
    setAlert({ type: "", message: "" })
    try {
      setSaving(true)
      await callback()
      setAlert({ type: "success", message })
      await loadBookings({ force: true })
      return true
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleApprovalAreaChange = (areaLocationId) => {
    const areaLocation = blocks.find((item) => String(item.id) === String(areaLocationId))
    setApproval((current) => ({
      ...current,
      areaId: areaLocation?.area || areaLocationId || "",
      blockId: areaLocation?.id || "",
      bay: 1,
      row: 1,
      tier: 1,
    }))
  }

  const approveBooking = () => runAction(
    () => api.patch(`${bookingBasePath}/${selectedBooking.id}/approve`, approval),
    isPreAdviceApprovalMode ? "Pre-advice approved and yard location assigned." : "Booking approved and yard area assigned."
  )

  const rejectBooking = () => runAction(
    () => api.patch(`${bookingBasePath}/${selectedBooking.id}/reject`, { reason: rejectReason }),
    isPreAdviceApprovalMode ? "Pre-advice rejected." : "Booking rejected."
  )

  const approveGateIn = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-in`, gateIn),
    "Gate-In approved and moved to Inventory."
  )

  const rejectGateIn = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-in/reject`, { reason: rejectReason }),
    "Gate-In rejected and the reserved yard slots were released."
  )

  const approvePayment = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/payment/approve`, { remarks }),
    "Payment approved. You can still view it by choosing Approved Payments / Paid Approved in this module."
  )

  const recordCashPayment = () => runAction(
    () => api.post(`/admin/bookings/${selectedBooking.id}/payment/cash`, {
      ...cashPayment,
      amount: Number(selectedBooking.billingTotal || selectedBooking.paymentAmount || 0),
    }),
    "Cash payment recorded and approved."
  )

  const addAdditionalCharge = () => {
    if (!additionalCharge.description.trim() || Number(additionalCharge.rateAmount) <= 0) {
      setAlert({ type: "error", message: "Enter an additional charge description and a rate greater than zero." })
      return
    }
    return runAction(
      () => api.post(`/admin/bookings/${selectedBooking.id}/additional-charges`, additionalCharge),
      "Additional billing charge added."
    ).then((success) => {
      if (success) setAdditionalCharge({ description: "", quantity: "1", rateAmount: "", notes: "" })
    })
  }

  const removeAdditionalCharge = (chargeId) => runAction(
    () => api.delete(`/admin/bookings/${selectedBooking.id}/additional-charges/${chargeId}`),
    "Additional billing charge removed."
  )

  const rejectPayment = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/payment/reject`, { reason: paymentRejectReason }),
    "Payment rejected."
  )

  const approveGateOut = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/approve`, { remarks }),
    "Gate-Out approved."
  )

  const completeGateOut = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/complete`, { actualContainerNumber: selectedBooking.containerNumber, remarks }),
    "Container released. The release report was generated and revenue was recorded."
  )

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  const pagination = usePagination(
    bookings,
    10,
    `${mode}|${filters.status}|${filters.billingStatus}|${filters.search}`,
  )

  const moduleStats = useMemo(() => {
    if (mode === "preAdvice") {
      return [
        { label: "Total Bookings", value: summary.total || 0, icon: ClipboardList, tone: "slate" },
        { label: "Pending Review", value: summary.pending || 0, icon: ClipboardCheck, tone: "amber" },
        { label: "Approved", value: summary.approved || 0, icon: CheckCircle2, tone: "blue" },
      ]
    }

    if (mode === "gateIn") {
      return [
        { label: "Ready for Gate-In", value: summary.approved || 0, icon: Truck, tone: "amber" },
        { label: "Gate-In Approved", value: summary.gateIn || 0, icon: ClipboardCheck, tone: "blue" },
        { label: "Stored", value: summary.stored || 0, icon: Warehouse, tone: "emerald" },
      ]
    }

    if (mode === "billing") {
      return [
        { label: "Unpaid", value: summary.unpaid || 0, icon: Banknote, tone: "amber" },
        { label: "Under Review", value: summary.paymentReview || 0, icon: CreditCard, tone: "blue" },
        { label: "Paid / Approved", value: summary.paid || 0, icon: CheckCircle2, tone: "emerald" },
      ]
    }

    return [
      { label: "Gate-Out Requests", value: summary.gateOutRequested || 0, icon: PackageCheck, tone: "amber" },
      { label: "Paid Containers", value: summary.paid || 0, icon: CreditCard, tone: "blue" },
      { label: "Completed", value: summary.completed || 0, icon: CheckCircle2, tone: "emerald" },
    ]
  }, [mode, summary])

  const toneClasses = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }

  const handleSearch = () => loadBookings({ force: true })

  const deleteBooking = async (booking) => {
    if (!canDeleteBooking) return
    const confirmed = window.confirm(
      `Delete booking ${booking.bookingReference}? This permanently removes the booking and its uploaded documents.`,
    )
    if (!confirmed) return

    try {
      setDeletingId(booking.id)
      setAlert({ type: "", message: "" })
      const { data } = await api.delete(`/admin/bookings/${booking.id}`)
      if (selectedId === booking.id) setSelectedId("")
      await loadBookings({ force: true })
      setAlert({ type: "success", message: data.message || "Booking deleted successfully." })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setDeletingId("")
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700">
              <HeaderIcon size={15} /> {config.badge}
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{config.title}</h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">{config.description}</p>
          </div>
          <button type="button" onClick={handleSearch} className="btn-secondary shrink-0" disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {moduleStats.map((stat) => (
            <div key={stat.label} className={`rounded-2xl border p-5 ${toneClasses[stat.tone]}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide opacity-80">{stat.label}</div>
                  <div className="mt-2 text-3xl font-black">{stat.value}</div>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/80 shadow-sm">
                  <stat.icon size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      <section className="card overflow-visible">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">{config.queueTitle}</h2>
            <p className="text-sm font-semibold text-slate-500">Search and filter records before opening the complete booking details.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                className="input w-full !rounded-2xl !py-3 !pl-10 !pr-4 text-sm sm:w-[320px]"
                placeholder="Search reference, container, client..."
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              />
            </div>

            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                <SlidersHorizontal size={18} /> Filters
              </button>

              {showFilters && (
                <div className="absolute right-0 z-40 mt-2 w-[300px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-sm font-black text-slate-950">Filter Records</p>
                    <button
                      type="button"
                      className="text-xs font-black text-emerald-700"
                      onClick={() => setFilters({ status: config.defaultStatus, billingStatus: config.defaultBillingStatus, search: filters.search })}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Booking Status</span>
                      <select className="input !py-3" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                        <option value="all">All booking statuses</option>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Billing Status</span>
                      <select className="input !py-3" value={filters.billingStatus} onChange={(event) => setFilters((current) => ({ ...current, billingStatus: event.target.value }))}>
                        <option value="all">All billing statuses</option>
                        {Object.entries(billingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {config.primarySection === "billing" && (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
            {[
              ["payment_under_review", "Under Review"],
              ["paid_approved", "Approved Payments"],
              ["payment_rejected", "Rejected"],
              ["all", "All Payments"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, billingStatus: value }))}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${filters.billingStatus === value ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
          Showing {bookings.length} records in this module
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Booking / Client</th>
                <th className="px-4 py-3">Container</th>
                <th className="px-4 py-3">Booking Status</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Schedule / Location</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pagination.paginatedItems.map((booking) => (
                <tr key={booking.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <p className="font-black text-emerald-700">{booking.bookingReference}</p>
                    <p className="mt-1 font-bold text-slate-800">{booking.clientName || "Client"}</p>
                    <p className="text-xs font-semibold text-slate-500">{booking.clientEmail || "-"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">{booking.containerNumber}</p>
                    <p className="mt-1 text-xs font-bold capitalize text-slate-500">{booking.containerSize}ft • {booking.containerType?.replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">{booking.shippingLine || "-"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(booking.status)}`}>{statusLabels[booking.status] || booking.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-900">PHP {Number(booking.billingTotal || booking.paymentAmount || 0).toLocaleString()}</p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(booking.billingStatus)}`}>{billingLabels[booking.billingStatus] || booking.billingStatus}</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-800">{formatDate(getBookingInDate(booking))}</p>
                    <p className="mt-1 text-xs text-slate-500">{booking.assignedAreaName || "Yard area pending"} • {booking.assignedSlotNumber || "No slot"}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canDeleteBooking && (
                        <button
                          type="button"
                          onClick={() => deleteBooking(booking)}
                          disabled={deletingId === booking.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={15} /> {deletingId === booking.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(booking.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
                      >
                        <Eye size={15} /> View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && bookings.length === 0 && (
                <tr><td colSpan="6" className="px-4 py-12 text-center font-bold text-slate-500">No records found for this module.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </section>

      {selectedBooking && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-emerald-700">{config.badge}</div>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedBooking.containerNumber}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedBooking.bookingReference} • {selectedBooking.clientName}</p>
              </div>
              <button type="button" onClick={() => setSelectedId("")} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close booking details">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-6 p-5">
            <div className="card p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-black text-slate-500">{selectedBooking.bookingReference}</div>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedBooking.containerNumber}</h2>
                  <div className="mt-1 text-sm font-semibold text-slate-500">{selectedBooking.clientName} • {selectedBooking.clientEmail}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(selectedBooking.status)}`}>{statusLabels[selectedBooking.status] || selectedBooking.status}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(selectedBooking.billingStatus)}`}>{billingLabels[selectedBooking.billingStatus] || selectedBooking.billingStatus}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm md:grid-cols-3">
                <div><span className="font-black text-slate-500">Booking No.:</span> {selectedBooking.bookingNumber || "Generated after approval"}</div>
                <div><span className="font-black text-slate-500">Size:</span> {selectedBooking.containerSize}ft</div>
                <div><span className="font-black text-slate-500">Type:</span> {selectedBooking.containerType?.replace("_", " ")}</div>
                <div><span className="font-black text-slate-500">Load:</span> {selectedBooking.containerLoadStatus}</div>
                <div><span className="font-black text-slate-500">Shipping Line:</span> {selectedBooking.shippingLine}</div>
                <div><span className="font-black text-slate-500">In Date:</span> {formatDate(getBookingInDate(selectedBooking))}</div>
                <div><span className="font-black text-slate-500">Requested Date Out:</span> {formatDate(getBookingOutDate(selectedBooking))}</div>
                <div><span className="font-black text-slate-500">Assigned Slot:</span> {selectedBooking.assignedSlotNumber || "Pending"}</div>
              </div>
            </div>

            {isPreAdviceApprovalMode && (
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-emerald-700" />
                  <h3 className="text-lg font-black text-slate-950">Submitted Pre-Advice Documents</h3>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">Review the files uploaded together with the client booking.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(selectedBooking.documents || []).map((document, index) => (
                    <a
                      key={`${document.url}-${index}`}
                      href={resolveFileUrl(document.secureUrl || document.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <div className="text-sm font-black text-slate-900">{document.label || "Document"}</div>
                      <div className="mt-1 truncate text-xs font-semibold text-slate-500">{document.fileName || `File ${index + 1}`}</div>
                    </a>
                  ))}
                  {(selectedBooking.documents || []).length === 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700 sm:col-span-2">
                      No pre-advice documents were uploaded with this booking.
                    </div>
                  )}
                </div>
              </div>
            )}

            {config.primarySection === "approval" && (
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <MapPinned size={18} className="text-emerald-700" />
                  <h3 className="text-lg font-black text-slate-950">{isPreAdviceApprovalMode ? "Approve Pre-Advice and Assign Yard Location" : "Approve Booking and Assign Yard Location"}</h3>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {isPreAdviceApprovalMode ? (
                    <div className="md:col-span-2">
                      <Field label="Yard Area" hint="Select the yard area where the container will be assigned.">
                        <select className="input" value={approval.blockId} onChange={(event) => handleApprovalAreaChange(event.target.value)}>
                          <option value="">Select yard area</option>
                          {usableBlocks.map((area) => {
                            const hasCapacity = blockHasCapacity(area, selectedBooking)
                            const congestionDisabled = area.isCongestionArea && regularYardHasSpace
                            return (
                              <option key={area.id} value={area.id} disabled={!hasCapacity || congestionDisabled}>
                                {area.isCongestionArea ? "[CONGESTION] " : ""}{area.areaName || area.name || "Yard Area"} • {area.areaCode || area.code || "AREA"} • {hasCapacity ? `${area.availableSlots ?? 0} ${area.capacityUnit || "slot(s)"} left` : "FULL"}
                              </option>
                            )
                          })}
                        </select>
                      </Field>
                      {areas.length === 0 && (
                        <div className="mt-2 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-700">
                          No yard area found. Add an active area in Yard Area Setup first.
                        </div>
                      )}
                      {areas.length > 0 && blocks.length === 0 && (
                        <div className="mt-2 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-700">
                          Yard areas exist, but the approval area list was not loaded. Refresh this page after restarting the updated server.
                        </div>
                      )}
                      {blocks.length > 0 && usableBlocks.length === 0 && (
                        <div className="mt-2 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-700">
                          No active yard area is available. Check the yard area status in Yard Area Setup.
                        </div>
                      )}
                      {usableBlocks.length > 0 && regularYardHasSpace && (
                        <div className="mt-2 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                          Regular yard capacity is available. Congestion areas remain disabled until regular capacity is full.
                        </div>
                      )}
                      {usableBlocks.length > 0 && !regularYardHasSpace && (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                          <p>Regular yard capacity is full. Select a designated congestion area.</p>
                          {congestionLoading && <p className="mt-1">Checking the configured congestion surcharge...</p>}
                          {!congestionLoading && congestionOption?.available && (
                            <p className="mt-1">A PHP {Number(congestionOption.rate?.rateAmount || 0).toLocaleString()} surcharge will be added automatically.</p>
                          )}
                          {!congestionLoading && !congestionOption?.available && (
                            <p className="mt-1 text-red-700">{congestionOption?.reason || (hasCongestionArea ? "Configure the congestion surcharge rate before approval." : "Create a designated congestion area in Yard Area Setup.")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <Field label="Yard Block / Area">
                        <select className="input" value={approval.areaId} onChange={(event) => setApproval((current) => ({ ...current, areaId: event.target.value, blockId: "", bay: 1, row: 1, tier: 1 }))}>
                          <option value="">Select Alpha, Bravo, Echo, etc.</option>
                          {areas.map((area) => <option key={area.id} value={area.id}>{area.name} • {area.availableSlots} TEU available</option>)}
                        </select>
                      </Field>
                      <Field label="Block Section" hint="Only active matching container-size block sections are shown.">
                        <select className="input" value={approval.blockId} onChange={(event) => setApproval((current) => ({ ...current, blockId: event.target.value, bay: 1, row: 1, tier: 1 }))}>
                          <option value="">Select block section</option>
                          {usableBlocks.map((block) => <option key={block.id} value={block.id}>{block.code} • {block.availableSlots} TEU left • {block.containerSize}ft</option>)}
                        </select>
                      </Field>
                    </>
                  )}
                  <Field label="Bay">
                    <select className="input" value={approval.bay} onChange={(event) => setApproval((current) => ({ ...current, bay: event.target.value }))} disabled={!selectedBlock}>
                      {bayOptions.map((value) => <option key={value} value={value}>Bay {value}</option>)}
                    </select>
                  </Field>
                  <Field label="Row">
                    <select className="input" value={approval.row} onChange={(event) => setApproval((current) => ({ ...current, row: event.target.value }))} disabled={!selectedBlock}>
                      {rowOptions.map((value) => <option key={value} value={value}>Row {value}</option>)}
                    </select>
                  </Field>
                  <Field label="Tier">
                    <select className="input" value={approval.tier} onChange={(event) => setApproval((current) => ({ ...current, tier: event.target.value }))} disabled={!selectedBlock}>
                      {tierOptions.map((value) => <option key={value} value={value}>Tier {value}</option>)}
                    </select>
                  </Field>
                </div>
                {selectedBlock && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                      {isPreAdviceApprovalMode ? `${selectedBlock.areaName || selectedBlock.name || "Yard Area"}` : (selectedBlock.name || selectedBlock.code || "Selected block")}: {selectedBlock.occupiedSlots}/{selectedBlock.capacityTeu} {selectedBlock.capacityUnit || (Number(selectedBlock.containerSize) === 20 ? "TEU" : "FEU")} used, {selectedBlock.availableSlots} {selectedBlock.capacityUnit || (Number(selectedBlock.containerSize) === 20 ? "TEU" : "FEU")} remaining. Selected location: B{approval.bay}-R{approval.row}-T{approval.tier}.
                    </div>
                    {selectedUsesCongestionArea && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                        This is a designated congestion area. The congestion surcharge will be added automatically when this pre-advice is approved.
                      </div>
                    )}
                    {!selectedBlockHasCapacity && (
                      <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                        This yard area does not have enough remaining capacity for the container.
                      </div>
                    )}
                    {selectedSlotOutOfBounds ? (
                      <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                        A 40ft container needs two consecutive TEU slots. Select a bay with an available next bay.
                      </div>
                    ) : selectedSlotTaken ? (
                      <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                        One or both required locations are already reserved or occupied. Select another bay, row, or tier.
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-700">
                        This location is available. A 40ft container assigned to a 20ft TEU block will reserve this bay and the next bay automatically.
                      </div>
                    )}
                    {slotAvailability.length > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-black uppercase tracking-wide text-slate-500">Unavailable locations</div>
                        <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                          {slotAvailability.slice(0, 40).map((slot) => (
                            <span key={`${slot.key}-${slot.reference}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                              B{slot.bay} R{slot.row} T{slot.tier} • {slot.type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={approveBooking} className="btn-primary" disabled={saving || selectedBooking.status !== "pending_admin_approval" || !approval.areaId || !approval.blockId || selectedSlotTaken || selectedSlotOutOfBounds || !selectedBlockHasCapacity || (selectedUsesCongestionArea && (regularYardHasSpace || congestionLoading || !congestionOption?.available))}>
                    <CheckCircle2 size={16} /> Approve / Assign
                  </button>
                  <input className="input sm:max-w-xs" placeholder="Reject reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
                  <button type="button" onClick={rejectBooking} className="btn-secondary !text-red-700" disabled={saving || !rejectReason || selectedBooking.status !== "pending_admin_approval"}>
                    <ShieldX size={16} /> Reject
                  </button>
                </div>
              </div>
            )}

            {config.primarySection === "gateIn" && (
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-emerald-700" />
                  <h3 className="text-lg font-black text-slate-950">Gate-In Check and Inspection</h3>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Actual Container Number">
                    <input className="input uppercase" value={gateIn.actualContainerNumber} onChange={(event) => setGateIn((current) => ({ ...current, actualContainerNumber: event.target.value }))} />
                  </Field>
                  <Field label="Physical Condition">
                    <input className="input" value={gateIn.physicalCondition} onChange={(event) => setGateIn((current) => ({ ...current, physicalCondition: event.target.value }))} />
                  </Field>
                  <Field label="Seal Number">
                    <input className="input" value={gateIn.sealNumber} onChange={(event) => setGateIn((current) => ({ ...current, sealNumber: event.target.value }))} />
                  </Field>
                </div>
                <div className="mt-4 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm md:grid-cols-3">
                  <div><span className="font-black text-slate-500">Truck Plate:</span> {selectedBooking.truckPlateNumber || "-"}</div>
                  <div><span className="font-black text-slate-500">Driver:</span> {selectedBooking.driverName || "-"}</div>
                  <div><span className="font-black text-slate-500">Driver License:</span> {selectedBooking.driverLicenseNumber || "-"}</div>
                </div>
                <Field label="Inspection Remarks">
                  <textarea className="input mt-4 min-h-[82px]" value={gateIn.inspectionRemarks} onChange={(event) => setGateIn((current) => ({ ...current, inspectionRemarks: event.target.value }))} />
                </Field>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={approveGateIn} className="btn-primary" disabled={saving || selectedBooking.status !== "approved_area_assigned"}>
                    <Truck size={16} /> Approve Gate-In
                  </button>
                  <input className="input sm:max-w-xs" placeholder="Gate-In rejection reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} disabled={selectedBooking.status !== "approved_area_assigned"} />
                  <button type="button" onClick={rejectGateIn} className="btn-secondary !text-red-700" disabled={saving || !rejectReason.trim() || selectedBooking.status !== "approved_area_assigned"}>
                    <ShieldX size={16} /> Reject Gate-In
                  </button>
                </div>
              </div>
            )}

            {config.primarySection === "billing" && (
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-emerald-700" />
                  <h3 className="text-lg font-black text-slate-950">Payment Verification</h3>
                </div>
                <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-500">Applied Rate Classification:</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${selectedBooking.rateType === "international" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {selectedBooking.rateType === "international" ? "International" : "Local"}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">Automatically taken from this container booking</span>
                  </div>
                  <div><span className="font-black text-slate-500">Container:</span> {selectedBooking.containerNumber} • {selectedBooking.containerSize}ft • {selectedBooking.containerLoadStatus || "-"}</div>
                  <div><span className="font-black text-slate-500">Subtotal:</span> PHP {Number(selectedBooking.billingSubtotal || 0).toLocaleString()}</div>
                  <div><span className="font-black text-slate-500">VAT ({Number(selectedBooking.vatRate ?? 0.12) * 100}%):</span> PHP {Number(selectedBooking.vatAmount || 0).toLocaleString()}</div>
                  <div><span className="font-black text-slate-500">Total Billing Amount:</span> PHP {Number(selectedBooking.billingTotal || selectedBooking.paymentAmount || 0).toLocaleString()}</div>
                  <div><span className="font-black text-slate-500">Payment Submitted:</span> PHP {Number(selectedBooking.paymentAmount || 0).toLocaleString()}</div>
                  <div><span className="font-black text-slate-500">Payment Reference:</span> {selectedBooking.paymentReferenceNumber || "Auto-generated on submit"}</div>
                  <div><span className="font-black text-slate-500">Computed:</span> {formatDate(selectedBooking.billingComputedAt)} • {selectedBooking.billingDays || 0} calendar billing day(s)</div>
                  <div><span className="font-black text-slate-500">Submitted:</span> {formatDate(selectedBooking.paymentSubmittedAt)}</div>
                  <div><span className="font-black text-slate-500">Payment Type:</span> {selectedBooking.paymentTypeSnapshot?.name || "Not selected"}</div>
                  {selectedBooking.paymentTypeSnapshot?.accountNumber && (
                    <div><span className="font-black text-slate-500">Paid To:</span> {selectedBooking.paymentTypeSnapshot.bankName || selectedBooking.paymentTypeSnapshot.name} • {selectedBooking.paymentTypeSnapshot.accountNumber} • {selectedBooking.paymentTypeSnapshot.accountName}</div>
                  )}
                  {(selectedBooking.billingLineItems || []).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {(selectedBooking.billingLineItems || []).map((item, index) => (
                        <div key={`${item.chargeCode}-${index}`} className="flex flex-col justify-between gap-1 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-700 sm:flex-row">
                          <span>{item.description || item.chargeCode} • {item.quantity} x PHP {Number(item.rateAmount || 0).toLocaleString()} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500">{item.rateType || selectedBooking.rateType}</span></span>
                          <span>PHP {Number(item.amount || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedBooking.paymentProofs || []).map((doc, index) => (
                      <a key={`${doc.url}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700 underline" href={resolveFileUrl(doc.secureUrl || doc.url)} target="_blank" rel="noreferrer">
                        {doc.label || "Payment Proof"} {index + 1}
                      </a>
                    ))}
                  </div>
                </div>

                {["unpaid", "payment_rejected"].includes(selectedBooking.billingStatus) && ["gate_out_requested", "gate_out_approved"].includes(selectedBooking.status) && (
                  <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2">
                      <Banknote size={18} className="text-amber-700" />
                      <div><p className="text-xs font-black uppercase tracking-wide text-amber-700">Cash Payment</p><p className="mt-1 text-sm font-semibold text-slate-600">Only an authorized admin cashier can record cash payments.</p></div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <InputDate
                        name="paymentDate"
                        value={cashPayment.paymentDate}
                        onChange={(event) =>
                          setCashPayment((current) => ({
                            ...current,
                            paymentDate: toDateOnlyString(event.target.value),
                          }))
                        }
                        className="bg-white"
                      />
                      <input className="input bg-white" placeholder="Official receipt / reference (optional)" value={cashPayment.paymentReferenceNumber} onChange={(event) => setCashPayment((current) => ({ ...current, paymentReferenceNumber: event.target.value }))} />
                      <input className="input bg-white" placeholder="Cash payment remarks" value={cashPayment.paymentRemarks} onChange={(event) => setCashPayment((current) => ({ ...current, paymentRemarks: event.target.value }))} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-900">Amount: PHP {Number(selectedBooking.billingTotal || selectedBooking.paymentAmount || 0).toLocaleString()}</p>
                      <button type="button" onClick={recordCashPayment} className="btn-primary" disabled={saving || Number(selectedBooking.billingTotal || selectedBooking.paymentAmount || 0) <= 0}><Banknote size={16} /> Record Cash Payment</button>
                    </div>
                  </div>
                )}

                {["unpaid", "payment_rejected"].includes(selectedBooking.billingStatus) && (
                  <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Additional Billing</p><p className="mt-1 text-sm font-semibold text-slate-600">Add one-time charges before payment is submitted.</p></div>
                    <Plus size={18} className="text-emerald-700" />
                  </div>
                  {(selectedBooking.additionalBillingCharges || []).length > 0 && (
                    <div className="mt-4 space-y-2">
                      {(selectedBooking.additionalBillingCharges || []).map((charge) => (
                        <div key={charge.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm shadow-sm">
                          <div><p className="font-black text-slate-900">{charge.description}</p><p className="text-xs text-slate-500">{charge.quantity} x PHP {Number(charge.rateAmount || 0).toLocaleString()} = PHP {Number(charge.amount || 0).toLocaleString()}</p></div>
                          {charge.source === "congestion_surcharge" ? (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Pre-Advice Applied</span>
                          ) : (
                            <button type="button" onClick={() => removeAdditionalCharge(charge.id)} disabled={saving || !["unpaid", "payment_rejected"].includes(selectedBooking.billingStatus)} className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-700 disabled:opacity-40" aria-label="Remove additional charge"><Trash2 size={15} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_100px_150px_auto]">
                    <input className="input bg-white" placeholder="Charge description" value={additionalCharge.description} onChange={(event) => setAdditionalCharge((current) => ({ ...current, description: event.target.value }))} disabled={!["unpaid", "payment_rejected"].includes(selectedBooking.billingStatus)} />
                    <input className="input bg-white" type="number" min="0.01" step="0.01" placeholder="Qty" value={additionalCharge.quantity} onChange={(event) => setAdditionalCharge((current) => ({ ...current, quantity: event.target.value }))} disabled={!["unpaid", "payment_rejected"].includes(selectedBooking.billingStatus)} />
                    <input className="input bg-white" type="number" min="0.01" step="0.01" placeholder="Rate" value={additionalCharge.rateAmount} onChange={(event) => setAdditionalCharge((current) => ({ ...current, rateAmount: event.target.value }))} disabled={!["unpaid", "payment_rejected"].includes(selectedBooking.billingStatus)} />
                    <button type="button" onClick={addAdditionalCharge} className="btn-primary" disabled={saving || !["unpaid", "payment_rejected"].includes(selectedBooking.billingStatus)}><Plus size={16} /> Add</button>
                  </div>
                  <input className="input mt-3 bg-white" placeholder="Optional notes for this charge" value={additionalCharge.notes} onChange={(event) => setAdditionalCharge((current) => ({ ...current, notes: event.target.value }))} />
                  </div>
                )}

                <textarea className="input mt-4 min-h-[82px]" placeholder="Remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={approvePayment} className="btn-primary" disabled={saving || !["payment_submitted", "payment_under_review", "payment_rejected"].includes(selectedBooking.billingStatus)}>
                    <CheckCircle2 size={16} /> Approve Payment
                  </button>
                  <input className="input sm:max-w-xs" placeholder="Payment rejection reason" value={paymentRejectReason} onChange={(event) => setPaymentRejectReason(event.target.value)} />
                  <button type="button" onClick={rejectPayment} className="btn-secondary !text-red-700" disabled={saving || !paymentRejectReason}>
                    Reject Payment
                  </button>
                </div>
              </div>
            )}

            {config.primarySection === "gateOut" && (
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-emerald-700" />
                  <h3 className="text-lg font-black text-slate-950">Gate-Out Request</h3>
                </div>
                <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm">
                  <div><span className="font-black text-slate-500">Requested:</span> {formatDate(selectedBooking.gateOutRequestedAt)}</div>
                  <div><span className="font-black text-slate-500">Approved:</span> {formatDate(selectedBooking.gateOutApprovedAt)}</div>
                  <div><span className="font-black text-slate-500">Released:</span> {formatDate(selectedBooking.releasedAt)}</div>
                  <div><span className="font-black text-slate-500">Billing Gate:</span> {selectedBooking.billingStatus === "paid_approved" ? "Ready" : "Payment not approved"}</div>
                </div>
                <textarea className="input mt-4 min-h-[82px]" placeholder="Gate-out remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={approveGateOut} className="btn-primary" disabled={saving || selectedBooking.status !== "gate_out_requested" || selectedBooking.billingStatus !== "paid_approved"}>
                    Approve Gate-Out
                  </button>
                  <button type="button" onClick={completeGateOut} className="btn-secondary" disabled={saving || selectedBooking.status !== "gate_out_approved"}>
                    Complete Release
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminBookingModule
