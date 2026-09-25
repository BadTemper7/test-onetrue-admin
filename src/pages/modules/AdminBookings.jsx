import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
  Truck,
} from "lucide-react"
import Alert from "../../components/Alert"
import ModernDateInput from "../../components/ModernDateInput"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import Pagination from "../../components/ui/Pagination"
import TableActionButton from "../../components/ui/TableActionButton"
import TableCrudActions from "../../components/ui/TableCrudActions"
import ContainerClassificationBadges from "../../components/ui/ContainerClassificationBadges"
import ContainerClassificationFilters from "../../components/ui/ContainerClassificationFilters"
import { useClickOutside } from "../../hooks/useClickOutside"
import { api, getApiError } from "../../lib/api"
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

const billingLabels = {
  unpaid: "Unpaid",
  payment_submitted: "Payment Submitted",
  payment_under_review: "Payment Under Review",
  payment_rejected: "Payment Rejected",
  additional_payment_required: "Additional Payment Required",
  paid_approved: "Paid / Approved",
}

const statusClass = (status) => {
  if (["stored_in_assigned_area", "completed_gate_out_done", "paid_approved"].includes(status)) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
  if (["approved_area_assigned", "gate_in_approved", "gate_out_approved"].includes(status)) return "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
  if (["rejected", "cancelled", "payment_rejected"].includes(status)) return "bg-red-50 text-red-700 ring-1 ring-red-100"
  if (status === "additional_payment_required") return "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
}

const formatDate = (value) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString()
}

const formatDateValue = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const shiftDateValue = (value, deltaDays) => {
  const date = value ? new Date(`${value}T00:00:00`) : new Date()
  if (Number.isNaN(date.getTime())) return formatDateValue(new Date())
  date.setDate(date.getDate() + deltaDays)
  return formatDateValue(date)
}

const formatScheduleHeading = (value) => {
  if (!value) return "Selected date"
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
}

const formatHourValue = (hour, minutes = 0) => {
  const date = new Date()
  date.setHours(hour, minutes, 0, 0)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const getScheduleSlotClasses = (status) => {
  if (["approved_area_assigned", "gate_in_approved"].includes(status)) {
    return {
      card: "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100/70",
      status: "text-emerald-700",
      dot: "bg-emerald-500",
    }
  }

  if (status === "pending_admin_approval") {
    return {
      card: "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100/70",
      status: "text-amber-700",
      dot: "bg-amber-500",
    }
  }

  if (["stored_in_assigned_area", "gate_out_requested", "gate_out_approved", "gate_out_reversal_requested"].includes(status)) {
    return {
      card: "border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100/70",
      status: "text-blue-700",
      dot: "bg-blue-500",
    }
  }

  if (status === "completed_gate_out_done") {
    return {
      card: "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100/80",
      status: "text-slate-700",
      dot: "bg-slate-500",
    }
  }

  return {
    card: "border-violet-200 bg-violet-50 hover:border-violet-300 hover:bg-violet-100/70",
    status: "text-violet-700",
    dot: "bg-violet-500",
  }
}

const AdminBookings = () => {
  const [bookings, setBookings] = useState([])
  const [summary, setSummary] = useState({})
  const [clients, setClients] = useState([])
  const [filters, setFilters] = useState({ status: "all", billingStatus: "all", loadStatus: "all", rateType: "all", recordSource: "all", clientId: "all", search: "" })
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState("")
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [printDocumentType, setPrintDocumentType] = useState("gateIn")
  const [rateTypeDraft, setRateTypeDraft] = useState("local")
  const [savingRateType, setSavingRateType] = useState(false)
  const [trackingAlert, setTrackingAlert] = useState({ type: "", message: "" })
  const [alert, setAlert] = useState({ type: "", message: "" })
  const [trackingView, setTrackingView] = useState("table")
  const [scheduleDate, setScheduleDate] = useState(() => formatDateValue(new Date()))
  const [scheduleRows, setScheduleRows] = useState([])
  const [scheduleSummary, setScheduleSummary] = useState({ total: 0, pending: 0, approved: 0, active: 0, completed: 0, other: 0 })
  const [scheduleMaxSlots, setScheduleMaxSlots] = useState(4)
  const [scheduleOverflowCount, setScheduleOverflowCount] = useState(0)
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleAlert, setScheduleAlert] = useState({ type: "", message: "" })
  const [bookingPage, setBookingPage] = useState(1)
  const [bookingPageSize, setBookingPageSize] = useState(10)
  const [bookingMeta, setBookingMeta] = useState({ total: 0, totalPages: 1 })
  const bookingRequestRef = useRef(null)
  const filterRef = useRef(null)
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const canDeleteBooking = hasModulePermission(user, "operations", "delete")
  const canEditRateClassification = hasModulePermission(user, "operations", "edit")
  const rateClassificationLocked = selectedBooking && !["unpaid", "payment_rejected"].includes(selectedBooking.billingStatus)

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  const loadBookings = async () => {
    bookingRequestRef.current?.abort()
    const controller = new AbortController()
    bookingRequestRef.current = controller
    try {
      setLoading(true)
      setAlert({ type: "", message: "" })
      const params = new URLSearchParams()
      if (filters.status) params.set("status", filters.status)
      if (filters.billingStatus) params.set("billingStatus", filters.billingStatus)
      if (filters.search.trim()) params.set("search", filters.search.trim())
      if (filters.loadStatus !== "all") params.set("loadStatus", filters.loadStatus)
      if (filters.rateType !== "all") params.set("rateType", filters.rateType)
      if (filters.recordSource !== "all") params.set("recordSource", filters.recordSource)
      if (filters.clientId !== "all") params.set("clientId", filters.clientId)
      params.set("page", String(bookingPage))
      params.set("limit", String(bookingPageSize))

      const [{ data }, summaryResponse] = await Promise.all([
        api.get(`/admin/bookings?${params.toString()}`, { signal: controller.signal }),
        api.get("/admin/bookings/summary").catch(() => ({ data: { summary: {} } })),
      ])
      setBookings(data.bookings || [])
      setBookingMeta(data.pagination || { total: 0, totalPages: 1 })
      setSummary(summaryResponse.data.summary || {})
    } catch (error) {
      if (error?.code !== "ERR_CANCELED") setAlert({ type: "error", message: getApiError(error) })
    } finally {
      if (bookingRequestRef.current === controller) setLoading(false)
    }
  }

  const loadClients = async () => {
    try {
      const { data } = await api.get("/admin/bookings/clients")
      setClients(data.clients || [])
    } catch {
      setClients([])
    }
  }

  const loadBookingCalendar = async (dateValue = scheduleDate) => {
    try {
      setScheduleLoading(true)
      setScheduleAlert({ type: "", message: "" })
      const params = new URLSearchParams({
        date: dateValue,
        timezoneOffset: String(new Date().getTimezoneOffset()),
      })
      if (filters.clientId !== "all") params.set("clientId", filters.clientId)
      const { data } = await api.get(`/admin/bookings/calendar?${params.toString()}`)
      setScheduleRows(data.rows || [])
      setScheduleSummary(data.summary || { total: 0, pending: 0, approved: 0, active: 0, completed: 0, other: 0 })
      setScheduleMaxSlots(Number(data.maxSlotsPerHour) || 4)
      setScheduleOverflowCount(Number(data.overflowCount) || 0)
    } catch (error) {
      setScheduleRows([])
      setScheduleSummary({ total: 0, pending: 0, approved: 0, active: 0, completed: 0, other: 0 })
      setScheduleMaxSlots(4)
      setScheduleOverflowCount(0)
      setScheduleAlert({ type: "error", message: getApiError(error) })
    } finally {
      setScheduleLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadBookings, filters.search.trim() ? 250 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingPage, bookingPageSize, filters.status, filters.billingStatus, filters.loadStatus, filters.rateType, filters.recordSource, filters.clientId, filters.search])

  useEffect(() => { setBookingPage(1) }, [filters.status, filters.billingStatus, filters.loadStatus, filters.rateType, filters.recordSource, filters.clientId, filters.search])

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    loadBookingCalendar(scheduleDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDate, filters.clientId])

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
      await Promise.all([loadBookings(), loadBookingCalendar(scheduleDate)])
      setAlert({ type: "success", message: data.message || "Booking deleted successfully." })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setDeletingId("")
    }
  }


  const viewBooking = (booking) => {
    setSelectedBooking(booking)
    setPrintDocumentType(
      booking.gateOutApprovedAt
        ? "gateOut"
        : booking.gateInApprovedAt
          ? "gateIn"
          : "invoice",
    )
    setRateTypeDraft(booking.rateType === "international" ? "international" : "local")
    setTrackingAlert({ type: "", message: "" })
  }

  const closeBookingView = () => {
    setSelectedBooking(null)
    setTrackingAlert({ type: "", message: "" })
  }

  const handleRefresh = async () => {
    if (trackingView === "calendar") {
      await loadBookingCalendar(scheduleDate)
      return
    }

    await loadBookings()
  }

  const updateRateClassification = async () => {
    if (!selectedBooking || !canEditRateClassification || rateClassificationLocked) return

    try {
      setSavingRateType(true)
      setTrackingAlert({ type: "", message: "" })
      const { data } = await api.patch(`/admin/bookings/${selectedBooking.id}/rate-classification`, {
        rateType: rateTypeDraft,
      })
      const updatedBooking = data.booking
      setBookings((current) => current.map((booking) => booking.id === updatedBooking.id ? updatedBooking : booking))
      setSelectedBooking(updatedBooking)
      setRateTypeDraft(updatedBooking.rateType === "international" ? "international" : "local")
      setTrackingAlert({ type: "success", message: data.message || "Rate classification and billing updated." })
    } catch (error) {
      setTrackingAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSavingRateType(false)
    }
  }

  const editBooking = (booking) => {
    let route = "/billing/payment-verification"

    if (["pending_admin_approval", "rejected", "cancelled"].includes(booking.status)) {
      route = "/operations/pre-advice"
    } else if (booking.status === "approved_area_assigned") {
      route = "/operations/gate-in"
    } else if (booking.status === "gate_out_requested") {
      route = "/billing/gate-out"
    } else if (["gate_out_approved", "gate_out_reversal_requested", "completed_gate_out_done"].includes(booking.status)) {
      route = "/billing/release-container"
    }

    navigate(route, { state: { bookingId: booking.id, openMode: "edit" } })
  }

  const totals = useMemo(() => ({
    all: summary.total ?? bookings.length,
    active: bookings.filter((item) => !["rejected", "cancelled", "completed_gate_out_done"].includes(item.status)).length,
    completed: summary.completed ?? bookings.filter((item) => item.status === "completed_gate_out_done").length,
  }), [bookings, summary])

  const pagination = {
    page: bookingPage, setPage: setBookingPage, pageSize: bookingPageSize,
    setPageSize: (value) => { setBookingPageSize(Number(value)); setBookingPage(1) },
    totalItems: bookingMeta.total, totalPages: Math.max(bookingMeta.totalPages || 1, 1),
    startItem: bookingMeta.total ? ((bookingPage - 1) * bookingPageSize) + 1 : 0,
    endItem: Math.min(bookingPage * bookingPageSize, bookingMeta.total || 0),
    pageSizeOptions: [10, 20, 50, 100], paginatedItems: bookings,
  }
  const printAvailability = selectedBooking ? {
    gateIn: Boolean(selectedBooking.gateInApprovedAt && selectedBooking.gateInPassNumber),
    gateOut: Boolean(selectedBooking.gateOutApprovedAt && selectedBooking.gateOutPassNumber),
    invoice: Boolean(
      Number(selectedBooking.billingTotal || selectedBooking.paymentAmount || 0) > 0 ||
      (selectedBooking.billingLineItems || []).length > 0,
    ),
  } : { gateIn: false, gateOut: false, invoice: false }
  const selectedPrintAvailable = Boolean(printAvailability[printDocumentType])

  const printSelectedDocument = () => {
    if (!selectedBooking || !selectedPrintAvailable) return
    printBookingDocument(selectedBooking, printDocumentType)
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Operations Monitoring</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Container Tracking</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Track bookings, container movements, yard locations, billing statuses, and remove test records when needed.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-100 p-1 sm:w-auto" role="group" aria-label="Container tracking view">
              <button
                type="button"
                aria-pressed={trackingView === "table"}
                onClick={() => setTrackingView("table")}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition sm:flex-none ${trackingView === "table" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Table2 size={17} /> Table
              </button>
              <button
                type="button"
                aria-pressed={trackingView === "calendar"}
                onClick={() => setTrackingView("calendar")}
                className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition sm:flex-none ${trackingView === "calendar" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
              >
                <CalendarDays size={17} /> Calendar
              </button>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="btn-secondary shrink-0"
              disabled={trackingView === "calendar" ? scheduleLoading : loading}
            >
              <RefreshCw size={16} className={(trackingView === "calendar" ? scheduleLoading : loading) ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div><div className="text-xs font-black uppercase tracking-wide text-slate-500">Total Bookings</div><div className="mt-2 text-3xl font-black text-slate-950">{totals.all}</div></div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><Boxes size={20} /></div>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-center justify-between">
              <div><div className="text-xs font-black uppercase tracking-wide text-blue-600">Active Movements</div><div className="mt-2 text-3xl font-black text-blue-700">{totals.active}</div></div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm"><Truck size={20} /></div>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-center justify-between">
              <div><div className="text-xs font-black uppercase tracking-wide text-emerald-600">Completed</div><div className="mt-2 text-3xl font-black text-emerald-700">{totals.completed}</div></div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm"><CheckCircle2 size={20} /></div>
            </div>
          </div>
        </div>
        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      {trackingView === "calendar" && (
        <section className="card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Gate Schedule</div>
            <h3 className="mt-1 text-xl font-black text-slate-950">Container Slot Calendar</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              View the full 24-hour container schedule with four available slots per hour. Rejected and cancelled bookings do not occupy a slot.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 px-1">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                <CalendarDays size={19} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Currently Viewing</p>
                <p className="mt-0.5 truncate text-base font-black text-slate-950">{formatScheduleHeading(scheduleDate)}</p>
              </div>
            </div>

            <div className="grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 lg:flex lg:w-auto">
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-white text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                onClick={() => setScheduleDate((current) => shiftDateValue(current, -1))}
                aria-label="Previous date"
                title="Previous date"
              >
                <ChevronLeft size={19} />
              </button>

              <div className="min-w-0 lg:w-[230px]">
                <ModernDateInput
                  type="date"
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  placeholder="Select schedule date"
                  clearable={false}
                  variant="compact"
                />
              </div>

              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-white text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                onClick={() => setScheduleDate((current) => shiftDateValue(current, 1))}
                aria-label="Next date"
                title="Next date"
              >
                <ChevronRight size={19} />
              </button>

              <button
                type="button"
                className="col-span-3 h-11 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 lg:col-auto"
                onClick={() => setScheduleDate(formatDateValue(new Date()))}
              >
                Today
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Client Filter</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">Limit this tracking calendar to one client.</p>
            </div>
            <select
              className="input !py-2.5 sm:w-[280px]"
              value={filters.clientId}
              onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value }))}
            >
              <option value="all">All clients</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              <div className="flex items-start gap-3">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-black text-blue-900">Each hour allows a maximum of {scheduleMaxSlots} container bookings.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Legend label="Pending Approval" classes="bg-amber-100 text-amber-700" />
              <Legend label="Approved" classes="bg-emerald-100 text-emerald-700" />
              <Legend label="Active Movement" classes="bg-blue-100 text-blue-700" />
              <Legend label="Completed" classes="bg-slate-200 text-slate-700" />
            </div>
          </div>
        </div>

        <div className="p-5">
          <Alert type={scheduleAlert.type}>{scheduleAlert.message}</Alert>

          <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200">
            <table className="min-w-[1100px] w-full table-fixed border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-40 border-b border-slate-200 px-4 py-4">Time</th>
                  {Array.from({ length: scheduleMaxSlots }, (_, index) => (
                    <th key={`slot-header-${index + 1}`} className="border-b border-slate-200 px-4 py-4">Slot {index + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleLoading && <TableLoadingRow colSpan={scheduleMaxSlots + 1} rows={5} label="Loading slot calendar" />}
                {!scheduleLoading && scheduleRows.map((row) => (
                  <tr key={`schedule-row-${row.hour}`} className="align-top">
                    <td className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
                      <div className="font-black text-slate-900">{formatHourValue(row.hour)}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">{formatHourValue(row.hour)} - {formatHourValue((row.hour + 1) % 24)}</div>
                    </td>
                    {row.slots.map((slot) => {
                      const booking = slot.booking
                      const styles = getScheduleSlotClasses(booking?.status)

                      return (
                        <td key={`schedule-slot-${row.hour}-${slot.slotNumber}`} className="border-b border-l border-slate-200 px-3 py-3">
                          {booking ? (
                            <button
                              type="button"
                              onClick={() => viewBooking(booking)}
                              className={`flex min-h-[170px] w-full flex-col rounded-2xl border p-4 text-left transition ${styles.card}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Container Number</p>
                                  <p className="mt-1 text-sm font-black text-slate-950">{booking.containerNumber}</p>
                                </div>
                                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm">
                                  {booking.bookingReference}
                                </span>
                              </div>
                              <div className="mt-3 space-y-1.5 text-xs font-semibold text-slate-700">
                                <p><span className="font-black text-slate-500">Client:</span> {booking.clientName || "Client"}</p>
                                <p><span className="font-black text-slate-500">Size:</span> {booking.containerSize}FT</p>
                                <p><span className="font-black text-slate-500">Rate Type:</span> {booking.rateType === "international" ? "International" : "Local"}</p>
                              </div>
                              <div className={`mt-auto inline-flex items-center gap-2 pt-4 text-xs font-black uppercase tracking-wide ${styles.status}`}>
                                <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                                {statusLabels[booking.status] || booking.status}
                              </div>
                            </button>
                          ) : (
                            <div className="flex min-h-[170px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center">
                              <div className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-500">Available</div>
                              <p className="mt-3 text-xs font-semibold text-slate-400">No container booked for this slot.</p>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {!scheduleLoading && scheduleRows.length === 0 && (
                  <tr>
                    <td colSpan={scheduleMaxSlots + 1} className="px-5 py-16 text-center font-semibold text-slate-500">
                      No slot schedule found for the selected date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <ScheduleSummaryCard label="Total Bookings" value={scheduleSummary.total || 0} valueClassName="text-slate-950" />
            <ScheduleSummaryCard label="Pending Approval" value={scheduleSummary.pending || 0} valueClassName="text-amber-600" />
            <ScheduleSummaryCard label="Approved" value={scheduleSummary.approved || 0} valueClassName="text-emerald-600" />
            <ScheduleSummaryCard label="In Progress / Completed" value={(scheduleSummary.active || 0) + (scheduleSummary.completed || 0) + (scheduleSummary.other || 0)} valueClassName="text-blue-600" />
          </div>

          {scheduleOverflowCount > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              {scheduleOverflowCount} additional booking(s) were found beyond the {scheduleMaxSlots}-slot display limit for at least one hour. Please review the booking schedule setup for that date.
            </div>
          )}
        </div>
        </section>
      )}

      {trackingView === "table" && (
        <section className="card overflow-visible">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">All Bookings and Container Status</h3>
            <p className="text-sm font-semibold text-slate-500">Search, filter, and manage the container tracking list.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative" data-field-control>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                className="input w-full !rounded-2xl !py-3 !pl-10 !pr-4 text-sm sm:w-[340px]"
                placeholder="Search booking, container, client..."
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => event.key === "Enter" && loadBookings()}
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
                    <p className="text-sm font-black text-slate-950">Filter Tracking</p>
                    <button type="button" onClick={() => setFilters((current) => ({ ...current, status: "all", billingStatus: "all", loadStatus: "all", rateType: "all", recordSource: "all", clientId: "all" }))} className="text-xs font-black text-emerald-700">Reset</button>
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
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Client</span>
                      <select className="input !py-3" value={filters.clientId} onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value }))}>
                        <option value="all">All clients</option>
                        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Record Source</span>
                      <select className="input !py-3" value={filters.recordSource} onChange={(event) => setFilters((current) => ({ ...current, recordSource: event.target.value }))}>
                        <option value="all">All record sources</option>
                        <option value="client_booking">Client booking</option>
                        <option value="legacy_migration">Legacy migration</option>
                        <option value="admin_manual">Admin manual</option>
                      </select>
                    </label>
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

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">{loading && bookings.length === 0 ? "Loading container tracking data..." : `Showing ${bookings.length} tracked bookings`}</div>
        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">Booking / Client</th>
                <th className="px-5 py-4">Container</th>
                <th className="px-5 py-4">Booking Status</th>
                <th className="px-5 py-4">Billing</th>
                <th className="px-5 py-4">Yard Location</th>
                <th className="px-5 py-4">Date In / Out</th>
                <th className="px-5 py-4">Updated</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && bookings.length === 0 && <TableLoadingRow colSpan={8} rows={7} actionColumn label="Loading container tracking data" />}
              {(!loading || bookings.length > 0) && pagination.paginatedItems.map((booking) => (
                <tr key={booking.id} className="align-top transition hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <p className="font-black text-emerald-700">{booking.bookingReference}</p>
                    {booking.recordSource === "legacy_migration" && <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">Legacy Record</span>}
                    <p className="mt-1 font-bold text-slate-800">{booking.clientName || "Client"}</p>
                    <p className="text-xs text-slate-500">{booking.clientEmail || "-"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-black text-slate-950">{booking.containerNumber}</p>
                    <p className="mt-1 text-xs font-bold capitalize text-slate-500">{booking.containerSize}ft • {String(booking.containerType || "").replaceAll("_", " ")}</p>
                    <ContainerClassificationBadges
                      loadStatus={booking.containerLoadStatus}
                      rateType={booking.rateType}
                      className="mt-2"
                      compact
                    />
                    <p className="mt-2 text-xs text-slate-500">{booking.shippingLine || "-"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(booking.status)}`}>{statusLabels[booking.status] || booking.status}</span>
                    {booking.isOverstaying && <span className="mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">Overstaying</span>}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-black text-slate-900">PHP {Number(booking.billingTotal || booking.paymentAmount || 0).toLocaleString()}</p>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(booking.billingStatus)}`}>{billingLabels[booking.billingStatus] || booking.billingStatus}</span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-800">{booking.assignedAreaName || "Not assigned"}</p>
                    <p className="mt-1 text-xs text-slate-500">{booking.assignedBlockName || booking.assignedBlockCode || "-"}</p>
                    <p className="text-xs text-slate-500">Slot: {booking.assignedSlotNumber || "-"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-slate-700"><CalendarDays size={14} className="text-emerald-600" /> {formatDate(booking.inDate || booking.expectedArrivalDate)}</div>
                    <div className="mt-2 flex items-center gap-2 text-slate-500"><CalendarDays size={14} /> {formatDate(booking.outDate)}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(booking.updatedAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <TableCrudActions
                      recordLabel={booking.bookingReference}
                      onView={() => viewBooking(booking)}
                      onEdit={() => editBooking(booking)}
                      onDelete={() => deleteBooking(booking)}
                      deleteDisabled={!canDeleteBooking}
                      deleteLabel={canDeleteBooking ? `Delete ${booking.bookingReference}` : "You do not have permission to delete bookings"}
                      deleting={deletingId === booking.id}
                    >
                      <TableActionButton
                        label={`Open print options for ${booking.bookingReference}`}
                        variant="success"
                        onClick={() => viewBooking(booking)}
                      >
                        <Printer size={17} aria-hidden="true" />
                      </TableActionButton>
                    </TableCrudActions>
                  </td>
                </tr>
              ))}
              {!loading && bookings.length === 0 && (
                <tr><td colSpan="8" className="px-5 py-16 text-center font-semibold text-slate-500">No bookings found for the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(!loading || bookings.length > 0) && <Pagination {...pagination} />}
        </section>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Container Tracking Details</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedBooking.bookingReference}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedBooking.clientName} • {selectedBooking.containerNumber}</p>
                <ContainerClassificationBadges loadStatus={selectedBooking.containerLoadStatus} rateType={selectedBooking.rateType} className="mt-3" />
                {selectedBooking.recordSource === "legacy_migration" && <span className="mt-3 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-700">Legacy / Migrated Record</span>}
              </div>
              <ModalCloseButton onClick={closeBookingView} label="Close booking details" />
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Client Email" value={selectedBooking.clientEmail} />
              <Detail label="Booking Status" value={statusLabels[selectedBooking.status] || selectedBooking.status} />
              <Detail label="Billing Status" value={billingLabels[selectedBooking.billingStatus] || selectedBooking.billingStatus} />
              <Detail label="Container" value={`${selectedBooking.containerSize}ft • ${String(selectedBooking.containerType || "").replaceAll("_", " ")}`} />
              <Detail label="Load Status" value={selectedBooking.containerLoadStatus === "laden" ? "Laden" : selectedBooking.containerLoadStatus === "empty" ? "Empty" : "Unknown"} />
              <Detail label="Rate Classification" value={selectedBooking.rateType === "international" ? "International" : "Local"} />
              <Detail label="Record Source" value={selectedBooking.recordSource === "legacy_migration" ? "Legacy Migration" : selectedBooking.recordSource === "admin_manual" ? "Admin Manual" : "Client Booking"} />
              {selectedBooking.recordSource === "legacy_migration" && <>
                <Detail label="Legacy Registration No." value={selectedBooking.legacyRegistrationNumber} />
                <Detail label="Historical Date Quality" value={selectedBooking.historicalGateInDateType} />
                <Detail label="Original Reference" value={selectedBooking.historicalSourceReference} />
                <Detail label="Billing Start Method" value={selectedBooking.billingStartMethod === "historical_gate_in" ? "Historical Gate-In date" : "Migration date"} />
              </>}
              <Detail label="Shipping Line" value={selectedBooking.shippingLine} />
              <Detail label="Billing Total" value={`PHP ${Number(selectedBooking.billingTotal || selectedBooking.paymentAmount || 0).toLocaleString()}`} />
              <Detail label="Yard Area" value={selectedBooking.assignedAreaName} />
              <Detail label="Block" value={selectedBooking.assignedBlockName || selectedBooking.assignedBlockCode} />
              <Detail label="Slot" value={selectedBooking.assignedSlotNumber} />
              <Detail label="Date In" value={formatDate(selectedBooking.inDate || selectedBooking.expectedArrivalDate)} />
              <Detail label="Date / Time Out" value={formatDate(selectedBooking.outDate)} />
              <Detail label="Gate-Out Schedule" value={selectedBooking.isOverstaying ? "Overstaying" : selectedBooking.gateOutScheduleStatus} />
              <Detail label="Overstay Started" value={formatDate(selectedBooking.gateOutOverstayStartedAt)} />
              <Detail label="Billing Computed As Of" value={formatDate(selectedBooking.billingComputedAt)} />
              <Detail label="Gate-In Pass No." value={selectedBooking.gateInPassNumber} />
              <Detail label="Gate-Out Pass No." value={selectedBooking.gateOutPassNumber} />
              <Detail label="Last Updated" value={formatDate(selectedBooking.updatedAt)} />
            </div>

            <div className="border-t border-slate-200 p-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200">
                      <Printer size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Container Documents</p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">Choose a document to print</h3>
                      <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                        Gate passes become available only after their corresponding approval. The invoice becomes available after billing is computed.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide">
                    <span className={`rounded-full px-3 py-1 ${printAvailability.gateIn ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>Gate-In {printAvailability.gateIn ? "Ready" : "Unavailable"}</span>
                    <span className={`rounded-full px-3 py-1 ${printAvailability.gateOut ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>Gate-Out {printAvailability.gateOut ? "Ready" : "Unavailable"}</span>
                    <span className={`rounded-full px-3 py-1 ${printAvailability.invoice ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>Invoice {printAvailability.invoice ? "Ready" : "Unavailable"}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Print Document</span>
                    <select
                      className="input !bg-white !py-3"
                      value={printDocumentType}
                      onChange={(event) => setPrintDocumentType(event.target.value)}
                    >
                      <option value="gateIn" disabled={!printAvailability.gateIn}>Gate-In Pass{selectedBooking.gateInPassNumber ? ` — ${selectedBooking.gateInPassNumber}` : " — approval required"}</option>
                      <option value="gateOut" disabled={!printAvailability.gateOut}>Gate-Out Pass{selectedBooking.gateOutPassNumber ? ` — ${selectedBooking.gateOutPassNumber}` : " — approval required"}</option>
                      <option value="invoice" disabled={!printAvailability.invoice}>Invoice{printAvailability.invoice ? ` — ${selectedBooking.bookingReference}` : " — billing required"}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn-primary min-h-12 justify-center lg:min-w-[220px]"
                    onClick={printSelectedDocument}
                    disabled={!selectedPrintAvailable}
                  >
                    <Printer size={17} /> Print Selected
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-6">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                      <BadgeDollarSign size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Billing Classification Correction</p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">Update Local or International</h3>
                      <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                        Correct the client&apos;s selection here. Saving automatically rebuilds the billing line items and totals using the active rates for the selected classification.
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black uppercase ${selectedBooking.rateType === "international" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                    Current: {selectedBooking.rateType === "international" ? "International" : "Local"}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Correct Rate Classification</span>
                    <select
                      className="input !bg-white !py-3"
                      value={rateTypeDraft}
                      onChange={(event) => {
                        setRateTypeDraft(event.target.value)
                        setTrackingAlert({ type: "", message: "" })
                      }}
                      disabled={!canEditRateClassification || rateClassificationLocked || savingRateType}
                    >
                      <option value="local">Local</option>
                      <option value="international">International</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn-primary min-h-12 justify-center lg:min-w-[230px]"
                    onClick={updateRateClassification}
                    disabled={!canEditRateClassification || rateClassificationLocked || savingRateType}
                  >
                    {savingRateType ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                    {savingRateType
                      ? "Updating Billing..."
                      : rateTypeDraft === selectedBooking.rateType
                        ? "Recalculate Billing"
                        : "Update & Recalculate"}
                  </button>
                </div>

                {rateClassificationLocked && (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    Classification is locked because payment has already been submitted, is under review, or has been approved. Reject or reverse the payment workflow before changing billing classification.
                  </p>
                )}
                {!canEditRateClassification && (
                  <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
                    Your account can view this classification but does not have Operations edit permission.
                  </p>
                )}
                <div className="mt-4"><Alert type={trackingAlert.type}>{trackingAlert.message}</Alert></div>
              </div>
            </div>
          </div>
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

const Legend = ({ label, classes }) => (
  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}>
    {label}
  </span>
)

const ScheduleSummaryCard = ({ label, value, valueClassName = "text-slate-950" }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
    <div className={`mt-2 text-3xl font-black ${valueClassName}`}>{value}</div>
  </div>
)


export default AdminBookings
