import { useEffect, useMemo, useRef, useState } from "react"
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Truck,
} from "lucide-react"
import Alert from "../../components/Alert"
import Pagination from "../../components/ui/Pagination"
import { useClickOutside } from "../../hooks/useClickOutside"
import { usePagination } from "../../hooks/usePagination"
import { api, getApiError } from "../../lib/api"
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

const billingLabels = {
  unpaid: "Unpaid",
  payment_submitted: "Payment Submitted",
  payment_under_review: "Payment Under Review",
  payment_rejected: "Payment Rejected",
  paid_approved: "Paid / Approved",
}

const statusClass = (status) => {
  if (["stored_in_assigned_area", "completed_gate_out_done", "paid_approved"].includes(status)) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
  if (["approved_area_assigned", "gate_in_approved", "gate_out_approved"].includes(status)) return "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
  if (["rejected", "cancelled", "payment_rejected"].includes(status)) return "bg-red-50 text-red-700 ring-1 ring-red-100"
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
}

const formatDate = (value) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString()
}

const AdminBookings = () => {
  const [bookings, setBookings] = useState([])
  const [summary, setSummary] = useState({})
  const [filters, setFilters] = useState({ status: "all", billingStatus: "all", search: "" })
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState("")
  const [alert, setAlert] = useState({ type: "", message: "" })
  const filterRef = useRef(null)
  const user = useAuthStore((state) => state.user)
  const canDeleteBooking = hasModulePermission(user, "operations", "delete")

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  const loadBookings = async () => {
    try {
      setLoading(true)
      setAlert({ type: "", message: "" })
      const params = new URLSearchParams()
      if (filters.status) params.set("status", filters.status)
      if (filters.billingStatus) params.set("billingStatus", filters.billingStatus)
      if (filters.search.trim()) params.set("search", filters.search.trim())

      const [{ data }, summaryResponse] = await Promise.all([
        api.get(`/admin/bookings?${params.toString()}`),
        api.get("/admin/bookings/summary").catch(() => ({ data: { summary: {} } })),
      ])
      setBookings(data.bookings || [])
      setSummary(summaryResponse.data.summary || {})
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.billingStatus])

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
      await loadBookings()
      setAlert({ type: "success", message: data.message || "Booking deleted successfully." })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setDeletingId("")
    }
  }

  const totals = useMemo(() => ({
    all: summary.total ?? bookings.length,
    active: bookings.filter((item) => !["rejected", "cancelled", "completed_gate_out_done"].includes(item.status)).length,
    completed: summary.completed ?? bookings.filter((item) => item.status === "completed_gate_out_done").length,
  }), [bookings, summary])

  const pagination = usePagination(bookings, 10, `${filters.status}|${filters.billingStatus}|${filters.search}`)

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Operations Monitoring</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Container Tracking</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Track bookings, container movements, yard locations, billing statuses, and remove test records when needed.</p>
          </div>
          <button type="button" onClick={loadBookings} className="btn-secondary shrink-0" disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
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
                    <button type="button" onClick={() => setFilters((current) => ({ ...current, status: "all", billingStatus: "all" }))} className="text-xs font-black text-emerald-700">Reset</button>
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
                {canDeleteBooking && <th className="px-5 py-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && bookings.length === 0 && (
                <tr>
                  <td colSpan={canDeleteBooking ? 8 : 7} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
                      <LoaderCircle size={34} className="animate-spin text-emerald-600" />
                      <div>
                        <p className="font-black text-slate-800">Loading container tracking data</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Please wait while the latest bookings are being retrieved.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {(!loading || bookings.length > 0) && pagination.paginatedItems.map((booking) => (
                <tr key={booking.id} className="align-top transition hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <p className="font-black text-emerald-700">{booking.bookingReference}</p>
                    <p className="mt-1 font-bold text-slate-800">{booking.clientName || "Client"}</p>
                    <p className="text-xs text-slate-500">{booking.clientEmail || "-"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-black text-slate-950">{booking.containerNumber}</p>
                    <p className="mt-1 text-xs font-bold capitalize text-slate-500">{booking.containerSize}ft • {String(booking.containerType || "").replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">{booking.shippingLine || "-"}</p>
                  </td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusClass(booking.status)}`}>{statusLabels[booking.status] || booking.status}</span></td>
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
                  {canDeleteBooking && (
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => deleteBooking(booking)}
                        disabled={deletingId === booking.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === booking.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        {deletingId === booking.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && bookings.length === 0 && (
                <tr><td colSpan={canDeleteBooking ? 8 : 7} className="px-5 py-16 text-center font-semibold text-slate-500">No bookings found for the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(!loading || bookings.length > 0) && <Pagination {...pagination} />}
      </section>
    </div>
  )
}

export default AdminBookings
