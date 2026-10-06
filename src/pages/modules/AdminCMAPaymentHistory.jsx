import { useEffect, useMemo, useState } from "react"
import { History, RefreshCw, Search } from "lucide-react"
import Alert from "../../components/Alert"
import { api, getApiError } from "../../lib/api"

const money = (value) => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatDate = (value) => value ? new Date(value).toLocaleString() : "-"

const AdminCMAPaymentHistory = () => {
  const [payments, setPayments] = useState([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState({ type: "", message: "" })

  const loadPayments = async () => {
    try {
      setLoading(true)
      const { data } = await api.get("/admin/cma/payments/history", { params: search.trim() ? { search: search.trim() } : {} })
      setPayments(data.payments || [])
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally { setLoading(false) }
  }

  useEffect(() => {
    const timer = setTimeout(loadPayments, 180)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const totalPaid = useMemo(() => payments.reduce((sum, item) => sum + Number(item.amount || 0), 0), [payments])
  const uniqueCmas = useMemo(() => new Set(payments.map((item) => item.cmaClientId).filter(Boolean)).size, [payments])

  return (
    <div className="space-y-6">
      <section className="card p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-sm font-black uppercase tracking-wide text-emerald-700">CMA Special Client</div><h2 className="mt-1 text-2xl font-black text-slate-950">CMA Payment History</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">A separate payment ledger for CMA charges. These payment records are not mixed with the trucker client’s normal documentation-fee payment history.</p></div><button type="button" className="btn-secondary self-start" onClick={loadPayments} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">CMA Payments</p><p className="mt-2 text-3xl font-black text-emerald-900">{payments.length}</p></div><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-blue-700">Total Paid</p><p className="mt-2 text-2xl font-black text-blue-900">{money(totalPaid)}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-slate-600">CMA Accounts</p><p className="mt-2 text-3xl font-black text-slate-950">{uniqueCmas}</p></div></div><div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div></section>
      <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><History size={19} /> CMA Payment Ledger</h3><p className="text-sm text-slate-500">Includes CMA client, trucker client, container, charge basis, amount, date and references.</p></div><div className="relative" data-field-control><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !pl-9 sm:w-[340px]" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search CMA, trucker, container or reference" /></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">CMA Client</th><th className="px-4 py-3">Trucker Client</th><th className="px-4 py-3">Container / Booking</th><th className="px-4 py-3">Charges</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Billing Reference</th></tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">Loading CMA payment history...</td></tr> : payments.length === 0 ? <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">No CMA payment records found.</td></tr> : payments.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><div className="font-black text-slate-900">{item.cmaClientName || "-"}</div><div className="font-mono text-xs text-slate-500">{item.cmaClientCode || ""}</div></td><td className="px-4 py-4"><div className="font-bold text-slate-800">{item.truckerCompanyName || item.truckerClientName || "-"}</div><div className="text-xs text-slate-500">{item.truckerClientName || ""}</div></td><td className="px-4 py-4"><div className="font-mono font-bold text-slate-700">{item.containerNumber || "-"}</div><div className="text-xs text-slate-500">{item.bookingNumber || "-"}</div></td><td className="px-4 py-4"><div className="max-w-[280px] space-y-1">{(item.charges || []).map((charge) => <div key={charge.id || `${charge.chargeCode}-${charge.serviceDate}`} className="flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{charge.description}</span><span className="whitespace-nowrap font-bold text-slate-800">{money(charge.amount)}</span></div>)}</div></td><td className="px-4 py-4 font-black text-emerald-700">{money(item.amount)}</td><td className="px-4 py-4"><div className="font-bold text-slate-800">{formatDate(item.paymentDate)}</div><div className="text-xs text-slate-500">{item.paymentType || "Payment"}</div><div className="mt-1 font-mono text-xs text-slate-600">{item.paymentReferenceNumber}</div></td><td className="px-4 py-4"><div className="font-mono text-xs font-bold text-slate-700">{item.billingReference}</div><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${item.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{String(item.paymentStatus || "").replaceAll("_", " ")}</span></td></tr>)}
      </tbody></table></div></section>
    </div>
  )
}

export default AdminCMAPaymentHistory
