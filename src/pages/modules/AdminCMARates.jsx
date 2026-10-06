import { useEffect, useMemo, useState } from "react"
import { Calculator, Pencil, Plus, RefreshCw, Search, Settings2, X } from "lucide-react"
import Alert from "../../components/Alert"
import { api, getApiError } from "../../lib/api"

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({
  cmaClientId: "all",
  description: "",
  chargeCode: "",
  chargeType: "lolo",
  rateType: "local",
  containerSize: "all",
  containerType: "all",
  loadStatus: "all",
  unit: "per_container",
  rateAmount: "",
  freeDays: "0",
  minimumAmount: "0",
  effectiveDate: today(),
  effectiveTo: "",
  status: "active",
  sortOrder: "100",
  notes: "",
})
const money = (value) => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateOnly = (value) => value ? new Date(value).toLocaleDateString() : "-"

const AdminCMARates = () => {
  const [rates, setRates] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [alert, setAlert] = useState({ type: "", message: "" })

  const loadData = async () => {
    try {
      setLoading(true)
      const [rateResponse, clientResponse] = await Promise.all([
        api.get("/admin/cma/rates"),
        api.get("/admin/cma/clients?status=active"),
      ])
      setRates(rateResponse.data.cmaRates || [])
      setClients(clientResponse.data.cmaClients || [])
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rates.filter((item) => {
      const matchesType = typeFilter === "all" || item.chargeType === typeFilter
      const matchesSearch = !term || [item.description, item.chargeCode, item.cmaClientName, item.containerSize, item.containerType, item.loadStatus]
        .some((value) => String(value || "").toLowerCase().includes(term))
      return matchesType && matchesSearch
    })
  }, [rates, search, typeFilter])

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setModalOpen(true) }
  const openEdit = (item) => {
    setEditing(item)
    setForm({
      cmaClientId: item.cmaClientId || "all",
      description: item.description || "",
      chargeCode: item.chargeCode || "",
      chargeType: item.chargeType || "lolo",
      rateType: item.rateType || "local",
      containerSize: item.containerSize || "all",
      containerType: item.containerType || "all",
      loadStatus: item.loadStatus || "all",
      unit: item.unit || "per_container",
      rateAmount: String(item.rateAmount ?? ""),
      freeDays: String(item.freeDays ?? 0),
      minimumAmount: String(item.minimumAmount ?? 0),
      effectiveDate: item.effectiveDate ? new Date(item.effectiveDate).toISOString().slice(0, 10) : today(),
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo).toISOString().slice(0, 10) : "",
      status: item.status || "active",
      sortOrder: String(item.sortOrder ?? 100),
      notes: item.notes || "",
    })
    setModalOpen(true)
  }

  const updateChargeType = (value) => {
    setForm((current) => ({
      ...current,
      chargeType: value,
      unit: value === "storage" ? "storage_day" : current.unit === "storage_day" ? "per_container" : current.unit,
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const amount = Number(form.rateAmount)
    if (!form.description.trim() || !Number.isFinite(amount) || amount < 0) {
      setAlert({ type: "error", message: "Enter a description and a valid rate amount." })
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...form,
        rateAmount: amount,
        freeDays: Number(form.freeDays) || 0,
        minimumAmount: Number(form.minimumAmount) || 0,
        sortOrder: Number(form.sortOrder) || 100,
      }
      if (editing) await api.patch(`/admin/cma/rates/${editing.id}`, payload)
      else await api.post("/admin/cma/rates", payload)
      setAlert({ type: "success", message: editing ? "CMA rate updated." : "CMA rate added." })
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm())
      await loadData()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally { setSaving(false) }
  }

  const deactivate = async (item) => {
    if (!window.confirm(`Deactivate ${item.description}? Historical CMA billing will keep its stored rate snapshot.`)) return
    try {
      await api.delete(`/admin/cma/rates/${item.id}`)
      setAlert({ type: "success", message: "CMA rate deactivated." })
      await loadData()
    } catch (error) { setAlert({ type: "error", message: getApiError(error) }) }
  }

  const activeRates = rates.filter((item) => item.status === "active").length
  const storageRates = rates.filter((item) => item.status === "active" && item.chargeType === "storage").length
  const specificRates = rates.filter((item) => item.status === "active" && item.cmaClientId).length

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="text-sm font-black uppercase tracking-wide text-emerald-700">CMA Special Client</div><h2 className="mt-1 text-2xl font-black text-slate-950">CMA Rates</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Maintain LOLO, storage, and other CMA-only yard charges separately from normal OTLI client rates. Rate effectivity is preserved when billing is computed.</p></div>
          <div className="flex gap-2"><button type="button" className="btn-secondary" onClick={loadData} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button><button type="button" className="btn-primary" onClick={openAdd}><Plus size={17} /> Add CMA Rate</button></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Active CMA Rates</p><div className="mt-2 flex items-center justify-between"><p className="text-3xl font-black text-emerald-800">{activeRates}</p><Calculator className="text-emerald-700" /></div></div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-blue-700">Storage Rates</p><div className="mt-2 flex items-center justify-between"><p className="text-3xl font-black text-blue-800">{storageRates}</p><Settings2 className="text-blue-700" /></div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-slate-600">Client-Specific Rates</p><div className="mt-2 flex items-center justify-between"><p className="text-3xl font-black text-slate-950">{specificRates}</p></div></div>
        </div>
        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-lg font-black text-slate-950">CMA Rate Configuration</h3><p className="text-sm text-slate-500">A client-specific rate takes priority over the global “All CMA Clients” fallback.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative" data-field-control><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input className="input !pl-9 sm:w-[300px]" placeholder="Search rate" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select className="input sm:w-[170px]" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All charges</option><option value="lolo">LOLO</option><option value="storage">Storage</option><option value="other">Other</option></select></div></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">CMA Client</th><th className="px-4 py-3">Charge</th><th className="px-4 py-3">Applies To</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Effectivity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">Loading CMA rates...</td></tr> : filtered.length === 0 ? <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500">No CMA rates found.</td></tr> : filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><div className="font-black text-slate-900">{item.cmaClientName || "All CMA Clients"}</div><div className="text-xs text-slate-500">{item.cmaClientCode || "Global fallback"}</div></td><td className="px-4 py-4"><div className="font-bold text-slate-800">{item.description}</div><div className="mt-1 flex gap-1"><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{item.chargeCode || "NO-CODE"}</span><span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-black uppercase text-blue-700">{item.chargeType}</span></div></td><td className="px-4 py-4 text-xs text-slate-600"><div>{item.rateType} · {item.containerSize} · {item.containerType}</div><div className="mt-1">{item.loadStatus}</div>{item.chargeType === "storage" && <div className="mt-1 font-bold text-amber-700">{item.freeDays || 0} free day(s)</div>}</td><td className="px-4 py-4"><div className="font-black text-slate-950">{money(item.rateAmount)}</div><div className="text-xs text-slate-500">{item.unit}</div>{Number(item.minimumAmount) > 0 && <div className="text-xs text-slate-500">Min {money(item.minimumAmount)}</div>}</td><td className="px-4 py-4 text-xs text-slate-600"><div>From {dateOnly(item.effectiveDate)}</div><div>To {dateOnly(item.effectiveTo)}</div></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.status}</span></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => openEdit(item)}><Pencil size={15} /></button>{item.status === "active" && <button type="button" className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50" onClick={() => deactivate(item)}><X size={15} /></button>}</div></td></tr>)}
        </tbody></table></div>
      </section>

      {modalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><form onSubmit={submit}><div className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-black text-slate-950">{editing ? "Edit CMA Rate" : "Add CMA Rate"}</h3><p className="mt-1 text-sm text-slate-500">This rate is never mixed into normal trucker client billing.</p></div><button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={() => setModalOpen(false)}><X size={20} /></button></div><div className="grid gap-4 p-5 md:grid-cols-2">
        <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">CMA Client</span><select className="input" value={form.cmaClientId} onChange={(event) => setForm((current) => ({ ...current, cmaClientId: event.target.value }))}><option value="all">All CMA Clients (global fallback)</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.code})</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Charge Type *</span><select className="input" value={form.chargeType} onChange={(event) => updateChargeType(event.target.value)}><option value="lolo">LOLO</option><option value="storage">Storage</option><option value="other">Other CMA Charge</option></select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Charge Code</span><input className="input" value={form.chargeCode} onChange={(event) => setForm((current) => ({ ...current, chargeCode: event.target.value }))} placeholder="e.g. CMA_LOLO_20" /></label>
        <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Description *</span><input className="input" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required placeholder="e.g. CMA Lift On / Lift Off" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Rate Type</span><select className="input" value={form.rateType} onChange={(event) => setForm((current) => ({ ...current, rateType: event.target.value }))}><option value="local">Local</option><option value="international">International</option></select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Unit</span><select className="input" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}><option value="per_container">Per container</option><option value="storage_day">Per container/day</option><option value="fixed">Flat charge</option></select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Container Size</span><select className="input" value={form.containerSize} onChange={(event) => setForm((current) => ({ ...current, containerSize: event.target.value }))}><option value="all">All</option><option value="20">20 ft</option><option value="40">40 ft</option></select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Container Type</span><select className="input" value={form.containerType} onChange={(event) => setForm((current) => ({ ...current, containerType: event.target.value }))}><option value="all">All</option><option value="dry">Dry</option><option value="reefer">Reefer</option><option value="tank">Tank</option><option value="open_top">Open Top</option><option value="flat_rack">Flat Rack</option></select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Load Status</span><select className="input" value={form.loadStatus} onChange={(event) => setForm((current) => ({ ...current, loadStatus: event.target.value }))}><option value="all">All</option><option value="empty">Empty</option><option value="laden">Loaded</option></select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Rate Amount (PHP) *</span><input type="number" min="0" step="0.01" className="input" value={form.rateAmount} onChange={(event) => setForm((current) => ({ ...current, rateAmount: event.target.value }))} required /></label>
        {form.chargeType === "storage" && <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Free Days</span><input type="number" min="0" className="input" value={form.freeDays} onChange={(event) => setForm((current) => ({ ...current, freeDays: event.target.value }))} /></label>}
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Minimum Amount</span><input type="number" min="0" step="0.01" className="input" value={form.minimumAmount} onChange={(event) => setForm((current) => ({ ...current, minimumAmount: event.target.value }))} /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Effective From *</span><input type="date" className="input" value={form.effectiveDate} onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))} required /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Effective To</span><input type="date" className="input" value={form.effectiveTo} onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))} /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Status</span><select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Priority / Sort Order</span><input type="number" className="input" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} /></label>
        <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Notes</span><textarea className="input min-h-20" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
      </div><div className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Add CMA Rate"}</button></div></form></div></div>}
    </div>
  )
}

export default AdminCMARates
