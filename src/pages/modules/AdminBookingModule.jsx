import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Banknote,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Eye,
  MapPinned,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Truck,
  Warehouse,
} from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import Pagination from "../../components/ui/Pagination"
import TableActionButton from "../../components/ui/TableActionButton"
import TableCrudActions from "../../components/ui/TableCrudActions"
import WorkflowDecisionPanel from "../../components/ui/WorkflowDecisionPanel"
import ContainerClassificationBadges from "../../components/ui/ContainerClassificationBadges"
import ContainerClassificationFilters from "../../components/ui/ContainerClassificationFilters"
import AvailableSlotPicker from "../../components/ui/AvailableSlotPicker"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"
import { api, getApiError, resolveFileUrl } from "../../lib/api"
import { useAuthStore } from "../../stores/authStore"
import { hasModulePermission } from "../../lib/permissions"
import { printBookingDocument } from "../../lib/printDocument"
import TableLoadingRow from "../../components/ui/TableLoadingRow"

const statusLabels = {
  pending_admin_approval: "Pending Admin Approval",
  approved_area_assigned: "Approved / Area Assigned",
  rejected: "Rejected",
  gate_in_approved: "Gate-In Approved",
  stored_in_assigned_area: "Stored in Assigned Area",
  gate_out_requested: "Gate-Out Requested",
  gate_out_approved: "Gate-Out Approved",
  gate_out_reversal_requested: "Gate-Out Reversal Requested",
  completed_gate_out_done: "Completed / Gate-Out Done",
  cancelled: "Cancelled",
}

const toDateTimeLocalString = (value) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:00`
}

const billingLabels = {
  unpaid: "Unpaid",
  payment_submitted: "Payment Submitted",
  payment_under_review: "Payment Under Review",
  payment_rejected: "Payment Rejected",
  additional_payment_required: "Additional Payment Required",
  paid_approved: "Paid / Approved",
}

const moduleConfig = {
  preAdvice: {
    badge: "Pre-Advice Verification",
    title: "Booking Pre-Advice Verification",
    description:
      "Shows only bookings pending admin approval. Verify the booking details, check yard capacity, and assign a yard area before approval.",
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
      "Shows only approved and area-assigned containers ready for Gate-In inspection and approval.",
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
    title: "Gate-Out Request Approval",
    description:
      "Review client Gate-Out requests, process eligible cash payments, verify approved online payments, and approve the Gate-Out request before release.",
    icon: PackageCheck,
    defaultStatus: "gate_out_requested",
    defaultBillingStatus: "all",
    primarySection: "gateOut",
    queueTitle: "Gate-Out Requests",
  },
  releaseContainer: {
    badge: "Release Container Module",
    title: "Release Container",
    description:
      "Release containers only after the Gate-Out request has been approved. Complete the physical release and review containers that have already left the yard.",
    icon: Truck,
    defaultStatus: "all",
    defaultBillingStatus: "all",
    primarySection: "release",
    queueTitle: "Containers Ready for Release",
  },
}

const statusClass = (status) => {
  if (["stored_in_assigned_area", "completed_gate_out_done", "paid_approved"].includes(status)) return "bg-blue-50 text-blue-700"
  if (["approved_area_assigned", "gate_in_approved", "gate_out_approved"].includes(status)) return "bg-blue-50 text-blue-700"
  if (["gate_out_reversal_requested", "additional_payment_required"].includes(status)) return "bg-amber-50 text-amber-700"
  if (["rejected", "cancelled", "payment_rejected"].includes(status)) return "bg-red-50 text-red-700"
  return "bg-amber-50 text-amber-700"
}

const formatDate = (value) => {
  if (!value) return "-"
  return new Date(value).toLocaleString()
}

const getBookingInDate = (booking = {}) => booking.inDate || booking.expectedArrivalDate
const getBookingOutDate = (booking = {}) => booking.outDate

const ONLINE_PAYMENT_TYPES = new Set(["bank", "ewallet"])

const getPaymentTypeName = (booking = {}) =>
  String(booking.paymentTypeSnapshot?.type || "").trim().toLowerCase()

const hasExistingOnlinePayment = (booking = {}) => {
  if (!["payment_submitted", "payment_under_review"].includes(booking.billingStatus)) return false
  const paymentType = getPaymentTypeName(booking)
  const hasOnlineProof = Array.isArray(booking.paymentProofs) && booking.paymentProofs.length > 0
  return ONLINE_PAYMENT_TYPES.has(paymentType) || hasOnlineProof
}

const hasApprovedPayment = (booking = {}) => booking.billingStatus === "paid_approved"

const getCashPaymentDisabledReason = (booking = {}) => {
  const isGateInPayment = booking.status === "approved_area_assigned" && booking.loloPaymentStage !== "gate_out"
  const isGateOutPayment = ["gate_out_requested", "gate_out_approved"].includes(booking.status)

  if (booking.status === "approved_area_assigned" && booking.loloPaymentStage === "gate_out") {
    return "LOLO payment is configured for Gate-Out for this booking. No Gate-In payment is required."
  }

  if (!isGateInPayment && !isGateOutPayment) {
    return "Cash payment is available only for Gate-In LOLO when configured for Gate-In, or an active Gate-Out balance."
  }

  if (isGateInPayment && booking.billingStatus === "paid_approved" && Number(booking.paymentBalanceDue || 0) <= 0) {
    return "Cash payment is disabled because the Gate-In LOLO transaction is already paid."
  }

  // Once the Gate-Out transaction is fully paid / approved, payment is locked.
  // Release Container must use that approved Gate-Out payment and must not
  // create or request another payment during physical release.
  if (isGateOutPayment && booking.billingStatus === "paid_approved" && Number(booking.paymentBalanceDue || 0) <= 0) {
    return "Gate-Out payment is already paid / approved. No additional payment is required before release."
  }

  if (hasExistingOnlinePayment(booking)) {
    return "Cash payment is disabled while an online payment is under review."
  }

  if (isGateOutPayment && !booking.outDate) {
    return "Cash payment is unavailable until the Date Out is set."
  }

  if (Number(booking.billingSubtotal || booking.billingTotal || 0) <= 0) {
    return isGateInPayment
      ? "Cash payment is unavailable until Gate-In Lift On / Lift Off billing is computed."
      : "Cash payment is unavailable until Gate-Out billing has been computed."
  }

  return ""
}

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

const PaymentHistoryBreakdown = ({ booking, className = "" }) => {
  const transactions = Array.isArray(booking?.paymentTransactions) ? booking.paymentTransactions : []
  const totalPaid = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const gateInPaid = transactions.filter((item) => item.paymentStage === "gate_in").reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const gateOutPaid = transactions.filter((item) => item.paymentStage === "gate_out").reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const currentGateOutBalance = booking?.status === "gate_out_approved"
    ? 0
    : Number(booking?.paymentBalanceDue ?? booking?.paymentAmount ?? 0)
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Billing Information</p><h3 className="mt-1 text-lg font-black text-slate-950">Complete Payment History</h3><p className="mt-1 text-xs font-semibold text-slate-500">Gate-In and Gate-Out payments are shown together for this booking, while each remains a separate transaction.</p></div><div className="rounded-2xl bg-slate-50 px-4 py-3 text-right"><p className="text-xs font-black uppercase text-slate-400">Total Paid</p><p className="mt-1 text-lg font-black text-slate-900">PHP {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-700">Gate-In</p><p className="mt-1 text-xl font-black text-slate-900">PHP {gateInPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div><div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs font-black uppercase text-blue-700">Gate-Out</p><p className="mt-1 text-xl font-black text-slate-900">PHP {gateOutPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">Current Gate-Out Balance</p><p className="mt-1 text-xl font-black text-slate-900">PHP {currentGateOutBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div></div>
      {transactions.length === 0 ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No approved payment transactions have been recorded yet.</div> : <div className="mt-4 space-y-3">{transactions.map((payment, index) => { const stage = payment.paymentStage === "gate_in" ? "Gate-In LOLO" : "Gate-Out"; return <div key={payment.id || `${stage}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><span className={`rounded-full px-3 py-1 text-xs font-black ${payment.paymentStage === "gate_in" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{stage}</span><p className="mt-2 text-xs font-semibold text-slate-500">{formatDate(payment.paymentDate)}{payment.referenceNumber ? ` • Ref ${payment.referenceNumber}` : ""}{payment.receiptNumber ? ` • Receipt ${payment.receiptNumber}` : ""}</p></div><p className="text-xl font-black text-slate-900">PHP {Number(payment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>{Array.isArray(payment.lineItems) && payment.lineItems.length > 0 && <div className="mt-3 border-t border-slate-200 pt-3"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Transaction Breakdown</p><div className="mt-2 space-y-2">{payment.lineItems.map((item, itemIndex) => <div key={`${item.chargeCode || item.description}-${itemIndex}`} className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{String(item.chargeCode || "").startsWith("LIFT_ON") ? "Lift On Charge" : String(item.chargeCode || "").startsWith("LIFT_OFF") ? "Lift Off Charge" : item.description || item.chargeCode}</span><span className="font-black text-slate-900">PHP {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>)}</div><div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm"><span className="font-semibold text-slate-600">Subtotal + VAT</span><span className="font-black text-slate-900">PHP {Number(payment.grossTotal || payment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div></div>}</div> })}</div>}
    </div>
  )
}


const StagePaymentAdjustment = ({ booking, stage, onEdit }) => {
  const transactions = (booking?.paymentTransactions || []).filter((item) => item.paymentStage === stage)
  const paidTotal = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const billingTotal = stage === "gate_in"
    ? Number(booking?.gateInBillingTotal || 0)
    : Number(booking?.gateOutBillingTotal ?? booking?.billingTotal ?? 0)
  const balanceDue = Math.max(Math.round((billingTotal - paidTotal) * 100) / 100, 0)
  const stageLabel = stage === "gate_in" ? "Gate-In" : "Gate-Out"

  return (
    <div className="card border-violet-200 bg-violet-50/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Super Admin Editable Pay</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{stageLabel} Payment</h3>
          <p className="mt-1 text-sm font-semibold text-slate-600">Correct an approved {stageLabel} payment amount without changing the billing breakdown. Any remaining balance is recalculated automatically.</p>
        </div>
        <div className="grid min-w-[180px] grid-cols-2 gap-2 text-right">
          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Paid</p>
            <p className="mt-1 font-black text-slate-900">PHP {paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Balance</p>
            <p className={`mt-1 font-black ${balanceDue > 0 ? "text-amber-700" : "text-emerald-700"}`}>PHP {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-4 text-sm font-semibold text-slate-500">
          No approved {stageLabel} payment exists yet. Record or approve the payment first, then the Pay amount becomes editable here.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {transactions.map((payment, index) => (
            <div key={payment.id || `${stage}-${index}`} className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">{payment.referenceNumber ? `Reference ${payment.referenceNumber}` : `${stageLabel} Payment ${index + 1}`}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(payment.paymentDate || payment.approvedAt)}{payment.receiptNumber ? ` • Receipt ${payment.receiptNumber}` : ""}</p>
                <p className="mt-2 text-xl font-black text-slate-950">PHP {Number(payment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <button type="button" onClick={() => onEdit(payment)} className="btn-secondary shrink-0">
                <Pencil size={16} /> Edit Pay
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs font-semibold text-slate-400">{hint}</span>}
  </label>
)

const containerConditionOptions = ["GOOD", "DENTED", "RUST", "HOLE", "DOOR DAMAGE", "OTHER"]

const normalizeConditionSelections = (values = []) => {
  const next = Array.isArray(values) ? values : values ? [values] : []
  return Array.from(new Set(next.map((value) => String(value || "").trim().toUpperCase()).filter((value) => containerConditionOptions.includes(value))))
}

const toggleConditionSelection = (values = [], value) => {
  const normalizedValue = String(value || "").trim().toUpperCase()
  const current = normalizeConditionSelections(values)
  if (current.includes(normalizedValue)) return current.filter((item) => item !== normalizedValue)
  return [...current, normalizedValue]
}

const formatConditionSummary = (values = [], otherValue = "") => {
  const selected = normalizeConditionSelections(values)
  const labels = selected.filter((value) => value !== "OTHER")
  const trimmedOther = String(otherValue || "").trim()
  if (selected.includes("OTHER")) labels.push(trimmedOther ? `OTHER: ${trimmedOther}` : "OTHER")
  return labels.join(", ") || "GOOD"
}

const ConditionChecklist = ({ value = [], otherValue = "", onToggle, onOtherChange, hint }) => {
  const selected = normalizeConditionSelections(value)
  const hasOther = selected.includes("OTHER")

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {containerConditionOptions.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {hasOther && (
        <input
          className="input mt-3"
          placeholder="Specify other condition"
          value={otherValue}
          onChange={(event) => onOtherChange(event.target.value)}
        />
      )}
      {hint && <p className="mt-2 text-xs font-semibold text-slate-400">{hint}</p>}
    </div>
  )
}

const emptyCashAdditionalItem = () => ({ description: "", quantity: "1", rateAmount: "", notes: "" })

const initialGateIn = {
  actualContainerNumber: "",
  physicalCondition: "Good",
  gateInConditions: ["GOOD"],
  gateInConditionOther: "",
  sealNumber: "",
  sealIntact: "yes",
  truckPlateNumber: "",
  driverName: "",
  driverLicenseNumber: "",
  inspectionRemarks: "",
}

const initialGateInDetails = {
  containerNumber: "",
  containerSize: "20",
  containerType: "dry",
  containerLoadStatus: "empty",
  rateType: "local",
  shippingLine: "",
  bookingNumber: "",
  blNumber: "",
  vesselVoyage: "",
  cargoDescription: "",
  weight: "",
  inDate: "",
  truckPlateNumber: "",
  driverName: "",
  driverLicenseNumber: "",
  hauler: "",
  clientRemarks: "",
}

const AdminBookingModule = ({ mode }) => {
  const config = moduleConfig[mode] || moduleConfig.preAdvice
  const location = useLocation()
  const navigate = useNavigate()
  const HeaderIcon = config.icon
  const isPreAdviceApprovalMode = mode === "preAdvice"
  const bookingBasePath = isPreAdviceApprovalMode ? "/admin/pre-advice-bookings" : "/admin/bookings"
  const yardBasePath = isPreAdviceApprovalMode ? "/admin/pre-advice-bookings/yard" : "/admin/yard"

  const [bookings, setBookings] = useState([])
  const [summary, setSummary] = useState({})
  const [areas, setAreas] = useState([])
  const [blocks, setBlocks] = useState([])
  const [slotAvailability, setSlotAvailability] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [selectedModalMode, setSelectedModalMode] = useState("view")
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [filters, setFilters] = useState({ status: config.defaultStatus, billingStatus: config.defaultBillingStatus, loadStatus: "all", rateType: "all", search: "" })
  const [approval, setApproval] = useState({ areaId: "", blockId: "", bay: "", row: "", tier: "", loloPaymentStage: "gate_out" })
  const [gateIn, setGateIn] = useState(initialGateIn)
  const [gateInDetails, setGateInDetails] = useState(initialGateInDetails)
  const [releaseConditions, setReleaseConditions] = useState({ gateOutConditions: [], gateOutConditionOther: "" })
  const [rejectReason, setRejectReason] = useState("")
  const [paymentRejectReason, setPaymentRejectReason] = useState("")
  const [gateOutRejectReason, setGateOutRejectReason] = useState("")
  const [reversalRejectReason, setReversalRejectReason] = useState("")
  const [additionalCharge, setAdditionalCharge] = useState({ description: "", quantity: "1", rateAmount: "", notes: "" })
  const [cashPayment, setCashPayment] = useState({ paymentDate: new Date().toISOString().slice(0, 10), paymentReferenceNumber: "", paymentRemarks: "", cashReceived: "", isVatApplicable: true })
  const [cashAdditionalItems, setCashAdditionalItems] = useState([])
  const [showCashModal, setShowCashModal] = useState(false)
  const [cashBookingId, setCashBookingId] = useState("")
  const [showPaymentAdjustmentModal, setShowPaymentAdjustmentModal] = useState(false)
  const [paymentAdjustment, setPaymentAdjustment] = useState({ transactionId: "", paymentStage: "gate_in", amount: "", previousAmount: 0, referenceNumber: "", reason: "" })
  const [congestionOption, setCongestionOption] = useState(null)
  const [congestionLoading, setCongestionLoading] = useState(false)
  const [gateOutDates, setGateOutDates] = useState({ inDate: "", outDate: "" })
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

  const openBookingModal = (booking, modalMode = "view") => {
    setSelectedModalMode(modalMode)
    setRejectReason("")
    setPaymentRejectReason("")
    setGateOutRejectReason("")
    setReversalRejectReason("")
    setRemarks("")
    setSelectedId(booking.id)
  }

  const closeBookingModal = () => {
    setSelectedId("")
    setSelectedModalMode("view")
  }
  const cashBooking = useMemo(() => bookings.find((booking) => booking.id === cashBookingId) || null, [bookings, cashBookingId])
  const cashPaymentStage = cashBooking?.status === "approved_area_assigned" ? "gate_in" : "gate_out"
  const cashAdditionalSubtotal = useMemo(
    () => Math.round(cashAdditionalItems.reduce((sum, item) => {
      const quantity = Math.max(Number(item.quantity) || 0, 0)
      const rateAmount = Math.max(Number(item.rateAmount) || 0, 0)
      return sum + (quantity * rateAmount)
    }, 0) * 100) / 100,
    [cashAdditionalItems],
  )
  const cashBaseSubtotal = Number(cashBooking?.billingSubtotal || 0)
  const cashSubtotal = Math.round((cashBaseSubtotal + cashAdditionalSubtotal) * 100) / 100
  const cashVatRate = Number(cashBooking?.vatRate || 0.12)
  const cashVatAmount = cashPayment.isVatApplicable ? Math.round(cashSubtotal * cashVatRate * 100) / 100 : 0
  const cashGrossTotal = Math.round((cashSubtotal + cashVatAmount) * 100) / 100
  const cashGateInPayment = Math.max((cashBooking?.paymentTransactions || []).filter((item) => item.paymentStage === "gate_in").reduce((sum, item) => sum + Number(item.amount || 0), 0), 0)
  const cashGateOutPayment = Math.max((cashBooking?.paymentTransactions || []).filter((item) => item.paymentStage === "gate_out").reduce((sum, item) => sum + Number(item.amount || 0), 0), 0)
  const cashApprovedCredit = cashPaymentStage === "gate_in"
    ? Math.max(cashGateInPayment, Number(cashBooking?.approvedPaymentAmount || 0))
    : cashGateOutPayment
  const cashTotal = Math.max(Math.round((cashGrossTotal - cashApprovedCredit) * 100) / 100, 0)
  const cashReceivedValue = Number(cashPayment.cashReceived || 0)
  const cashChange = Math.max(Math.round((cashReceivedValue - cashTotal) * 100) / 100, 0)
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
  const hasSelectedSlot = Boolean(approval.blockId && approval.bay && approval.row && approval.tier)
  const selectedSlotKeys = useMemo(() => {
    if (!hasSelectedSlot) return []
    const bay = Number(approval.bay)
    const row = Number(approval.row)
    const tier = Number(approval.tier)
    const keys = [`${bay}-${row}-${tier}`]
    if (Number(selectedBooking?.containerSize) === 40 && Number(selectedBlock?.containerSize) === 20) {
      keys.push(`${bay + 1}-${row}-${tier}`)
    }
    return keys
  }, [approval.bay, approval.row, approval.tier, hasSelectedSlot, selectedBooking?.containerSize, selectedBlock?.containerSize])
  const selectedSlotOutOfBounds = Boolean(
    hasSelectedSlot &&
    Number(selectedBooking?.containerSize) === 40 &&
    Number(selectedBlock?.containerSize) === 20 &&
    Number(approval.bay) + 1 > Number(selectedBlock?.bayCount || selectedBlock?.lineCount || 1),
  )
  const selectedSlotTaken = hasSelectedSlot ? selectedSlotKeys.some((key) => unavailableSlotKeys.has(key)) : false

  const loadBookings = useCallback(async ({ force = false } = {}) => {
    const params = new URLSearchParams()
    const fixedQueueStatus = mode === "preAdvice"
      ? "pending_admin_approval"
      : mode === "gateIn"
        ? "approved_area_assigned"
        : ""
    params.set("status", fixedQueueStatus || filters.status || "all")
    if (!fixedQueueStatus && filters.billingStatus) params.set("billingStatus", filters.billingStatus)
    if (filters.search) params.set("search", filters.search)
    if (filters.loadStatus && filters.loadStatus !== "all") params.set("loadStatus", filters.loadStatus)
    if (filters.rateType && filters.rateType !== "all") params.set("rateType", filters.rateType)

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
        const rawBookings = data.bookings || []
        const gateOutStatuses = new Set(["gate_out_requested", "gate_out_approved", "gate_out_reversal_requested", "completed_gate_out_done"])
        const releaseStatuses = new Set(["gate_out_approved", "gate_out_reversal_requested", "completed_gate_out_done"])
        const nextBookings = mode === "preAdvice"
          ? rawBookings.filter((booking) => booking.status === "pending_admin_approval")
          : mode === "gateIn"
            ? rawBookings.filter((booking) => booking.status === "approved_area_assigned")
            : mode === "gateOut"
              ? rawBookings.filter((booking) => gateOutStatuses.has(booking.status))
              : mode === "releaseContainer"
                ? rawBookings.filter((booking) => releaseStatuses.has(booking.status))
                : rawBookings
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
  }, [bookingBasePath, filters.billingStatus, filters.loadStatus, filters.rateType, filters.search, filters.status, mode])

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
      setSlotsLoading(false)
      return Promise.resolve()
    }

    const requestKey = `${bookingBasePath}/yard/blocks/${blockId}/slots`
    if (!force && slotsRequestRef.current.key === requestKey && slotsRequestRef.current.promise) {
      return slotsRequestRef.current.promise
    }

    setSlotAvailability([])
    setSlotsLoading(true)
    const request = (async () => {
      try {
        const { data } = await api.get(requestKey)
        if (slotsRequestRef.current.key === requestKey) {
          setSlotAvailability(data.slots || [])
        }
      } catch (error) {
        if (slotsRequestRef.current.key === requestKey) {
          setSlotAvailability([])
          setAlert({ type: "error", message: getApiError(error) })
        }
      } finally {
        if (slotsRequestRef.current.promise === request) {
          slotsRequestRef.current = { key: "", promise: null }
          setSlotsLoading(false)
        }
      }
    })()

    slotsRequestRef.current = { key: requestKey, promise: request }
    return request
  }, [bookingBasePath])


  useEffect(() => {
    setFilters({ status: config.defaultStatus, billingStatus: config.defaultBillingStatus, loadStatus: "all", rateType: "all", search: "" })
    setSelectedId("")
    setSelectedModalMode("view")
    setAlert({ type: "", message: "" })
  }, [mode])

  useEffect(() => {
    loadBookings()
  }, [filters.status, filters.billingStatus, filters.loadStatus, filters.rateType])

  useEffect(() => {
    if (config.primarySection === "approval") loadAreas()
  }, [config.primarySection, loadAreas])
  useEffect(() => {
    const bookingId = location.state?.bookingId
    if (!bookingId || loading) return

    const booking = bookings.find((item) => String(item.id) === String(bookingId))
    if (booking) {
      setSelectedModalMode(location.state?.openMode === "view" ? "view" : "edit")
      setSelectedId(booking.id)
      navigate(location.pathname, { replace: true, state: null })
      return
    }

    if (filters.status !== config.defaultStatus || filters.billingStatus !== config.defaultBillingStatus || filters.loadStatus !== "all" || filters.rateType !== "all" || filters.search) {
      setFilters({ status: config.defaultStatus, billingStatus: config.defaultBillingStatus, loadStatus: "all", rateType: "all", search: "" })
    }
  }, [bookings, filters.billingStatus, filters.loadStatus, filters.rateType, filters.search, filters.status, loading, location.pathname, location.state, navigate])


  useEffect(() => {
    if (!selectedBooking) return

    setApproval({
      areaId: selectedBooking.assignedArea || "",
      blockId: selectedBooking.assignedBlock || "",
      bay: selectedBooking.assignedBay || "",
      row: selectedBooking.assignedRow || "",
      tier: selectedBooking.assignedTier || "",
      loloPaymentStage: selectedBooking.loloPaymentStage === "gate_in" ? "gate_in" : "gate_out",
    })

    const normalizedGateInConditions = normalizeConditionSelections(selectedBooking.gateInConditions)
    const normalizedGateOutConditions = normalizeConditionSelections(selectedBooking.gateOutConditions)

    setGateIn({
      actualContainerNumber: selectedBooking.actualContainerNumber || selectedBooking.containerNumber || "",
      physicalCondition: selectedBooking.physicalCondition || "Good",
      gateInConditions: normalizedGateInConditions.length ? normalizedGateInConditions : ["GOOD"],
      gateInConditionOther: selectedBooking.gateInConditionOther || "",
      sealNumber: selectedBooking.sealNumber || "",
      sealIntact: selectedBooking.sealIntact || "yes",
      truckPlateNumber: selectedBooking.truckPlateNumber || "",
      driverName: selectedBooking.driverName || "",
      driverLicenseNumber: selectedBooking.driverLicenseNumber || "",
      inspectionRemarks: selectedBooking.inspectionRemarks || "",
    })

    setGateInDetails({
      containerNumber: selectedBooking.containerNumber || "",
      containerSize: String(selectedBooking.containerSize || 20),
      containerType: selectedBooking.containerType || "dry",
      containerLoadStatus: selectedBooking.containerLoadStatus || "empty",
      rateType: selectedBooking.rateType || "local",
      shippingLine: selectedBooking.shippingLine || "",
      bookingNumber: selectedBooking.bookingNumber || "",
      blNumber: selectedBooking.blNumber || "",
      vesselVoyage: selectedBooking.vesselVoyage || "",
      cargoDescription: selectedBooking.cargoDescription || "",
      weight: selectedBooking.weight ?? "",
      inDate: toDateTimeLocalString(getBookingInDate(selectedBooking)),
      truckPlateNumber: selectedBooking.truckPlateNumber || "",
      driverName: selectedBooking.driverName || "",
      driverLicenseNumber: selectedBooking.driverLicenseNumber || "",
      hauler: selectedBooking.hauler || "",
      clientRemarks: selectedBooking.clientRemarks || "",
    })

    setReleaseConditions({
      gateOutConditions: normalizedGateOutConditions.length ? normalizedGateOutConditions : (normalizedGateInConditions.length ? normalizedGateInConditions : ["GOOD"]),
      gateOutConditionOther: selectedBooking.gateOutConditionOther || selectedBooking.gateInConditionOther || "",
    })

    setGateOutDates({
      inDate: toDateTimeLocalString(getBookingInDate(selectedBooking)),
      outDate: toDateTimeLocalString(selectedBooking.outDate),
    })
  }, [selectedBooking?.id, selectedBooking?.updatedAt, selectedBooking?.inDate, selectedBooking?.outDate, selectedBooking?.overstayFeeWaived, selectedBooking?.overstayFeeWaiverReason])

  useEffect(() => {
    if (!cashBooking) return

    setCashPayment({
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentReferenceNumber: "",
      paymentRemarks: "",
      cashReceived: "",
      isVatApplicable: cashBooking.isVatApplicable !== false,
    })
    setCashAdditionalItems([])
  }, [cashBooking?.id])

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
    if (config.primarySection === "gateIn") return eventType.startsWith("gateIn:") || eventType === "booking:gate_in_details_updated" || eventType === "booking:gate_in_approved" || eventType === "booking:gate_in_no_show_cancelled" || eventType === "booking:approved" || eventType === "booking:rejected"
    if (config.primarySection === "billing") return eventType.includes("payment_") || eventType === "booking:billing_operation_updated" || eventType === "booking:overstay_billing_recomputed" || eventType === "booking:gate_out_requested"
    if (config.primarySection === "gateOut") return eventType.includes("gate_out") || eventType.includes("overstay_fee") || eventType === "booking:payment_approved" || eventType === "booking:cash_payment_recorded"
    if (config.primarySection === "release") return eventType.includes("gate_out_reversal") || eventType.includes("overstay_fee") || eventType === "booking:gate_out_approved" || eventType === "booking:overstay_billing_recomputed" || eventType === "booking:payment_approved" || eventType === "booking:cash_payment_recorded" || eventType === "booking:completed"
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
      bay: "",
      row: "",
      tier: "",
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

  const saveGateInDetails = async () => {
    if (!selectedBooking || user?.role !== "super_admin") return
    if (!gateInDetails.inDate) {
      setAlert({ type: "error", message: "Select the Gate-In date and time before saving." })
      return
    }

    const parsedInDate = new Date(gateInDetails.inDate)
    if (Number.isNaN(parsedInDate.getTime())) {
      setAlert({ type: "error", message: "Select a valid Gate-In date and time." })
      return
    }

    const saved = await runAction(
      () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-in/details`, {
        ...gateInDetails,
        containerSize: Number(gateInDetails.containerSize),
        weight: Number(gateInDetails.weight),
        inDate: parsedInDate.toISOString(),
      }),
      "Gate-In booking details updated successfully.",
    )

    if (saved) {
      setGateIn((current) => ({
        ...current,
        actualContainerNumber: gateInDetails.containerNumber,
        truckPlateNumber: gateInDetails.truckPlateNumber,
        driverName: gateInDetails.driverName,
        driverLicenseNumber: gateInDetails.driverLicenseNumber,
      }))
    }
  }

  const approveGateIn = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-in`, {
      ...gateIn,
      physicalCondition: formatConditionSummary(gateIn.gateInConditions, gateIn.gateInConditionOther),
    }),
    "Gate-In approved and moved to Inventory."
  )

  const rejectGateIn = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-in/reject`, { reason: rejectReason }),
    "Gate-In rejected and the reserved yard slots were released."
  )

  const cancelBooking = () => {
    if (!rejectReason.trim()) {
      setAlert({ type: "error", message: "Enter a cancellation reason first." })
      return
    }
    const cancelPath = isPreAdviceApprovalMode
      ? `/admin/pre-advice-bookings/${selectedBooking.id}/cancel`
      : `/admin/bookings/${selectedBooking.id}/gate-in/cancel`
    return runAction(
      () => api.patch(cancelPath, { reason: rejectReason.trim() }),
      "Booking cancelled and reserved yard capacity released."
    )
  }

  const approvePayment = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/payment/approve`, { remarks }),
    "Payment approved. You can still view it by choosing Approved Payments / Paid Approved in this module."
  )

  const closeCashModal = () => {
    if (saving) return
    setShowCashModal(false)
    setCashBookingId("")
    setCashAdditionalItems([])
  }

  const addCashAdditionalItem = () => {
    setCashAdditionalItems((current) => [...current, emptyCashAdditionalItem()])
  }

  const updateCashAdditionalItem = (index, field, value) => {
    setCashAdditionalItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
  }

  const removeCashAdditionalItem = (index) => {
    setCashAdditionalItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const openCashPayment = async (booking) => {
    const disabledReason = getCashPaymentDisabledReason(booking)
    if (disabledReason) return

    try {
      // Fetch the latest server-side billing snapshot before opening the modal.
      // This is important for Gate-Out because storage is calculated for the
      // separate Gate-Out transaction and the list row may still contain the
      // earlier Gate-In LOLO billing snapshot.
      const { data } = await api.get(`/admin/bookings/${booking.id}`)
      const freshBooking = data?.booking || data?.data || data
      if (freshBooking?.id) {
        setBookings((current) => current.map((item) => item.id === freshBooking.id ? freshBooking : item))
        setCashBookingId(freshBooking.id)
      } else {
        setCashBookingId(booking.id)
      }
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
      return
    }
    setShowCashModal(true)
  }

  const recordCashPayment = async () => {
    if (!cashBooking) return

    const disabledReason = getCashPaymentDisabledReason(cashBooking)
    if (disabledReason) {
      setAlert({ type: "error", message: disabledReason })
      setShowCashModal(false)
      setCashBookingId("")
      return
    }

    const normalizedAdditionalItems = cashAdditionalItems.map((item) => ({
      description: String(item.description || "").trim(),
      quantity: Number(item.quantity),
      rateAmount: Number(item.rateAmount),
      notes: String(item.notes || "").trim(),
    }))

    const invalidAdditionalItem = normalizedAdditionalItems.find((item) => (
      !item.description ||
      !Number.isFinite(item.quantity) || item.quantity <= 0 ||
      !Number.isFinite(item.rateAmount) || item.rateAmount <= 0
    ))
    if (invalidAdditionalItem) {
      setAlert({ type: "error", message: "Complete every additional item with a description, quantity greater than zero, and rate greater than zero." })
      return
    }

    if (!Number.isFinite(cashReceivedValue) || cashReceivedValue < cashTotal) {
      setAlert({ type: "error", message: `Cash received must be at least PHP ${cashTotal.toLocaleString()}.` })
      return
    }
    setAlert({ type: "", message: "" })
    try {
      setSaving(true)
      const { data } = await api.post(`/admin/bookings/${cashBooking.id}/payment/cash`, {
        ...cashPayment,
        cashReceived: cashReceivedValue,
        isVatApplicable: cashPayment.isVatApplicable,
        additionalItems: normalizedAdditionalItems,
      })
      setAlert({ type: "success", message: data.message || "Cash payment recorded and receipt generated. Review Gate-Out from the View modal." })
      setShowCashModal(false)
      setCashBookingId("")
      if (data.booking) printBookingDocument(data.booking, "receipt")
      await loadBookings({ force: true })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSaving(false)
    }
  }

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

  const openPaymentAdjustment = (payment) => {
    if (!selectedBooking || user?.role !== "super_admin" || !payment?.id) return
    setPaymentAdjustment({
      transactionId: payment.id,
      paymentStage: payment.paymentStage === "gate_out" ? "gate_out" : "gate_in",
      amount: String(Number(payment.amount || 0)),
      previousAmount: Number(payment.amount || 0),
      referenceNumber: payment.referenceNumber || "",
      reason: "",
    })
    setShowPaymentAdjustmentModal(true)
  }

  const closePaymentAdjustment = () => {
    if (saving) return
    setShowPaymentAdjustmentModal(false)
    setPaymentAdjustment({ transactionId: "", paymentStage: "gate_in", amount: "", previousAmount: 0, referenceNumber: "", reason: "" })
  }

  const savePaymentAdjustment = async () => {
    if (!selectedBooking || user?.role !== "super_admin" || !paymentAdjustment.transactionId) return
    const amount = Number(paymentAdjustment.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      setAlert({ type: "error", message: "Enter a valid payment amount of zero or greater." })
      return
    }

    setAlert({ type: "", message: "" })
    try {
      setSaving(true)
      const { data } = await api.patch(`/admin/bookings/${selectedBooking.id}/payments/${paymentAdjustment.transactionId}/amount`, {
        amount,
        paymentStage: paymentAdjustment.paymentStage,
        reason: paymentAdjustment.reason.trim(),
      })
      setAlert({ type: "success", message: data.message || "Payment amount updated successfully." })
      setShowPaymentAdjustmentModal(false)
      await loadBookings({ force: true })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSaving(false)
    }
  }

  const approveGateOut = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/approve`, { remarks }),
    "Gate-Out approved."
  )

  const rejectGateOut = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/reject`, { reason: gateOutRejectReason }),
    "Gate-Out request rejected."
  )

  const saveGateOutDates = async () => {
    if (!selectedBooking || user?.role !== "super_admin") return
    if (!gateOutDates.inDate || !gateOutDates.outDate) {
      setAlert({ type: "error", message: "Select both Gate-In and Gate-Out date/time values." })
      return
    }
    const inDate = new Date(gateOutDates.inDate)
    const outDate = new Date(gateOutDates.outDate)
    if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime()) || outDate <= inDate) {
      setAlert({ type: "error", message: "Gate-Out must be later than Gate-In." })
      return
    }
    setAlert({ type: "", message: "" })
    try {
      setSaving(true)
      const { data } = await api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/dates`, {
        inDate: inDate.toISOString(),
        outDate: outDate.toISOString(),
      })
      setAlert({ type: "success", message: data.message || "Gate-In and Gate-Out dates updated." })
      await loadBookings({ force: true })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSaving(false)
    }
  }

  const approveGateOutReversal = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/reversal/approve`, { remarks }),
    "Gate-Out reversed. Container returned to storage and approved payment preserved as credit."
  )

  const rejectGateOutReversal = () => runAction(
    () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/reversal/reject`, { reason: reversalRejectReason }),
    "Gate-Out reversal request rejected."
  )

  const completeGateOut = async () => {
    const completed = await runAction(
      () => api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/complete`, {
        actualContainerNumber: selectedBooking.actualContainerNumber || selectedBooking.containerNumber,
        remarks,
        ...releaseConditions,
      }),
      "Container released. The release report was generated and revenue was recorded."
    )

    // Final release always recalculates using server time. Refresh after a
    // blocked release so the new balance/status is shown immediately.
    if (!completed) await loadBookings({ force: true })
  }

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  const pagination = usePagination(
    bookings,
    10,
    `${mode}|${filters.status}|${filters.billingStatus}|${filters.loadStatus}|${filters.rateType}|${filters.search}`,
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

    if (mode === "gateOut") {
      return [
        { label: "Pending Gate-Out", value: summary.gateOutRequested || 0, icon: PackageCheck, tone: "amber" },
        { label: "Reversal Requests", value: summary.gateOutReversalRequested || 0, icon: RotateCcw, tone: "amber" },
        { label: "Payment Approved", value: summary.paid || 0, icon: CreditCard, tone: "blue" },
        { label: "Released Containers", value: summary.completed || 0, icon: CheckCircle2, tone: "emerald" },
      ]
    }

    return [
      { label: "Ready to Release", value: bookings.filter((booking) => booking.status === "gate_out_approved").length, icon: Truck, tone: "amber" },
      { label: "Overstaying", value: bookings.filter((booking) => booking.isOverstaying).length, icon: Clock3, tone: "amber" },
      { label: "Reversal Requests", value: bookings.filter((booking) => booking.status === "gate_out_reversal_requested").length, icon: RotateCcw, tone: "amber" },
      { label: "Released Containers", value: summary.completed || 0, icon: CheckCircle2, tone: "emerald" },
    ]
  }, [bookings, mode, summary])

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
      if (selectedId === booking.id) closeBookingModal()
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
                      onClick={() => setFilters({ status: config.defaultStatus, billingStatus: config.defaultBillingStatus, loadStatus: "all", rateType: "all", search: filters.search })}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-4 space-y-4">
                    {!['preAdvice', 'gateIn'].includes(mode) && (
                      <>
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
                      </>
                    )}
                    <ContainerClassificationFilters
                      loadStatus={filters.loadStatus}
                      rateType={filters.rateType}
                      onLoadStatusChange={(loadStatus) => setFilters((current) => ({ ...current, loadStatus }))}
                      onRateTypeChange={(rateType) => setFilters((current) => ({ ...current, rateType }))}
                    />
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
              ["additional_payment_required", "Additional Payment Required"],
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

        {config.primarySection === "gateOut" && (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
            {[
              ["gate_out_requested", "Pending Gate-Out"],
              ["gate_out_approved", "Approved Gate-Out"],
              ["gate_out_reversal_requested", "Reversal Requests"],
              ["completed_gate_out_done", "Completed"],
              ["all", "All Gate-Out Records"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, status: value }))}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${filters.status === value ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {config.primarySection === "release" && (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
            {[
              ["gate_out_approved", "Ready to Release"],
              ["gate_out_reversal_requested", "Reversal Requests"],
              ["completed_gate_out_done", "Released"],
              ["all", "All Release Records"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, status: value }))}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${filters.status === value ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
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
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && bookings.length === 0 && <TableLoadingRow colSpan={6} rows={7} actionColumn label="Loading booking records" />}
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
                    <ContainerClassificationBadges
                      loadStatus={booking.containerLoadStatus}
                      rateType={booking.rateType}
                      className="mt-2"
                      compact
                    />
                    <p className="mt-2 text-xs text-slate-500">{booking.shippingLine || "-"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(booking.status)}`}>{statusLabels[booking.status] || booking.status}</span>
                    {booking.isOverstaying && (
                      <span className="mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">Overstaying</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {config.primarySection === "release" ? (
                      <>
                        <div className="space-y-1 text-xs font-bold text-slate-600">
                          <p>Gate-In Total: <span className="font-black text-slate-900">PHP {Number(booking.gateInBillingTotal || booking.gateInPaymentTotal || 0).toLocaleString()}</span></p>
                          <p>Gate-Out Total: <span className="font-black text-slate-900">PHP {Number(booking.gateOutBillingTotal ?? booking.billingTotal ?? 0).toLocaleString()}</span></p>
                          <p className="border-t border-slate-200 pt-1">Total Billing: <span className="font-black text-emerald-700">PHP {Number(booking.totalBillingAmount ?? ((Number(booking.gateInBillingTotal || booking.gateInPaymentTotal) || 0) + (Number(booking.gateOutBillingTotal ?? booking.billingTotal) || 0))).toLocaleString()}</span></p>
                        </div>
                        <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(booking.billingStatus)}`}>{billingLabels[booking.billingStatus] || booking.billingStatus}</span>
                      </>
                    ) : booking.status === "approved_area_assigned" && booking.loloPaymentStage === "gate_out" ? (
                      <>
                        <p className="font-black text-blue-700">Deferred to Gate-Out</p>
                        <span className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">No Gate-In payment</span>
                      </>
                    ) : (
                      <>
                        <p className="font-black text-slate-900">PHP {Number(booking.billingTotal || booking.paymentAmount || 0).toLocaleString()}</p>
                        <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(booking.billingStatus)}`}>{billingLabels[booking.billingStatus] || booking.billingStatus}</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-800">{formatDate(getBookingInDate(booking))}</p>
                    {booking.outDate && <p className="mt-1 text-xs font-bold text-slate-600">Gate-Out: {formatDate(booking.outDate)}</p>}
                    <p className="mt-1 text-xs text-slate-500">{booking.assignedAreaName || "Yard area pending"} • {booking.assignedSlotNumber || "No slot"}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <TableCrudActions
                      recordLabel={booking.bookingReference}
                      onView={() => openBookingModal(booking, "view")}
                      onEdit={() => openBookingModal(booking, "edit")}
                      onDelete={() => deleteBooking(booking)}
                      editDisabled={config.primarySection !== "billing"}
                      editLabel={config.primarySection === "billing" ? `Edit billing for ${booking.bookingReference}` : "Workflow decisions are managed from the View modal"}
                      deleteDisabled={!canDeleteBooking}
                      deleteLabel={canDeleteBooking ? `Delete ${booking.bookingReference}` : "You do not have permission to delete bookings"}
                      deleting={deletingId === booking.id}
                    >
                      {["gateIn", "gateOut"].includes(config.primarySection) && (
                        <TableActionButton
                          label={getCashPaymentDisabledReason(booking) || `Record cash payment for ${booking.bookingReference}`}
                          variant="success"
                          disabled={Boolean(getCashPaymentDisabledReason(booking))}
                          onClick={() => openCashPayment(booking)}
                        >
                          <Banknote size={17} aria-hidden="true" />
                        </TableActionButton>
                      )}
                    </TableCrudActions>
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
                <div className="text-sm font-black uppercase tracking-wide text-emerald-700">{selectedModalMode === "edit" ? `Edit • ${config.badge}` : `View • ${config.badge}`}</div>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedBooking.containerNumber}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedBooking.bookingReference} • {selectedBooking.clientName}</p>
                <ContainerClassificationBadges
                  loadStatus={selectedBooking.containerLoadStatus}
                  rateType={selectedBooking.rateType}
                  className="mt-3"
                />
              </div>
              <ModalCloseButton onClick={closeBookingModal} label="Close booking details" />
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
                <div><span className="font-black text-slate-500">Requested Date / Time Out:</span> {formatDate(getBookingOutDate(selectedBooking))}</div>
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

            {selectedModalMode === "view" && (
              <>
                <BookingModuleViewSummary booking={selectedBooking} section={config.primarySection} />
                {user?.role === "super_admin" && ["gateIn", "gateOut"].includes(config.primarySection) && (
                  <StagePaymentAdjustment
                    booking={selectedBooking}
                    stage={config.primarySection === "gateIn" ? "gate_in" : "gate_out"}
                    onEdit={openPaymentAdjustment}
                  />
                )}
                {config.primarySection === "billing" && (
                  <WorkflowDecisionPanel
                    icon={CreditCard}
                    eyebrow="Payment Verification"
                    title="Payment Decision"
                    description="Approve or reject the submitted payment after reviewing the billing details and proof of payment above."
                    approveLabel="Approve Payment"
                    onApprove={approvePayment}
                    approveDisabled={saving || !["payment_submitted", "payment_under_review", "payment_rejected"].includes(selectedBooking.billingStatus)}
                    rejectLabel="Reject Payment"
                    rejectReason={paymentRejectReason}
                    onRejectReasonChange={setPaymentRejectReason}
                    rejectPlaceholder="Explain why the submitted payment is being rejected"
                    rejectFieldDisabled={!['payment_submitted', 'payment_under_review'].includes(selectedBooking.billingStatus)}
                    onReject={rejectPayment}
                    rejectDisabled={saving || !paymentRejectReason.trim() || !["payment_submitted", "payment_under_review"].includes(selectedBooking.billingStatus)}
                  >
                    <Field label="Approval Remarks" hint="Optional remarks are recorded with the payment decision.">
                      <textarea className="input min-h-[82px]" placeholder="Add payment review remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                    </Field>
                  </WorkflowDecisionPanel>
                )}
              </>
            )}

            <>
            {selectedModalMode === "view" && config.primarySection === "approval" && (
              <WorkflowDecisionPanel
                icon={MapPinned}
                eyebrow={isPreAdviceApprovalMode ? "Pre-Advice Review" : "Booking Review"}
                title={isPreAdviceApprovalMode ? "Pre-Advice Decision and Yard Assignment" : "Booking Decision and Yard Assignment"}
                description="Review the submitted details, select an available yard location, then approve or reject this request."
                approveLabel="Approve / Assign"
                approveIcon={MapPinned}
                onApprove={approveBooking}
                approveDisabled={saving || selectedBooking.status !== "pending_admin_approval" || !approval.areaId || !approval.blockId || !hasSelectedSlot || selectedSlotTaken || selectedSlotOutOfBounds || !selectedBlockHasCapacity || slotsLoading || (selectedUsesCongestionArea && (regularYardHasSpace || congestionLoading || !congestionOption?.available))}
                rejectLabel={isPreAdviceApprovalMode ? "Reject Pre-Advice" : "Reject Booking"}
                rejectReason={rejectReason}
                onRejectReasonChange={setRejectReason}
                rejectPlaceholder="Explain why this request is being rejected"
                rejectFieldDisabled={selectedBooking.status !== "pending_admin_approval"}
                onReject={rejectBooking}
                rejectDisabled={saving || !rejectReason.trim() || selectedBooking.status !== "pending_admin_approval"}
                secondaryActions={(
                  <button type="button" onClick={cancelBooking} className="btn-secondary !border-red-200 !text-red-700" disabled={saving || !rejectReason.trim() || !["pending_admin_approval", "approved_area_assigned"].includes(selectedBooking.status)}>
                    <Trash2 size={16} /> Cancel Pre-Advice
                  </button>
                )}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="LOLO Payment Collection" hint="Choose when Lift On / Lift Off will be collected for this booking. Storage and all other charges stay payable only at Gate-Out.">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={`cursor-pointer rounded-2xl border p-4 transition ${approval.loloPaymentStage === "gate_in" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <input
                            type="radio"
                            name="loloPaymentStage"
                            className="mr-2"
                            checked={approval.loloPaymentStage === "gate_in"}
                            onChange={() => setApproval((current) => ({ ...current, loloPaymentStage: "gate_in" }))}
                          />
                          <strong>Collect at Gate-In</strong>
                          <p className="mt-1 text-xs font-semibold text-slate-500">LOLO must be fully paid and approved before Gate-In approval.</p>
                        </label>
                        <label className={`cursor-pointer rounded-2xl border p-4 transition ${approval.loloPaymentStage === "gate_out" ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <input
                            type="radio"
                            name="loloPaymentStage"
                            className="mr-2"
                            checked={approval.loloPaymentStage === "gate_out"}
                            onChange={() => setApproval((current) => ({ ...current, loloPaymentStage: "gate_out" }))}
                          />
                          <strong>Collect at Gate-Out</strong>
                          <p className="mt-1 text-xs font-semibold text-slate-500">Gate-In can proceed without LOLO payment. LOLO joins storage and other charges at Gate-Out.</p>
                        </label>
                      </div>
                    </Field>
                  </div>
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
                        <select className="input" value={approval.areaId} onChange={(event) => setApproval((current) => ({ ...current, areaId: event.target.value, blockId: "", bay: "", row: "", tier: "" }))}>
                          <option value="">Select Alpha, Bravo, Echo, etc.</option>
                          {areas.map((area) => <option key={area.id} value={area.id}>{area.name} • {area.availableSlots} TEU available</option>)}
                        </select>
                      </Field>
                      <Field label="Block Section" hint="Only active matching container-size block sections are shown.">
                        <select className="input" value={approval.blockId} onChange={(event) => setApproval((current) => ({ ...current, blockId: event.target.value, bay: "", row: "", tier: "" }))}>
                          <option value="">Select block section</option>
                          {usableBlocks.map((block) => <option key={block.id} value={block.id}>{block.code} • {block.availableSlots} TEU left • {block.containerSize}ft</option>)}
                        </select>
                      </Field>
                    </>
                  )}
                </div>
                {selectedBlock && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                      {isPreAdviceApprovalMode ? `${selectedBlock.areaName || selectedBlock.name || "Yard Area"}` : (selectedBlock.name || selectedBlock.code || "Selected block")}: {selectedBlock.occupiedSlots}/{selectedBlock.capacityTeu} {selectedBlock.capacityUnit || (Number(selectedBlock.containerSize) === 20 ? "TEU" : "FEU")} used, {selectedBlock.availableSlots} {selectedBlock.capacityUnit || (Number(selectedBlock.containerSize) === 20 ? "TEU" : "FEU")} remaining. {hasSelectedSlot ? `Selected location: B${approval.bay}-R${approval.row}-T${approval.tier}.` : "Choose an available slot below."}
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
                    {selectedSlotOutOfBounds && (
                      <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                        The selected 40ft location no longer has two consecutive TEU slots. Choose another available slot.
                      </div>
                    )}
                    {selectedSlotTaken && (
                      <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                        The selected location was just reserved or occupied. Choose another available slot.
                      </div>
                    )}
                    <AvailableSlotPicker
                      block={selectedBlock}
                      unavailableSlots={slotAvailability}
                      containerSize={selectedBooking?.containerSize}
                      selectedBay={approval.bay}
                      selectedRow={approval.row}
                      selectedTier={approval.tier}
                      loading={slotsLoading}
                      disabled={!selectedBlockHasCapacity}
                      emptyMessage="No available slot can fit this container in the selected yard area. Choose another yard area."
                      onSelect={(slot) => setApproval((current) => ({
                        ...current,
                        bay: slot.bay,
                        row: slot.row,
                        tier: slot.tier,
                      }))}
                    />
                  </div>
                )}
              </WorkflowDecisionPanel>
            )}

            {selectedModalMode === "view" && config.primarySection === "gateIn" && (
              <WorkflowDecisionPanel
                icon={Truck}
                eyebrow="Gate-In Review"
                title="Gate-In Check and Inspection"
                description="Complete the physical inspection details, then approve or reject the Gate-In request."
                approveLabel="Approve Gate-In"
                approveIcon={Truck}
                onApprove={approveGateIn}
                approveDisabled={saving || selectedBooking.status !== "approved_area_assigned" || (selectedBooking.loloPaymentStage !== "gate_out" && (selectedBooking.billingStatus !== "paid_approved" || Number(selectedBooking.paymentBalanceDue || 0) > 0))}
                note={selectedBooking.loloPaymentStage === "gate_out"
                  ? "LOLO collection is set to Gate-Out. No LOLO payment is required before Gate-In approval."
                  : selectedBooking.billingStatus !== "paid_approved" || Number(selectedBooking.paymentBalanceDue || 0) > 0
                    ? "Gate-In approval is locked until the Lift On / Lift Off (LOLO) charge is fully paid and approved."
                    : "Gate-In LOLO payment is fully approved. Physical inspection can proceed."}
                rejectLabel="Reject Gate-In"
                rejectReason={rejectReason}
                onRejectReasonChange={setRejectReason}
                rejectPlaceholder="Explain why Gate-In is being rejected"
                rejectFieldDisabled={selectedBooking.status !== "approved_area_assigned"}
                onReject={rejectGateIn}
                rejectDisabled={saving || !rejectReason.trim() || selectedBooking.status !== "approved_area_assigned"}
                secondaryActions={(
                  <button type="button" onClick={cancelBooking} className="btn-secondary !border-red-200 !text-red-700" disabled={saving || !rejectReason.trim() || !["approved_area_assigned", "gate_in_approved"].includes(selectedBooking.status)}>
                    <Trash2 size={16} /> Cancel Gate-In
                  </button>
                )}
              >
                {user?.role === "super_admin" && selectedBooking.status === "approved_area_assigned" && (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-3 border-b border-emerald-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Super Admin Editable Gate-In Details</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">Update the approved booking details before Gate-In. Size, classification, Gate-In schedule, truck and shipping details can all be corrected here.</p>
                      </div>
                      <button type="button" className="btn-primary shrink-0" onClick={saveGateInDetails} disabled={saving}>
                        <CheckCircle2 size={16} /> Save Gate-In Details
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Container Number">
                        <input className="input uppercase" value={gateInDetails.containerNumber} onChange={(event) => setGateInDetails((current) => ({ ...current, containerNumber: event.target.value.toUpperCase() }))} />
                      </Field>
                      <Field label="Container Size">
                        <select className="input" value={gateInDetails.containerSize} onChange={(event) => setGateInDetails((current) => ({ ...current, containerSize: event.target.value }))}>
                          <option value="20">20 ft</option>
                          <option value="40">40 ft</option>
                        </select>
                      </Field>
                      <Field label="Local / International">
                        <select className="input" value={gateInDetails.rateType} onChange={(event) => setGateInDetails((current) => ({ ...current, rateType: event.target.value }))}>
                          <option value="local">Local</option>
                          <option value="international">International</option>
                        </select>
                      </Field>
                      <Field label="Gate-In Date / Time" hint="Gate-In capacity remains limited to 4 containers per hour.">
                        <input type="datetime-local" step="3600" className="input" value={gateInDetails.inDate} onChange={(event) => setGateInDetails((current) => ({ ...current, inDate: event.target.value }))} />
                      </Field>
                      <Field label="Container Type">
                        <select className="input" value={gateInDetails.containerType} onChange={(event) => setGateInDetails((current) => ({ ...current, containerType: event.target.value }))}>
                          <option value="dry">Dry</option>
                          <option value="reefer">Reefer</option>
                          <option value="tank">Tank</option>
                          <option value="open_top">Open Top</option>
                          <option value="flat_rack">Flat Rack</option>
                        </select>
                      </Field>
                      <Field label="Load Status">
                        <select className="input" value={gateInDetails.containerLoadStatus} onChange={(event) => setGateInDetails((current) => ({ ...current, containerLoadStatus: event.target.value }))}>
                          <option value="empty">Empty</option>
                          <option value="laden">Laden</option>
                        </select>
                      </Field>
                      <Field label="Weight">
                        <input type="number" min="0.01" step="0.01" className="input" value={gateInDetails.weight} onChange={(event) => setGateInDetails((current) => ({ ...current, weight: event.target.value }))} />
                      </Field>
                      <Field label="Shipping Line">
                        <input className="input" value={gateInDetails.shippingLine} onChange={(event) => setGateInDetails((current) => ({ ...current, shippingLine: event.target.value }))} />
                      </Field>
                      <Field label="Booking Number">
                        <input className="input" value={gateInDetails.bookingNumber} onChange={(event) => setGateInDetails((current) => ({ ...current, bookingNumber: event.target.value }))} />
                      </Field>
                      <Field label="BL Number">
                        <input className="input" value={gateInDetails.blNumber} onChange={(event) => setGateInDetails((current) => ({ ...current, blNumber: event.target.value }))} />
                      </Field>
                      <Field label="Vessel / Voyage">
                        <input className="input" value={gateInDetails.vesselVoyage} onChange={(event) => setGateInDetails((current) => ({ ...current, vesselVoyage: event.target.value }))} />
                      </Field>
                      <Field label="Truck Plate">
                        <input className="input uppercase" value={gateInDetails.truckPlateNumber} onChange={(event) => setGateInDetails((current) => ({ ...current, truckPlateNumber: event.target.value.toUpperCase() }))} />
                      </Field>
                      <Field label="Driver Name">
                        <input className="input" value={gateInDetails.driverName} onChange={(event) => setGateInDetails((current) => ({ ...current, driverName: event.target.value }))} />
                      </Field>
                      <Field label="Driver License">
                        <input className="input" value={gateInDetails.driverLicenseNumber} onChange={(event) => setGateInDetails((current) => ({ ...current, driverLicenseNumber: event.target.value }))} />
                      </Field>
                      <Field label="Hauler">
                        <input className="input" value={gateInDetails.hauler} onChange={(event) => setGateInDetails((current) => ({ ...current, hauler: event.target.value }))} />
                      </Field>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Cargo Description">
                        <textarea className="input min-h-[82px]" value={gateInDetails.cargoDescription} onChange={(event) => setGateInDetails((current) => ({ ...current, cargoDescription: event.target.value }))} />
                      </Field>
                      <Field label="Client Remarks">
                        <textarea className="input min-h-[82px]" value={gateInDetails.clientRemarks} onChange={(event) => setGateInDetails((current) => ({ ...current, clientRemarks: event.target.value }))} />
                      </Field>
                    </div>
                  </div>
                )}

                {selectedBooking.loloPaymentStage === "gate_out" ? (
                  <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-blue-700">LOLO Payment Deferred to Gate-Out</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Admin selected Gate-Out collection for Lift On / Lift Off. Gate-In does not require payment. LOLO, storage, congestion, and other charges will be collected at Gate-Out.</p>
                    <div className="mt-4 rounded-2xl bg-white p-3 text-sm">
                      <p className="text-xs font-black uppercase text-slate-400">Gate-In Amount Due</p>
                      <p className="mt-1 font-black text-emerald-700">PHP 0</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-blue-700">Gate-In LOLO Payment</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">Lift On and Lift Off are collected at Gate-In. Storage, congestion, and other charges are payable only at Gate-Out.</p>
                      </div>
                      {Number(selectedBooking.paymentBalanceDue ?? selectedBooking.paymentAmount ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => openCashPayment(selectedBooking)}
                          className="btn-secondary shrink-0"
                          disabled={saving || Boolean(getCashPaymentDisabledReason(selectedBooking))}
                          title={getCashPaymentDisabledReason(selectedBooking) || "Record Gate-In LOLO cash payment"}
                        >
                          <Banknote size={16} /> Record LOLO Cash
                        </button>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-2xl bg-white p-3"><p className="text-xs font-black uppercase text-slate-400">LOLO Gross Bill</p><p className="mt-1 font-black text-slate-900">PHP {Number(selectedBooking.billingTotal || 0).toLocaleString()}</p></div>
                      <div className="rounded-2xl bg-white p-3"><p className="text-xs font-black uppercase text-slate-400">Balance Due</p><p className="mt-1 font-black text-slate-900">PHP {Number(selectedBooking.paymentBalanceDue ?? selectedBooking.paymentAmount ?? 0).toLocaleString()}</p></div>
                      <div className="rounded-2xl bg-white p-3"><p className="text-xs font-black uppercase text-slate-400">Payment Status</p><p className="mt-1 font-black text-slate-900">{billingLabels[selectedBooking.billingStatus] || selectedBooking.billingStatus}</p></div>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Actual Container Number">
                    <input className="input uppercase" value={gateIn.actualContainerNumber} onChange={(event) => setGateIn((current) => ({ ...current, actualContainerNumber: event.target.value }))} />
                  </Field>
                  <Field label="Seal Number">
                    <input className="input" value={gateIn.sealNumber} onChange={(event) => setGateIn((current) => ({ ...current, sealNumber: event.target.value }))} />
                  </Field>
                  <Field label="Seal Intact">
                    <select className="input" value={gateIn.sealIntact} onChange={(event) => setGateIn((current) => ({ ...current, sealIntact: event.target.value }))}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </Field>
                  <Field label="Physical Condition Summary" hint="Automatically generated from the selected condition checklist below.">
                    <input className="input bg-slate-50" value={formatConditionSummary(gateIn.gateInConditions, gateIn.gateInConditionOther)} readOnly />
                  </Field>
                </div>
                <Field label="Container Condition Upon Entry" hint="You can select multiple conditions, including Other with a custom note.">
                  <ConditionChecklist
                    value={gateIn.gateInConditions}
                    otherValue={gateIn.gateInConditionOther}
                    onToggle={(option) => setGateIn((current) => ({
                      ...current,
                      gateInConditions: toggleConditionSelection(current.gateInConditions, option),
                    }))}
                    onOtherChange={(value) => setGateIn((current) => ({ ...current, gateInConditionOther: value }))}
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Truck Plate">
                    <input className="input uppercase" value={gateIn.truckPlateNumber} onChange={(event) => setGateIn((current) => ({ ...current, truckPlateNumber: event.target.value.toUpperCase() }))} />
                  </Field>
                  <Field label="Driver Name">
                    <input className="input" value={gateIn.driverName} onChange={(event) => setGateIn((current) => ({ ...current, driverName: event.target.value }))} />
                  </Field>
                  <Field label="Driver License">
                    <input className="input" value={gateIn.driverLicenseNumber} onChange={(event) => setGateIn((current) => ({ ...current, driverLicenseNumber: event.target.value }))} />
                  </Field>
                  <Field label="Hauler">
                    <input className="input" value={selectedBooking.hauler || gateInDetails.hauler || ""} readOnly />
                  </Field>
                </div>
                <Field label="Inspection Remarks">
                  <textarea className="input mt-4 min-h-[82px]" value={gateIn.inspectionRemarks} onChange={(event) => setGateIn((current) => ({ ...current, inspectionRemarks: event.target.value }))} />
                </Field>
              </WorkflowDecisionPanel>
            )}

            {selectedModalMode === "edit" && config.primarySection === "billing" && (
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

                <textarea className="input mt-4 min-h-[82px]" placeholder="Billing remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold text-blue-700">
                  Payment approval and rejection are available from the View modal after the submitted details are reviewed.
                </div>
              </div>
            )}

            {selectedModalMode === "view" && ["gateOut", "release"].includes(config.primarySection) && selectedBooking.status === "gate_out_reversal_requested" && (
              <WorkflowDecisionPanel
                icon={RotateCcw}
                eyebrow="Gate-Out Reversal Review"
                title="Return Container to Storage"
                description="Review the client request before cancelling the approved Gate-Out. Approval keeps the container in its current yard slot, resumes storage billing, and preserves the approved payment as booking credit."
                approveLabel="Approve Return to Storage"
                approveIcon={RotateCcw}
                onApprove={approveGateOutReversal}
                approveDisabled={saving || Boolean(selectedBooking.releasedAt)}
                rejectLabel="Reject Reversal"
                rejectReason={reversalRejectReason}
                onRejectReasonChange={setReversalRejectReason}
                rejectPlaceholder="Explain why the container must remain ready for release"
                onReject={rejectGateOutReversal}
                rejectDisabled={saving || !reversalRejectReason.trim()}
                note="Do not approve if the container has physically exited the yard. A completed release requires a new Gate-In transaction instead of reversal."
              >
                <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div><span className="font-black text-slate-500">Container:</span> {selectedBooking.containerNumber}</div>
                  <div><span className="font-black text-slate-500">Current Slot:</span> {selectedBooking.assignedSlotNumber || "Not assigned"}</div>
                  <div><span className="font-black text-slate-500">Gate-Out Approved:</span> {formatDate(selectedBooking.gateOutApprovedAt)}</div>
                  <div><span className="font-black text-slate-500">Reversal Requested:</span> {formatDate(selectedBooking.gateOutReversalRequestedAt)}</div>
                  <div><span className="font-black text-slate-500">Approved Payment:</span> PHP {Number(selectedBooking.approvedPaymentAmount || selectedBooking.billingTotal || 0).toLocaleString()}</div>
                  <div><span className="font-black text-slate-500">Current Gross Bill:</span> PHP {Number(selectedBooking.billingTotal || 0).toLocaleString()}</div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-black">Client reason</p>
                  <p className="mt-1 font-semibold leading-6">{selectedBooking.gateOutReversalRequestReason || "No reason provided."}</p>
                </div>

                <Field label="Admin Remarks" hint="Optional remarks are recorded in booking history and shown to the client.">
                  <textarea className="input min-h-[82px]" maxLength={500} placeholder="Add notes about returning this container to storage" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                </Field>
              </WorkflowDecisionPanel>
            )}

            {selectedModalMode === "view" && ["gateOut", "release"].includes(config.primarySection) && selectedBooking.status !== "gate_out_reversal_requested" && (
              <WorkflowDecisionPanel
                icon={Truck}
                eyebrow={config.primarySection === "release" ? "Release Processing" : "Gate-Out Review"}
                title={config.primarySection === "release" ? "Container Release" : "Gate-Out Decision"}
                description={config.primarySection === "release"
                  ? "Confirm the approved Gate-Out details and complete the physical container release."
                  : "Review the request and payment status, then approve or reject Gate-Out from this View modal."}
                approveLabel={config.primarySection === "release" ? "Complete Release" : "Approve Gate-Out"}
                approveIcon={Truck}
                onApprove={config.primarySection === "release" ? completeGateOut : approveGateOut}
                approveDisabled={saving || (config.primarySection === "release"
                  ? selectedBooking.status !== "gate_out_approved" || Boolean(selectedBooking.releasedAt)
                  : selectedBooking.status !== "gate_out_requested" || !hasApprovedPayment(selectedBooking))}
                rejectLabel={config.primarySection === "gateOut" ? "Reject Gate-Out" : undefined}
                rejectReason={gateOutRejectReason}
                onRejectReasonChange={setGateOutRejectReason}
                rejectPlaceholder="Explain why the Gate-Out request is being rejected"
                rejectFieldDisabled={config.primarySection !== "gateOut" || selectedBooking.status !== "gate_out_requested"}
                onReject={config.primarySection === "gateOut" ? rejectGateOut : undefined}
                rejectDisabled={saving || !gateOutRejectReason.trim() || selectedBooking.status !== "gate_out_requested"}
                note={config.primarySection === "gateOut" && selectedBooking.billingStatus !== "paid_approved"
                  ? "Gate-Out approval stays disabled until payment is paid and approved. Rejection remains available for a pending request."
                  : undefined}
              >
                <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div><span className="font-black text-slate-500">Requested:</span> {formatDate(selectedBooking.gateOutRequestedAt)}</div>
                  <div><span className="font-black text-slate-500">Scheduled Gate-Out:</span> {formatDate(selectedBooking.outDate)}</div>
                  <div><span className="font-black text-slate-500">Approved:</span> {formatDate(selectedBooking.gateOutApprovedAt)}</div>
                  <div><span className="font-black text-slate-500">Released:</span> {formatDate(selectedBooking.releasedAt)}</div>
                  <div><span className="font-black text-slate-500">Billing Gate:</span> {config.primarySection === "release" ? "Cleared at Gate-Out approval" : (selectedBooking.billingStatus === "paid_approved" ? "Ready" : "Payment not approved")}</div>
                  <div><span className="font-black text-slate-500">Gate-In LOLO Payment:</span> {Number(selectedBooking.gateInPaymentTotal || 0) > 0 ? `PHP ${Number(selectedBooking.gateInPaymentTotal).toLocaleString()} (separate transaction)` : "None"}</div>
                  <div><span className="font-black text-slate-500">Gate-Out Balance Due:</span> {config.primarySection === "release" ? "PHP 0 (payment locked)" : `PHP ${Number(selectedBooking.paymentBalanceDue ?? selectedBooking.paymentAmount ?? selectedBooking.billingTotal ?? 0).toLocaleString()}`}</div>
                  <div><span className="font-black text-slate-500">Release Window:</span> {selectedBooking.isOverstaying ? "Overstaying" : "Awaiting release"}</div>
                </div>

                {config.primarySection === "gateOut" && user?.role === "super_admin" && ["gate_out_requested", "gate_out_approved", "gate_out_reversal_requested"].includes(selectedBooking.status) && (
                  <div className="rounded-3xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-violet-700">Super Admin Date Correction</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">Correct Gate-In and Gate-Out date/time when operations were recorded late. Billing is recalculated after saving.</p>
                      </div>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">Whole-hour intervals</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Field label="Corrected Gate-In">
                        <input
                          type="datetime-local"
                          step="3600"
                          className="input bg-white"
                          value={gateOutDates.inDate}
                          onChange={(event) => setGateOutDates((current) => ({ ...current, inDate: event.target.value }))}
                          disabled={saving}
                        />
                      </Field>
                      <Field label="Corrected Gate-Out">
                        <input
                          type="datetime-local"
                          step="3600"
                          className="input bg-white"
                          value={gateOutDates.outDate}
                          onChange={(event) => setGateOutDates((current) => ({ ...current, outDate: event.target.value }))}
                          disabled={saving}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={saveGateOutDates} className="btn-primary" disabled={saving || !gateOutDates.inDate || !gateOutDates.outDate}>
                        <Clock3 size={16} /> Save Corrected Dates
                      </button>
                    </div>
                  </div>
                )}

                {config.primarySection === "release" && (
                  <div className={`rounded-3xl border p-4 text-sm ${selectedBooking.isOverstaying ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                    <p className="font-black uppercase tracking-wide">Gate-Out Payment Locked</p>
                    <p className="mt-1 font-semibold leading-6">
                      The Gate-Out payment was already paid and approved before this container reached Release Container. Completing the physical release will use that approved payment and will not recalculate or request an additional payment.
                    </p>
                    {selectedBooking.isOverstaying && (
                      <p className="mt-2 text-xs font-bold">The container is past its scheduled release window, but this release step does not generate supplemental Gate-Out charges.</p>
                    )}
                  </div>
                )}

                {selectedBooking.gateOutRejectionReason && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    <span className="font-black">Previous Gate-Out rejection:</span> {selectedBooking.gateOutRejectionReason}
                  </div>
                )}

                {config.primarySection === "release" && (
                  <Field label="Container Condition Upon Release" hint="Select all observed release conditions. The Gate-Out pass will use these values.">
                    <ConditionChecklist
                      value={releaseConditions.gateOutConditions}
                      otherValue={releaseConditions.gateOutConditionOther}
                      onToggle={(option) => setReleaseConditions((current) => ({
                        ...current,
                        gateOutConditions: toggleConditionSelection(current.gateOutConditions, option),
                      }))}
                      onOtherChange={(value) => setReleaseConditions((current) => ({ ...current, gateOutConditionOther: value }))}
                    />
                  </Field>
                )}

                <Field label={config.primarySection === "release" ? "Release Remarks" : "Gate-Out Remarks"} hint="Optional remarks are included in the workflow history.">
                  <textarea className="input min-h-[82px]" placeholder={config.primarySection === "release" ? "Add release remarks" : "Add Gate-Out approval remarks"} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
                </Field>
              </WorkflowDecisionPanel>
            )}
              </>
            </div>
          </div>
        </div>
      )}

      {showPaymentAdjustmentModal && selectedBooking && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Super Admin Editable Pay</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Edit {paymentAdjustment.paymentStage === "gate_in" ? "Gate-In" : "Gate-Out"} Payment</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedBooking.bookingReference} • {selectedBooking.containerNumber}</p>
              </div>
              <ModalCloseButton onClick={closePaymentAdjustment} label="Close payment adjustment" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Current Pay</p>
                <p className="mt-1 text-xl font-black text-slate-900">PHP {Number(paymentAdjustment.previousAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Reference</p>
                <p className="mt-1 break-all text-sm font-black text-slate-900">{paymentAdjustment.referenceNumber || "No reference"}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="New Pay Amount" hint="This changes the approved payment amount only. Billing charges and rates are not changed.">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={paymentAdjustment.amount}
                  onChange={(event) => setPaymentAdjustment((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                  autoFocus
                />
              </Field>
              <Field label="Adjustment Note" hint="Optional. This will be recorded in the booking history and admin audit log.">
                <textarea
                  className="input min-h-[90px]"
                  value={paymentAdjustment.reason}
                  onChange={(event) => setPaymentAdjustment((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Why is the payment amount being corrected?"
                  maxLength={500}
                />
              </Field>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              If the new payment is lower than the {paymentAdjustment.paymentStage === "gate_in" ? "Gate-In" : "Gate-Out"} bill, the remaining balance will become payable again. If the container has already been released, Revenue and the Release Report are updated to the corrected paid amount.
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={closePaymentAdjustment} className="btn-secondary" disabled={saving}>Cancel</button>
              <button type="button" onClick={savePaymentAdjustment} className="btn-primary" disabled={saving || paymentAdjustment.amount === "" || Number(paymentAdjustment.amount) < 0}>
                <Pencil size={16} /> {saving ? "Saving..." : "Save Pay Amount"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCashModal && cashBooking && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{cashPaymentStage === "gate_in" ? "Gate-In LOLO Cash Payment" : "Gate-Out Cash Payment"}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{cashBooking.bookingReference}</h2><p className="text-sm font-semibold text-slate-500">{cashBooking.clientName} • {cashBooking.containerNumber}</p><ContainerClassificationBadges loadStatus={cashBooking.containerLoadStatus} rateType={cashBooking.rateType} className="mt-3" /></div>
              <ModalCloseButton onClick={closeCashModal} label="Close cash payment modal" />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Transaction breakdown</p>
              <div className="mt-3 space-y-2">
                {(cashBooking.billingLineItems || []).map((item, index) => <div key={`${item.chargeCode}-${index}`} className="flex justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"><span className="font-semibold text-slate-700">{item.description || item.chargeCode} <span className="text-xs text-slate-400">({item.quantity} × PHP {Number(item.rateAmount || 0).toLocaleString()})</span></span><strong>PHP {Number(item.amount || 0).toLocaleString()}</strong></div>)}
                {cashAdditionalItems.map((item, index) => {
                  const amount = Math.round((Math.max(Number(item.quantity) || 0, 0) * Math.max(Number(item.rateAmount) || 0, 0)) * 100) / 100
                  return (
                    <div key={`pending-cash-item-${index}`} className="flex justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-amber-900">{item.description.trim() || `Additional item ${index + 1}`} <span className="text-xs text-amber-600">({Number(item.quantity) || 0} × PHP {Number(item.rateAmount || 0).toLocaleString()}) • New</span></span>
                      <strong className="text-amber-950">PHP {amount.toLocaleString()}</strong>
                    </div>
                  )
                })}
                {(cashBooking.billingLineItems || []).length === 0 && cashAdditionalItems.length === 0 && (
                  <p className="rounded-xl bg-white px-3 py-4 text-center text-sm font-semibold text-slate-500">No billing items available.</p>
                )}
              </div>
            </div>

            {cashPaymentStage === "gate_out" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-700">Additional items</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Add walk-in charges before completing this cash payment.</p>
                </div>
                <button type="button" onClick={addCashAdditionalItem} className="btn-secondary" disabled={saving || cashAdditionalItems.length >= 20}>
                  <Plus size={16} /> Add Item
                </button>
              </div>

              {cashAdditionalItems.length > 0 && (
                <div className="mt-4 space-y-3">
                  {cashAdditionalItems.map((item, index) => {
                    const amount = Math.round((Math.max(Number(item.quantity) || 0, 0) * Math.max(Number(item.rateAmount) || 0, 0)) * 100) / 100
                    return (
                      <div key={`cash-additional-form-${index}`} className="rounded-2xl border border-amber-200 bg-white p-3 shadow-sm">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_130px_44px]">
                          <Field label="Item description"><input className="input" value={item.description} onChange={(event) => updateCashAdditionalItem(index, "description", event.target.value)} placeholder="e.g. Documentation fee" disabled={saving} /></Field>
                          <Field label="Quantity"><input type="number" min="0.01" step="0.01" className="input" value={item.quantity} onChange={(event) => updateCashAdditionalItem(index, "quantity", event.target.value)} disabled={saving} /></Field>
                          <Field label="Rate"><input type="number" min="0.01" step="0.01" className="input" value={item.rateAmount} onChange={(event) => updateCashAdditionalItem(index, "rateAmount", event.target.value)} placeholder="0.00" disabled={saving} /></Field>
                          <div className="flex items-end"><button type="button" onClick={() => removeCashAdditionalItem(index)} className="grid h-[46px] w-11 place-items-center rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100" aria-label={`Remove additional item ${index + 1}`} disabled={saving}><Trash2 size={16} /></button></div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                          <Field label="Notes (Optional)"><input className="input" value={item.notes} onChange={(event) => updateCashAdditionalItem(index, "notes", event.target.value)} placeholder="Internal note for this charge" disabled={saving} /></Field>
                          <div className="rounded-xl bg-slate-950 px-4 py-3 text-white"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Item amount</p><p className="mt-1 text-lg font-black">PHP {amount.toLocaleString()}</p></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            ) : (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
                Gate-In cash payment contains Lift On / Lift Off charges only. Storage and other charges are added during Gate-Out.
              </div>
            )}

            {cashPaymentStage === "gate_out" && cashGateInPayment > 0 && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Gate-In Payment Details</p>
                <p className="mt-1 text-sm font-semibold text-emerald-900">LOLO payment was collected during Gate-In and remains a separate Gate-In transaction.</p>
                <div className="mt-3 flex items-center justify-between border-t border-emerald-200 pt-3 text-sm">
                  <span className="font-bold text-emerald-800">Gate-In LOLO Payment</span>
                  <strong className="text-emerald-900">PHP {cashGateInPayment.toLocaleString()}</strong>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-2xl border p-4 ${cashPayment.isVatApplicable ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}><input type="radio" className="mr-2" checked={cashPayment.isVatApplicable} onChange={() => setCashPayment((current) => ({ ...current, isVatApplicable: true }))} /><strong>VAT</strong><p className="mt-1 text-xs text-slate-500">Generate Official Receipt</p></label>
              <label className={`cursor-pointer rounded-2xl border p-4 ${!cashPayment.isVatApplicable ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}><input type="radio" className="mr-2" checked={!cashPayment.isVatApplicable} onChange={() => setCashPayment((current) => ({ ...current, isVatApplicable: false }))} /><strong>Non-VAT</strong><p className="mt-1 text-xs text-slate-500">Generate Acknowledgement Receipt</p></label>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-950 p-5 text-white">
              <div className="flex justify-between text-sm"><span>Existing billing subtotal</span><strong>PHP {cashBaseSubtotal.toLocaleString()}</strong></div>
              {cashAdditionalSubtotal > 0 && <div className="mt-2 flex justify-between text-sm text-amber-300"><span>New additional items</span><strong>PHP {cashAdditionalSubtotal.toLocaleString()}</strong></div>}
              <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-sm"><span>Subtotal</span><strong>PHP {cashSubtotal.toLocaleString()}</strong></div>
              <div className="mt-2 flex justify-between text-sm"><span>VAT {cashPayment.isVatApplicable ? `(${cashVatRate * 100}%)` : "(Non-VAT)"}</span><strong>PHP {cashVatAmount.toLocaleString()}</strong></div>
              <div className="mt-3 flex justify-between border-t border-white/20 pt-3 text-sm"><span>Gross Total</span><strong>PHP {cashGrossTotal.toLocaleString()}</strong></div>
              {cashPaymentStage === "gate_in" && cashApprovedCredit > 0 && <div className="mt-2 flex justify-between text-sm text-emerald-200"><span>Approved Gate-In Payment</span><strong>PHP {cashApprovedCredit.toLocaleString()}</strong></div>}
              {cashPaymentStage === "gate_out" && cashGateOutPayment > 0 && <div className="mt-2 flex justify-between text-sm text-amber-200"><span>Approved Gate-Out Payment</span><strong>- PHP {cashGateOutPayment.toLocaleString()}</strong></div>}
              {cashPaymentStage === "gate_out" && cashGateInPayment > 0 && (<>
                <div className="mt-2 flex justify-between text-sm text-emerald-200"><span>Gate-In LOLO Payment (Already Paid)</span><strong>PHP {cashGateInPayment.toLocaleString()}</strong></div>
                <div className="mt-2 text-xs text-emerald-200">This Gate-In payment is shown for payment history only. It is not deducted from the Gate-Out transaction.</div>
              </>)}
              <div className="mt-3 flex justify-between border-t border-white/20 pt-3 text-xl"><span>Total Balance to Pay</span><strong>PHP {cashTotal.toLocaleString()}</strong></div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Cash Received"><input type="number" min={cashTotal} step="0.01" className="input" value={cashPayment.cashReceived} onChange={(event) => setCashPayment((current) => ({ ...current, cashReceived: event.target.value }))} placeholder={`Minimum ${cashTotal}`} /></Field>
              <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Change</p><p className="mt-1 text-2xl font-black text-emerald-800">PHP {cashChange.toLocaleString()}</p></div>
              <Field label="Payment Reference (Optional)"><input className="input" value={cashPayment.paymentReferenceNumber} onChange={(event) => setCashPayment((current) => ({ ...current, paymentReferenceNumber: event.target.value }))} /></Field>
              <Field label="Remarks"><input className="input" value={cashPayment.paymentRemarks} onChange={(event) => setCashPayment((current) => ({ ...current, paymentRemarks: event.target.value }))} /></Field>
            </div>
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-700">
              {cashPaymentStage === "gate_in"
                ? "Submitting records and approves the LOLO payment, generates the receipt, and unlocks Gate-In approval."
                : "Submitting records the cash payment, approves it, and generates the receipt. Gate-Out approval remains available only in the View modal."}
            </div>
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={closeCashModal} className="btn-secondary" disabled={saving}>Cancel</button><button type="button" onClick={recordCashPayment} className="btn-primary" disabled={saving || cashReceivedValue < cashTotal}><Banknote size={16} /> {saving ? "Processing..." : "Record Cash Payment"}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}


const BookingModuleViewSummary = ({ booking, section }) => {
  const lineItems = booking.billingLineItems || []

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Eye size={18} className="text-emerald-700" />
        <h3 className="text-lg font-black text-slate-950">Read-only Details</h3>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-500">{section === "billing" ? "Review the submitted billing details and use the payment decision panel below." : "Review these details and use the workflow decision panel below. All approval and rejection actions are available only in the View modal."}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Booking Status" value={statusLabels[booking.status] || booking.status} />
        <Detail label="Billing Status" value={billingLabels[booking.billingStatus] || booking.billingStatus} />
        <Detail label="LOLO Collection" value={booking.loloPaymentStage === "gate_out" ? "Gate-Out" : "Gate-In"} />
        <Detail label="Booking Number" value={booking.bookingNumber || booking.bookingReference} />
        <Detail label="Load Status" value={booking.containerLoadStatus === "laden" ? "Laden" : booking.containerLoadStatus === "empty" ? "Empty" : "Unknown"} />
        <Detail label="Rate Classification" value={booking.rateType === "international" ? "International" : "Local"} />
        <Detail label="Yard Area" value={booking.assignedAreaName} />
        <Detail label="Block / Slot" value={[booking.assignedBlockName || booking.assignedBlockCode, booking.assignedSlotNumber].filter(Boolean).join(" • ")} />
        <Detail label="Date In" value={formatDate(getBookingInDate(booking))} />
        <Detail label="Date / Time Out" value={formatDate(getBookingOutDate(booking))} />
        <Detail label="Gate-In Condition" value={formatConditionSummary(booking.gateInConditions, booking.gateInConditionOther)} />
        <Detail label="Gate-Out Condition" value={formatConditionSummary(booking.gateOutConditions, booking.gateOutConditionOther)} />
        <Detail label="Seal Number" value={booking.sealNumber} />
      </div>

      {section === "gateIn" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Actual Container Number" value={booking.actualContainerNumber || booking.containerNumber} />
          <Detail label="Truck Plate" value={booking.truckPlateNumber} />
          <Detail label="Driver" value={booking.driverName} />
          <Detail label="Driver License" value={booking.driverLicenseNumber} />
          <Detail label="Hauler" value={booking.hauler} />
          <Detail label="Seal Intact" value={booking.sealIntact ? booking.sealIntact.toUpperCase() : "-"} />
          <Detail label="Gate-In Approved" value={formatDate(booking.gateInApprovedAt)} />
          <Detail label="Processed By" value={booking.gateInApprovedByName} />
          <Detail label="Inspection Remarks" value={booking.inspectionRemarks} />
        </div>
      )}

      {section === "billing" && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Subtotal" value={`PHP ${Number(booking.billingSubtotal || 0).toLocaleString()}`} />
            <Detail label="VAT" value={`PHP ${Number(booking.vatAmount || 0).toLocaleString()}`} />
            <Detail label="Total" value={`PHP ${Number(booking.billingTotal || booking.paymentAmount || 0).toLocaleString()}`} />
            <Detail label="Payment Type" value={booking.paymentTypeSnapshot?.name} />
            <Detail label="Payment Reference" value={booking.paymentReferenceNumber} />
            <Detail label="Payment Submitted" value={formatDate(booking.paymentSubmittedAt)} />
          </div>
          {lineItems.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">Billing Breakdown</div>
              <div className="mt-3 space-y-2">
                {lineItems.map((item, index) => (
                  <div key={`${item.chargeCode || item.description}-${index}`} className="flex items-start justify-between gap-4 rounded-xl bg-white px-3 py-2 text-sm">
                    <span className="font-bold text-slate-700">{item.description || item.chargeCode}</span>
                    <span className="font-black text-slate-950">PHP {Number(item.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <PaymentHistoryBreakdown booking={booking} className="sm:col-span-2 lg:col-span-3" />

          {(booking.paymentProofs || []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {(booking.paymentProofs || []).map((document, index) => (
                <a key={`${document.url}-${index}`} href={resolveFileUrl(document.secureUrl || document.url)} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 underline">
                  {document.label || `Payment Proof ${index + 1}`}
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {["gateOut", "release"].includes(section) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Gate-Out Requested" value={formatDate(booking.gateOutRequestedAt)} />
          <Detail label="Gate-Out Approved" value={formatDate(booking.gateOutApprovedAt)} />
          <Detail label="Reversal Requested" value={formatDate(booking.gateOutReversalRequestedAt)} />
          <Detail label="Reversal Reason" value={booking.gateOutReversalRequestReason} />
          <Detail label="Reversal Decision" value={booking.gateOutReversalDecision} />
          <Detail label="Gate-In LOLO Payment (Separate)" value={Number(booking.gateInPaymentTotal || 0) > 0 ? `PHP ${Number(booking.gateInPaymentTotal).toLocaleString()}` : "None"} />
          <Detail label="Gate-Out Billing" value={`PHP ${Number(booking.gateOutBillingTotal ?? booking.billingTotal ?? 0).toLocaleString()}`} />
          <Detail label="Total Billing (Gate-In + Gate-Out)" value={`PHP ${Number(booking.totalBillingAmount ?? ((Number(booking.gateInPaymentTotal) || 0) + (Number(booking.gateOutBillingTotal ?? booking.billingTotal) || 0))).toLocaleString()}`} />
          <Detail label="Balance Due" value={`PHP ${Number(booking.paymentBalanceDue ?? booking.paymentAmount ?? 0).toLocaleString()}`} />
          <Detail label="Released" value={formatDate(booking.releasedAt)} />
          <Detail label="Receipt Number" value={booking.receiptNumber} />
          <Detail label="Payment Type" value={booking.paymentTypeSnapshot?.name} />
          <Detail label="Release Remarks" value={booking.gateOutRemarks || booking.remarks} />
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

export default AdminBookingModule
