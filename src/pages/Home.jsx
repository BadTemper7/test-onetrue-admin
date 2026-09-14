import { useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiPackage,
  FiRefreshCw,
  FiShield,
  FiTruck,
  FiUsers,
} from "react-icons/fi"
import { useAuthStore } from "../stores/authStore"
import { useBookingStore } from "../stores/bookingStore"
import { companyOverview, services } from "../constants/companyProfile"

const statusLabels = {
  pending_admin_approval: "Pending admin approval",
  approved_area_assigned: "Approved and assigned",
  rejected: "Rejected",
  gate_in_approved: "Gate-in approved",
  stored_in_assigned_area: "Stored in yard",
  gate_out_requested: "Gate-out requested",
  gate_out_approved: "Gate-out approved",
  gate_out_reversal_requested: "Gate-out reversal requested",
  completed_gate_out_done: "Completed",
  cancelled: "Cancelled",
}

const CompanyIntro = ({ compact = false }) => {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-emerald-950 text-white shadow-xl">
      <img src="/images/company/yard-overview.webp" alt="One True Logistics container yard in Manila" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/90 to-emerald-950/30" />
      <div className={`relative max-w-3xl px-6 sm:px-9 ${compact ? "py-9" : "py-12 lg:py-16"}`}>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] backdrop-blur-sm">
          <FiMapPin /> Port Area, Manila
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-amber-300">One True Logistics Inc.</p>
        <h1 className={`mt-3 font-black tracking-tight ${compact ? "text-3xl" : "text-4xl sm:text-5xl"}`}>Your goods, our priority.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 sm:text-base">{companyOverview.summary}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate("/about")} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-emerald-950 shadow-lg transition hover:-translate-y-0.5">
            Learn about OTLI <FiArrowRight />
          </button>
          <button type="button" onClick={() => navigate("/services")} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/15">
            Explore services
          </button>
        </div>
      </div>
    </section>
  )
}

const Home = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { bookings, loading, error, fetchBookings } = useBookingStore()
  const isVerified = ["active", "verified"].includes(user?.status)

  useEffect(() => {
    if (isVerified) fetchBookings().catch(() => {})
  }, [fetchBookings, isVerified])

  useEffect(() => {
    if (!isVerified) return undefined
    const refresh = () => fetchBookings().catch(() => {})
    window.addEventListener("otli:realtime", refresh)
    return () => window.removeEventListener("otli:realtime", refresh)
  }, [fetchBookings, isVerified])

  const stats = useMemo(() => {
    const pending = bookings.filter((booking) => ["pending_admin_approval", "approved_area_assigned"].includes(booking.status)).length
    const inYard = bookings.filter((booking) => ["gate_in_approved", "stored_in_assigned_area", "gate_out_requested", "gate_out_approved", "gate_out_reversal_requested"].includes(booking.status)).length
    const completed = bookings.filter((booking) => booking.status === "completed_gate_out_done").length

    return [
      { label: "Total bookings", value: bookings.length, icon: FiPackage, className: "bg-emerald-700" },
      { label: "Pending review", value: pending, icon: FiClock, className: "bg-amber-500" },
      { label: "Containers in yard", value: inYard, icon: FiTruck, className: "bg-slate-800" },
      { label: "Completed", value: completed, icon: FiCheckCircle, className: "bg-emerald-600" },
    ]
  }, [bookings])

  if (!isVerified) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <CompanyIntro />
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-4">
            <FiAlertCircle className="mt-1 h-6 w-6 shrink-0 text-amber-600" />
            <div>
              <h2 className="text-lg font-black text-amber-950">Welcome, {user?.name || "Client"}</h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">Your registration is saved. Admin verification is required before you can submit container bookings. Current status: <strong>{user?.status || "pending"}</strong>.</p>
              <button type="button" onClick={() => navigate("/profile")} className="mt-4 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white hover:bg-amber-700">View account status</button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <CompanyIntro compact />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Client dashboard</p>
          <h2 className="mt-1 text-3xl font-black text-slate-900">Welcome back, {user?.name || "Client"}</h2>
          <p className="mt-1 text-sm text-slate-500">Monitor container bookings and the latest status changes.</p>
        </div>
        <button type="button" onClick={() => fetchBookings().catch(() => {})} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60">
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold text-slate-500">{stat.label}</p><p className="mt-2 text-3xl font-black text-slate-900">{stat.value}</p></div>
              <div className={`${stat.className} rounded-xl p-3 text-white`}><stat.icon className="h-6 w-6" /></div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 className="font-black text-slate-900">Recent bookings</h2><p className="text-xs text-slate-500">Latest container activity from your account</p></div>
            <button type="button" onClick={() => navigate("/booking-history")} className="text-sm font-black text-emerald-700 hover:text-emerald-800">View all</button>
          </div>
          <div className="divide-y divide-slate-100">
            {bookings.slice(0, 6).map((booking) => (
              <button type="button" key={booking.id} onClick={() => navigate("/booking-history")} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><FiPackage /></div>
                <div className="min-w-0 flex-1"><p className="truncate font-black text-slate-800">{booking.bookingReference}</p><p className="truncate text-sm text-slate-500">{booking.containerNumber} • {booking.shippingLine}</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{statusLabels[booking.status] || booking.status}</span>
              </button>
            ))}
            {!loading && bookings.length === 0 && <div className="px-5 py-12 text-center text-sm text-slate-500">No bookings yet.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">Quick actions</h2>
          <div className="mt-4 space-y-3">
            <button type="button" onClick={() => navigate("/booking")} className="flex w-full items-center gap-3 rounded-xl bg-emerald-700 p-4 text-left text-white hover:bg-emerald-800">
              <FiPackage className="h-5 w-5" /><span><strong className="block">Create booking</strong><small className="text-emerald-100">Submit pre-advice for review</small></span>
            </button>
            <button type="button" onClick={() => navigate("/booking-history")} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left text-slate-700 hover:bg-slate-50">
              <FiClock className="h-5 w-5 text-emerald-700" /><span><strong className="block">Booking history</strong><small className="text-slate-500">Track movement and billing</small></span>
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Depot capabilities</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">Integrated solutions for every container movement</h2>
            <p className="mt-3 leading-7 text-slate-600">The portal connects booking, gate processing, storage, inventory, payment verification, and final release in one traceable workflow.</p>
          </div>
          <button type="button" onClick={() => navigate("/services")} className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">View all services <FiArrowRight /></button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: FiTruck, title: services[3], text: "Safe handling supported by modern equipment and experienced operators." },
            { icon: FiShield, title: services[2], text: "Secure storage for empty and laden containers with inventory visibility." },
            { icon: FiUsers, title: "Customer-focused operations", text: "Clear status information and coordinated support throughout the process." },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl bg-slate-50 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><item.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-black text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-[2rem] bg-slate-950 p-7 text-white sm:p-9 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Need assistance?</p>
          <h2 className="mt-2 text-2xl font-black">Talk to the One True Logistics team</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Get help with bookings, billing, gate-out requests, container release, or general depot coordination.</p>
        </div>
        <button type="button" onClick={() => navigate("/contact")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600">Contact information <FiArrowRight /></button>
      </section>
    </div>
  )
}

export default Home
