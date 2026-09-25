import { useEffect, useMemo, useRef, useState } from "react"
import { Pencil, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import Pagination from "../../components/ui/Pagination"
import TableLoadingRow from "../../components/ui/TableLoadingRow"
import { api, getApiError } from "../../lib/api"

const todayManila = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}
const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rateLabel = (rate) => `${rate.description} · ${rate.containerSize === "all" ? "All sizes" : `${rate.containerSize}ft`} · ${rate.loadStatus === "laden" ? "Loaded" : rate.loadStatus === "empty" ? "Empty" : "All loads"} · ${rate.rateType === "international" ? "International" : "Local"}`
const emptyForm = () => ({ name: "", clientIds: [], effectiveDate: todayManila(), notes: "", transactions: [] })

export default function AdminSpecialRates({ generalRates = [] }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [alert, setAlert] = useState({ type: "", message: "" })
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [clients, setClients] = useState([])
  const [clientSearch, setClientSearch] = useState("")
  const requestRef = useRef(null)
  const clientRequestRef = useRef(null)

  const selectableRates = useMemo(() => generalRates.filter((rate) => rate.billingScope !== "display_only"), [generalRates])

  const loadItems = async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    try {
      setLoading(true)
      const { data } = await api.get("/admin/special-rates", { params: { page, limit: pageSize, search: search.trim() }, signal: controller.signal })
      setItems(data.specialRates || [])
      setMeta(data.pagination || { total: 0, totalPages: 1 })
    } catch (error) {
      if (error?.code !== "ERR_CANCELED") setAlert({ type: "error", message: getApiError(error) })
    } finally {
      if (requestRef.current === controller) setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadItems, 250)
    return () => clearTimeout(timer)
  }, [page, pageSize, search])

  useEffect(() => { setPage(1) }, [search, pageSize])

  const loadClients = async (term = "") => {
    clientRequestRef.current?.abort()
    const controller = new AbortController()
    clientRequestRef.current = controller
    try {
      const { data } = await api.get("/admin/special-rates/clients", { params: { page: 1, limit: 100, search: term }, signal: controller.signal })
      setClients(data.clients || [])
    } catch (error) {
      if (error?.code !== "ERR_CANCELED") setAlert({ type: "error", message: getApiError(error) })
    }
  }

  useEffect(() => {
    if (!modalOpen) return
    const timer = setTimeout(() => loadClients(clientSearch.trim()), 200)
    return () => clearTimeout(timer)
  }, [modalOpen, clientSearch])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setClientSearch("")
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      name: item.name || "",
      clientIds: (item.clients || []).map((client) => client.id),
      effectiveDate: String(item.effectiveDate || "").slice(0, 10),
      notes: item.notes || "",
      transactions: (item.transactions || []).map((row) => ({ billingRateId: row.billingRateId, specialRateAmount: String(row.specialRateAmount) })),
    })
    setClients((current) => {
      const map = new Map(current.map((client) => [client.id, client]))
      for (const client of item.clients || []) map.set(client.id, client)
      return [...map.values()]
    })
    setClientSearch("")
    setModalOpen(true)
  }

  const toggleClient = (id) => setForm((current) => ({ ...current, clientIds: current.clientIds.includes(id) ? current.clientIds.filter((value) => value !== id) : [...current.clientIds, id] }))
  const toggleTransaction = (rate) => setForm((current) => {
    const exists = current.transactions.some((row) => row.billingRateId === rate.id)
    return { ...current, transactions: exists ? current.transactions.filter((row) => row.billingRateId !== rate.id) : [...current.transactions, { billingRateId: rate.id, specialRateAmount: String(rate.rateAmount ?? "") }] }
  })
  const setTransactionAmount = (id, value) => setForm((current) => ({ ...current, transactions: current.transactions.map((row) => row.billingRateId === id ? { ...row, specialRateAmount: value } : row) }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.clientIds.length || !form.transactions.length || !form.effectiveDate) {
      setAlert({ type: "error", message: "Complete the Special Rate name, clients, transactions, and Effectivity Date." })
      return
    }
    try {
      setSaving(true)
      const payload = { name: form.name.trim(), clients: form.clientIds, transactions: form.transactions.map((row) => ({ billingRateId: row.billingRateId, specialRateAmount: Number(row.specialRateAmount) })), effectiveDate: `${form.effectiveDate}T00:00:00+08:00`, notes: form.notes.trim(), status: "active" }
      const { data } = editing ? await api.patch(`/admin/special-rates/${editing.id}`, payload) : await api.post("/admin/special-rates", payload)
      setAlert({ type: "success", message: data.message })
      setModalOpen(false)
      await loadItems()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally { setSaving(false) }
  }

  const deactivate = async (item) => {
    if (!window.confirm(`Deactivate ${item.name}? Historical transactions will remain unchanged.`)) return
    try {
      const { data } = await api.delete(`/admin/special-rates/${item.id}`)
      setAlert({ type: "success", message: data.message })
      await loadItems()
    } catch (error) { setAlert({ type: "error", message: getApiError(error) }) }
  }

  const totalPages = Math.max(meta.totalPages || 1, 1)
  const currentPage = Math.min(page, totalPages)
  const pagination = {
    page: currentPage,
    setPage,
    pageSize,
    setPageSize: (value) => setPageSize(Number(value)),
    totalItems: meta.total || 0,
    totalPages,
    startItem: meta.total ? ((currentPage - 1) * pageSize) + 1 : 0,
    endItem: Math.min(currentPage * pageSize, meta.total || 0),
    pageSizeOptions: [10, 20, 50, 100],
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 p-5">
        <Alert type={alert.type}>{alert.message}</Alert>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-700">Client Pricing</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Special Rates</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Assign one setup to multiple clients and multiple transactions. Matching Special Rates automatically take priority over General Rates from the Effectivity Date.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={loadItems} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
            <button type="button" className="btn-primary" onClick={openCreate}><Plus size={17} /> Add Special Rate</button>
          </div>
        </div>
        <div className="mt-5 relative max-w-xl">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search special rate, client, or transaction" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Special Rate</th><th className="px-5 py-4">Clients</th><th className="px-5 py-4">Transactions</th><th className="px-5 py-4">Effectivity</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <TableLoadingRow colSpan={6} rows={5} actionColumn label="Loading special rates" />}
            {!loading && items.map((item) => (
              <tr key={item.id} className="align-top hover:bg-slate-50/70">
                <td className="px-5 py-4"><p className="font-black text-slate-950">{item.name}</p>{item.notes && <p className="mt-1 max-w-xs text-xs text-slate-500">{item.notes}</p>}</td>
                <td className="px-5 py-4"><div className="flex items-center gap-2 font-bold text-slate-700"><Users size={15} /> {item.clients.length} client{item.clients.length === 1 ? "" : "s"}</div><p className="mt-1 max-w-xs text-xs text-slate-500">{item.clients.slice(0, 3).map((client) => client.companyName || client.name || client.email).join(", ")}{item.clients.length > 3 ? ` +${item.clients.length - 3} more` : ""}</p></td>
                <td className="px-5 py-4"><p className="font-bold text-slate-700">{item.transactions.length} transaction{item.transactions.length === 1 ? "" : "s"}</p><p className="mt-1 max-w-sm text-xs text-slate-500">{item.transactions.slice(0, 2).map((row) => `${row.description}: PHP ${money(row.specialRateAmount)}`).join(" · ")}{item.transactions.length > 2 ? ` · +${item.transactions.length - 2} more` : ""}</p></td>
                <td className="px-5 py-4 font-bold text-slate-700">{String(item.effectiveDate).slice(0, 10)}</td>
                <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{item.status}</span></td>
                <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(item)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-emerald-700" aria-label="Edit special rate"><Pencil size={16} /></button><button type="button" onClick={() => deactivate(item)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-red-600" aria-label="Deactivate special rate"><Trash2 size={16} /></button></div></td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan="6" className="px-5 py-14 text-center font-semibold text-slate-500">No Special Rates found.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination {...pagination} />

      {modalOpen && <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
        <form onSubmit={submit} className="my-6 w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 p-6"><div><p className="text-xs font-black uppercase tracking-wide text-violet-700">Special Client Pricing</p><h2 className="mt-1 text-2xl font-black text-slate-950">{editing ? "Edit Special Rate" : "Create Special Rate"}</h2><p className="mt-1 text-sm text-slate-500">One setup can contain multiple clients and multiple transaction rates.</p></div><ModalCloseButton onClick={() => !saving && setModalOpen(false)} label="Close special rate form" /></div>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-5">
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Special Rate Name</span><input className="input" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="e.g. Special Rate A" required /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Effectivity Date</span><input type="date" className="input" value={form.effectiveDate} onChange={(e) => setForm((c) => ({ ...c, effectiveDate: e.target.value }))} required /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Notes</span><textarea className="input min-h-24" value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} /></label>
              <div><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Clients</p><p className="mt-1 text-xs text-slate-400">Selected: {form.clientIds.length}</p></div><input className="input max-w-64" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients" /></div><div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{clients.map((client) => <label key={client.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-slate-50"><input type="checkbox" className="mt-1" checked={form.clientIds.includes(client.id)} onChange={() => toggleClient(client.id)} /><span><span className="block font-bold text-slate-800">{client.companyName || client.name}</span><span className="block text-xs text-slate-500">{client.email}</span></span></label>)}</div></div>
            </div>
            <div><div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Transactions / Services</p><p className="mt-1 text-xs text-slate-400">Selected: {form.transactions.length}</p></div></div><div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{selectableRates.map((rate) => { const selected = form.transactions.find((row) => row.billingRateId === rate.id); return <div key={rate.id} className={`rounded-xl border p-3 ${selected ? "border-violet-300 bg-violet-50" : "border-slate-200"}`}><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1" checked={Boolean(selected)} onChange={() => toggleTransaction(rate)} /><span className="min-w-0"><span className="block font-bold text-slate-800">{rateLabel(rate)}</span><span className="block text-xs text-slate-500">General Rate: PHP {money(rate.rateAmount)}</span></span></label>{selected && <label className="mt-3 block pl-6"><span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-violet-700">Special Rate Amount (PHP)</span><input type="number" min="0" step="0.01" className="input" value={selected.specialRateAmount} onChange={(e) => setTransactionAmount(rate.id, e.target.value)} required /></label>}</div> })}{!selectableRates.length && <p className="p-4 text-sm font-semibold text-slate-500">Create General Rates first so transactions can be selected here.</p>}</div></div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-5"><button type="button" className="btn-secondary" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : editing ? "Update Special Rate" : "Create Special Rate"}</button></div>
        </form>
      </div>}
    </section>
  )
}
