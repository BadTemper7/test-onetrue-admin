import { useEffect, useMemo, useState } from "react"
import { Banknote, Eye, ReceiptText, RefreshCw, Search, WalletCards, X } from "lucide-react"
import Alert from "../../components/Alert"
import { api, getApiError } from "../../lib/api"

const money = (value) => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateTime = (value) => value ? new Date(value).toLocaleString() : "-"
const today = () => new Date().toISOString().slice(0, 10)

const StatusBadge = ({ status }) => {
  const map = {
    paid: "bg-emerald-100 text-emerald-700",
    partial: "bg-amber-100 text-amber-700",
    unpaid: "bg-red-100 text-red-700",
  }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${map[status] || "bg-slate-100 text-slate-600"}`}>{String(status || "unpaid").replaceAll("_", " ")}</span>
}

const AdminCMABilling = () => {
  const [billings, setBillings] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [cmaClientId, setCmaClientId] = useState("all")
  const [selected, setSelected] = useState(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [payment, setPayment] = useState({ amount: "", paymentDate: today(), referenceNumber: "", paymentType: "Bank Transfer", remarks: "" })
  const [alert, setAlert] = useState({ type: "", message: "" })

  const loadData = async () => {
    try {
      setLoading(true)
      const params = { limit: 200 }
      if (status !== "all") params.paymentStatus = status
      if (cmaClientId !== "all") params.cmaClientId = cmaClientId
      if (search.trim()) params.search = search.trim()
      const [billingResponse, clientResponse] = await Promise.all([
        api.get("/admin/cma/billings", { params }),
        api.get("/admin/cma/clients"),
      ])
      setBillings(billingResponse.data.cmaBillings || [])
      setClients(clientResponse.data.cmaClients || [])
      if (selected) {
        const refreshed = (billingResponse.data.cmaBillings || []).find((item) => item.id === selected.id)
        if (refreshed) setSelected(refreshed)
      }
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally { setLoading(false) }
  }

  useEffect(() => {
    const timer = setTimeout(loadData, 180)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, cmaClientId])

  const totals = useMemo(() => billings.reduce((sum, item) => ({
    total: sum.total + Number(item.totalAmount || 0),
    paid: sum.paid + Number(item.paidAmount || 0),
    balance: sum.balance + Number(item.balanceDue || 0),
  }), { total: 0, paid: 0, balance: 0 }), [billings])

  const viewBilling = async (item) => {
    try {
      const { data } = await api.get(`/admin/cma/billings/${item.id}`)
      setSelected(data.cmaBilling || item)
    } catch (error) { setAlert({ type: "error", message: getApiError(error) }) }
  }

  const recompute = async (item) => {
    try {
      setBusyId(item.id)
      const { data } = await api.post(`/admin/cma/billings/${item.id}/recompute`)
      setAlert({ type: "success", message: data.message || "CMA billing recomputed." })
      setSelected(data.cmaBilling || selected)
      await loadData()
    } catch (error) { setAlert({ type: "error", message: getApiError(error) }) }
    finally { setBusyId("") }
  }

  const openPayment = (item) => {
    setSelected(item)
    setPayment({ amount: item.balanceDue > 0 ? String(item.balanceDue) : "", paymentDate: today(), referenceNumber: "", paymentType: "Bank Transfer", remarks: "" })
    setPaymentOpen(true)
  }

  const recordPayment = async (event) => {
    event.preventDefault()
    if (!selected) return
    try {
      setBusyId(selected.id)
      const { data } = await api.post(`/admin/cma/billings/${selected.id}/payments`, { ...payment, amount: Number(payment.amount) })
      setAlert({ type: "success", message: data.message || "CMA payment recorded." })
      setSelected(data.cmaBilling || selected)
      setPaymentOpen(false)
      await loadData()
    } catch (error) { setAlert({ type: "error", message: getApiError(error) }) }
    finally { setBusyId("") }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-sm font-black uppercase tracking-wide text-emerald-700">CMA Special Client</div><h2 className="mt-1 text-2xl font-black text-slate-950">CMA Billing</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Separate CMA billing for LOLO, storage, VAT, and other yard charges. These amounts never appear as amounts payable by the trucker client.</p></div><button type="button" className="btn-secondary self-start" onClick={loadData} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-blue-700">CMA Billed</p><div className="mt-2 flex items-center justify-between"><p className="text-2xl font-black text-blue-900">{money(totals.total)}</p><ReceiptText className="text-blue-700" /></div></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">CMA Paid</p><div className="mt-2 flex items-center justify-between"><p className="text-2xl font-black text-emerald-900">{money(totals.paid)}</p><Banknote className="text-emerald-700" /></div></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-amber-700">Balance Due</p><div className="mt-2 flex items-center justify-between"><p className="text-2xl font-black text-amber-900">{money(totals.balance)}</p><WalletCards className="text-amber-700" /></div></div></div>
        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      <section className="card overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_190px_230px]"><div className="relative" data-field-control><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search billing ref, booking, container, CMA or trucker" /></div><select className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All payment statuses</option><option value="unpaid">Unpaid</option><option value="partial">Partially paid</option><option value="paid">Paid</option></select><select className="input" value={cmaClientId} onChange={(event) => setCmaClientId(event.target.value)}><option value="all">All CMA Clients</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Billing / CMA</th><th className="px-4 py-3">Trucker / Container</th><th className="px-4 py-3">Charges</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Paid / Balance</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">Loading CMA billing...</td></tr> : billings.length === 0 ? <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">No CMA billing records found. Records are generated when CMA-tagged containers reach gate-in/gate-out billing stages.</td></tr> : billings.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><div className="font-mono text-xs font-bold text-slate-500">{item.billingReference}</div><div className="mt-1 font-black text-slate-900">{item.cmaClientName || "CMA"}</div><div className="text-xs text-slate-500">{item.cmaClientCode}</div></td><td className="px-4 py-4"><div className="font-bold text-slate-800">{item.truckerCompanyName || item.truckerClientName || "-"}</div><div className="mt-1 font-mono text-xs text-slate-600">{item.containerNumber || "-"}</div><div className="text-xs text-slate-500">{item.bookingNumber || item.bookingReference || "-"}</div></td><td className="px-4 py-4 text-xs text-slate-600"><div>LOLO: <b>{money(item.loloFee)}</b></div><div>Storage: <b>{money(item.storageFee)}</b></div><div>Other: <b>{money(item.otherCharges)}</b></div><div>VAT: <b>{money(item.vatAmount)}</b></div></td><td className="px-4 py-4 font-black text-slate-950">{money(item.totalAmount)}</td><td className="px-4 py-4"><div className="font-bold text-emerald-700">{money(item.paidAmount)}</div><div className="text-xs font-bold text-amber-700">Due {money(item.balanceDue)}</div></td><td className="px-4 py-4"><StatusBadge status={item.paymentStatus} /></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => viewBilling(item)} title="View"><Eye size={15} /></button>{item.balanceDue > 0 && <button type="button" className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50" onClick={() => openPayment(item)}>Record Payment</button>}</div></td></tr>)}
        </tbody></table></div>
      </section>

      {selected && !paymentOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4"><div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 p-5"><div><div className="font-mono text-xs font-bold text-emerald-700">{selected.billingReference}</div><h3 className="mt-1 text-xl font-black text-slate-950">CMA Billing Detail</h3><p className="text-sm text-slate-500">{selected.cmaClientName} · {selected.truckerCompanyName || selected.truckerClientName} · {selected.containerNumber}</p></div><button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSelected(null)}><X size={20} /></button></div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1.5fr_1fr]"><div><h4 className="font-black text-slate-900">Charge Breakdown</h4><div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Charge</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{(selected.lineItems || []).map((line) => <tr key={line.id || `${line.chargeCode}-${line.serviceDate}`}><td className="px-3 py-3"><div className="font-bold text-slate-800">{line.description}</div><div className="text-xs text-slate-500">{line.chargeType} · {line.chargeCode || "-"}{line.serviceDate ? ` · ${new Date(line.serviceDate).toLocaleDateString()}` : ""}</div></td><td className="px-3 py-3">{line.quantity}</td><td className="px-3 py-3">{money(line.rateAmount)}</td><td className="px-3 py-3 text-right font-black">{money(line.amount)}</td></tr>)}{!(selected.lineItems || []).length && <tr><td colSpan="4" className="px-3 py-8 text-center text-slate-500">No CMA charges computed yet.</td></tr>}</tbody></table></div><button type="button" className="btn-secondary mt-4" onClick={() => recompute(selected)} disabled={busyId === selected.id}><RefreshCw size={15} className={busyId === selected.id ? "animate-spin" : ""} /> Recompute Current CMA Charges</button></div>
        <div className="space-y-4"><div className="rounded-2xl border border-slate-200 p-4"><h4 className="font-black text-slate-900">Billing Summary</h4><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-bold">{money(selected.subtotal)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">VAT ({Number(selected.vatRate || 0) * 100}%)</dt><dd className="font-bold">{money(selected.vatAmount)}</dd></div><div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-black">Total</dt><dd className="font-black">{money(selected.totalAmount)}</dd></div><div className="flex justify-between"><dt className="text-emerald-700">Paid</dt><dd className="font-bold text-emerald-700">{money(selected.paidAmount)}</dd></div><div className="flex justify-between"><dt className="text-amber-700">Balance</dt><dd className="font-black text-amber-700">{money(selected.balanceDue)}</dd></div></dl><div className="mt-3"><StatusBadge status={selected.paymentStatus} /></div>{selected.balanceDue > 0 && <button type="button" className="btn-primary mt-4 w-full justify-center" onClick={() => openPayment(selected)}><Banknote size={16} /> Record CMA Payment</button>}</div>
        <div className="rounded-2xl border border-slate-200 p-4"><h4 className="font-black text-slate-900">Payment History</h4><div className="mt-3 space-y-3">{(selected.payments || []).map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><span className="font-black text-slate-900">{money(item.amount)}</span><span className="text-xs text-slate-500">{dateTime(item.paymentDate)}</span></div><div className="mt-1 font-mono text-xs text-slate-600">{item.referenceNumber}</div><div className="text-xs text-slate-500">{item.paymentType || "Payment"}</div></div>)}{!(selected.payments || []).length && <p className="text-sm text-slate-500">No CMA payment recorded yet.</p>}</div></div></div></div>
      </div></div>}

      {paymentOpen && selected && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl"><form onSubmit={recordPayment}><div className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-black text-slate-950">Record CMA Payment</h3><p className="mt-1 text-sm text-slate-500">Balance due: <b>{money(selected.balanceDue)}</b></p></div><button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={() => setPaymentOpen(false)}><X size={20} /></button></div><div className="space-y-4 p-5"><label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Amount *</span><input type="number" min="0.01" max={selected.balanceDue} step="0.01" className="input" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required /></label><label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Payment Date *</span><input type="date" className="input" value={payment.paymentDate} onChange={(event) => setPayment((current) => ({ ...current, paymentDate: event.target.value }))} required /></label><label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Payment Reference Number *</span><input className="input" value={payment.referenceNumber} onChange={(event) => setPayment((current) => ({ ...current, referenceNumber: event.target.value }))} required placeholder="Bank / receipt / OR reference" /></label><label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Payment Type</span><input className="input" value={payment.paymentType} onChange={(event) => setPayment((current) => ({ ...current, paymentType: event.target.value }))} /></label><label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Remarks</span><textarea className="input min-h-20" value={payment.remarks} onChange={(event) => setPayment((current) => ({ ...current, remarks: event.target.value }))} /></label></div><div className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" className="btn-secondary" onClick={() => setPaymentOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={busyId === selected.id}>{busyId === selected.id ? "Saving..." : "Record Payment"}</button></div></form></div></div>}
    </div>
  )
}

export default AdminCMABilling
