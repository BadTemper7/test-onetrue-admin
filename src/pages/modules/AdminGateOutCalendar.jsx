import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react"
import Alert from "../../components/Alert"
import ModernDateInput from "../../components/ModernDateInput"
import { api, getApiError } from "../../lib/api"
import TableLoadingRow from "../../components/ui/TableLoadingRow"

const statusLabels = {
  stored_in_assigned_area: "Stored in Assigned Area",
  gate_out_requested: "Gate-Out Requested",
  gate_out_approved: "Gate-Out Approved",
  gate_out_reversal_requested: "Gate-Out Reversal Requested",
  completed_gate_out_done: "Completed / Gate-Out Done",
}

const statusClass = (status) => {
  if (status === "completed_gate_out_done") return "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
  if (status === "gate_out_approved") return "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
  if (status === "gate_out_reversal_requested") return "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
  if (status === "gate_out_requested") return "bg-violet-100 text-violet-700 ring-1 ring-violet-200"
  return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
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
  const date = value ? new Date(`${value}T00:00:00`) : null
  if (!date || Number.isNaN(date.getTime())) return "Select a schedule date"
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

const formatCalendarHour = (hour) => {
  const date = new Date(2000, 0, 1, Number(hour) || 0, 0, 0)
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

const AdminGateOutCalendar = () => {
  const navigate = useNavigate()
  const [scheduleDate, setScheduleDate] = useState(() => formatDateValue(new Date()))
  const [rows, setRows] = useState([])
  const [maxSlots, setMaxSlots] = useState(3)
  const [summary, setSummary] = useState({ total: 0, pending: 0, approved: 0, active: 0, completed: 0, other: 0 })
  const [overflowCount, setOverflowCount] = useState(0)
  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState("all")
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState({ type: "", message: "" })

  const loadClients = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/bookings/clients")
      setClients(data.clients || [])
    } catch {
      setClients([])
    }
  }, [])

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true)
      setAlert({ type: "", message: "" })
      const params = new URLSearchParams({
        date: scheduleDate,
        timezoneOffset: String(new Date().getTimezoneOffset()),
        stage: "gate_out",
      })
      if (clientId !== "all") params.set("clientId", clientId)

      const { data } = await api.get(`/admin/bookings/calendar?${params.toString()}`)
      setRows(data.rows || [])
      setMaxSlots(Number(data.maxSlotsPerHour) || 3)
      setSummary(data.summary || { total: 0, pending: 0, approved: 0, active: 0, completed: 0, other: 0 })
      setOverflowCount(Number(data.overflowCount) || 0)
    } catch (error) {
      setRows([])
      setMaxSlots(3)
      setSummary({ total: 0, pending: 0, approved: 0, active: 0, completed: 0, other: 0 })
      setOverflowCount(0)
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoading(false)
    }
  }, [clientId, scheduleDate])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  useEffect(() => {
    loadCalendar()
  }, [loadCalendar])

  const totalCapacity = maxSlots * 24
  const usedSlots = Number(summary.total || 0)
  const availableSlots = Math.max(totalCapacity - usedSlots, 0)
  const selectedClient = useMemo(
    () => clients.find((client) => String(client.id) === String(clientId)) || null,
    [clientId, clients],
  )

  const openGateOutRecord = (booking) => {
    navigate("/billing/gate-out", {
      state: { bookingId: booking.id, openMode: "view" },
    })
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700">
              <CalendarDays size={16} /> Gate-Out Calendar
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Gate-Out Booking Calendar</h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
              Review Gate-Out appointments in a dedicated 24-hour calendar. Each hour accepts a maximum of {maxSlots} containers. Pullout / Gate-Out requests should be submitted at least 2 days in advance.
            </p>
          </div>
          <button type="button" onClick={loadCalendar} className="btn-secondary shrink-0" disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Scheduled</p><p className="mt-2 text-3xl font-black text-slate-950">{usedSlots}</p></div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><Truck size={20} /></div>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Available Slots</p><p className="mt-2 text-3xl font-black text-emerald-800">{availableSlots}</p></div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm"><Clock3 size={20} /></div>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Hourly Capacity</p><p className="mt-2 text-3xl font-black text-blue-800">{maxSlots}</p></div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm"><CalendarDays size={20} /></div>
            </div>
          </div>
          <div className={`rounded-2xl border p-5 ${overflowCount > 0 ? "border-red-100 bg-red-50" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center justify-between gap-3">
              <div><p className={`text-xs font-black uppercase tracking-wide ${overflowCount > 0 ? "text-red-700" : "text-slate-500"}`}>Over Capacity</p><p className={`mt-2 text-3xl font-black ${overflowCount > 0 ? "text-red-800" : "text-slate-950"}`}>{overflowCount}</p></div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><Users size={20} /></div>
            </div>
          </div>
        </div>

        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Release Schedule</div>
              <h2 className="mt-1 text-xl font-black text-slate-950">{formatScheduleHeading(scheduleDate)}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {selectedClient ? `Showing Gate-Out appointments for ${selectedClient.name}.` : "Showing Gate-Out appointments for all clients."} Select a booked slot to open its Gate-Out record.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block min-w-[240px]">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Client Filter</span>
                <select className="input bg-white" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  <option value="all">All Clients</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 px-1">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                <CalendarDays size={19} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Schedule Date</p>
                <p className="mt-0.5 truncate text-base font-black text-slate-950">{formatScheduleHeading(scheduleDate)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary !px-3" onClick={() => setScheduleDate((current) => shiftDateValue(current, -1))} aria-label="Previous day">
                <ChevronLeft size={17} />
              </button>
              <div className="min-w-[190px]">
                <ModernDateInput type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} clearable={false} variant="compact" />
              </div>
              <button type="button" className="btn-secondary !px-3" onClick={() => setScheduleDate((current) => shiftDateValue(current, 1))} aria-label="Next day">
                <ChevronRight size={17} />
              </button>
              <button type="button" className="btn-secondary" onClick={() => setScheduleDate(formatDateValue(new Date()))}>Today</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                {Array.from({ length: maxSlots }, (_, index) => <th key={index} className="px-4 py-3">Slot {index + 1}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 && <TableLoadingRow colSpan={maxSlots + 1} rows={6} label="Loading gate-out calendar" />}
              {rows.map((row) => (
                <tr key={row.hour} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-black text-slate-700">{formatCalendarHour(row.hour)}</td>
                  {(row.slots || []).map((slot) => (
                    <td key={slot.slotNumber} className="px-4 py-3">
                      {slot.booking ? (
                        <button
                          type="button"
                          onClick={() => openGateOutRecord(slot.booking)}
                          className="w-full rounded-2xl border border-blue-200 bg-blue-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-100"
                        >
                          <p className="font-black text-blue-800">{slot.booking.containerNumber}</p>
                          <p className="mt-1 text-xs font-bold text-slate-700">{slot.booking.clientName || "Client"}</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">{slot.booking.bookingReference}</p>
                          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${statusClass(slot.booking.status)}`}>
                            {statusLabels[slot.booking.status] || slot.booking.status}
                          </span>
                        </button>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs font-black text-slate-400">Available</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={maxSlots + 1} className="px-4 py-12 text-center font-semibold text-slate-500">No Gate-Out calendar rows available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default AdminGateOutCalendar
