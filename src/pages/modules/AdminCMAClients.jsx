import { useEffect, useMemo, useState } from "react"
import { Building2, Pencil, Plus, RefreshCw, Search, Truck, Users, X } from "lucide-react"
import Alert from "../../components/Alert"
import { api, getApiError } from "../../lib/api"

const emptyForm = {
  name: "",
  code: "",
  contactPerson: "",
  email: "",
  phoneNumber: "",
  address: "",
  shippingLines: "",
  status: "active",
  notes: "",
  truckerClientIds: [],
}

const AdminCMAClients = () => {
  const [clients, setClients] = useState([])
  const [truckers, setTruckers] = useState([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [truckerSearch, setTruckerSearch] = useState("")
  const [alert, setAlert] = useState({ type: "", message: "" })

  const loadData = async () => {
    try {
      setLoading(true)
      const [clientResponse, truckerResponse] = await Promise.all([
        api.get("/admin/cma/clients"),
        api.get("/admin/cma/truckers"),
      ])
      setClients(clientResponse.data.cmaClients || [])
      setTruckers(truckerResponse.data.truckerClients || [])
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clients
    return clients.filter((item) => [item.name, item.code, item.contactPerson, item.email, ...(item.shippingLines || [])]
      .some((value) => String(value || "").toLowerCase().includes(term)))
  }, [clients, search])

  const filteredTruckers = useMemo(() => {
    const term = truckerSearch.trim().toLowerCase()
    return truckers.filter((item) => !term || [item.name, item.companyName, item.email]
      .some((value) => String(value || "").toLowerCase().includes(term)))
  }, [truckerSearch, truckers])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setTruckerSearch("")
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      name: item.name || "",
      code: item.code || "",
      contactPerson: item.contactPerson || "",
      email: item.email || "",
      phoneNumber: item.phoneNumber || "",
      address: item.address || "",
      shippingLines: (item.shippingLines || []).join(", "),
      status: item.status || "active",
      notes: item.notes || "",
      truckerClientIds: truckers.filter((trucker) => trucker.cmaClientId === item.id).map((trucker) => trucker.id),
    })
    setTruckerSearch("")
    setModalOpen(true)
  }

  const toggleTrucker = (id) => {
    setForm((current) => ({
      ...current,
      truckerClientIds: current.truckerClientIds.includes(id)
        ? current.truckerClientIds.filter((value) => value !== id)
        : [...current.truckerClientIds, id],
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setAlert({ type: "error", message: "CMA Client name is required." })
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...form,
        name: form.name.trim(),
        code: form.code.trim() || form.name.trim(),
        shippingLines: form.shippingLines.split(/[,\n]/).map((value) => value.trim()).filter(Boolean),
      }
      if (editing) await api.patch(`/admin/cma/clients/${editing.id}`, payload)
      else await api.post("/admin/cma/clients", payload)
      setAlert({ type: "success", message: editing ? "CMA Client updated." : "CMA Client registered." })
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await loadData()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (item) => {
    if (!window.confirm(`Deactivate ${item.name}? Existing bookings and CMA billing records will stay linked.`)) return
    try {
      await api.delete(`/admin/cma/clients/${item.id}`)
      setAlert({ type: "success", message: "CMA Client deactivated." })
      await loadData()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    }
  }

  const activeCount = clients.filter((item) => item.status === "active").length
  const assignedTruckers = truckers.filter((item) => item.isCMATruckerClient).length
  const shippingLineCount = new Set(clients.flatMap((item) => item.shippingLines || [])).size

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">CMA Special Client</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">CMA Client Registration</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Register CMA billing accounts, map CMA shipping-line identifiers, and assign trucker clients. The trucker remains the booking client while CMA is retained as a separate billing relationship.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={loadData} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
            <button type="button" className="btn-primary" onClick={openAdd}><Plus size={17} /> Register CMA Client</button>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Active CMA Clients</p><p className="mt-2 text-3xl font-black text-emerald-800">{activeCount}</p></div><Building2 className="text-emerald-700" /></div></div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Assigned Truckers</p><p className="mt-2 text-3xl font-black text-blue-800">{assignedTruckers}</p></div><Truck className="text-blue-700" /></div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-slate-600">Shipping-Line Tags</p><p className="mt-2 text-3xl font-black text-slate-950">{shippingLineCount}</p></div><Users className="text-slate-700" /></div></div>
        </div>
        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-lg font-black text-slate-950">Registered CMA Clients</h3><p className="text-sm text-slate-500">Automatic CMA tagging matches a booking by the assigned trucker or configured shipping line.</p></div>
          <div className="relative" data-field-control><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="input w-full !rounded-xl !pl-10 sm:w-[320px]" placeholder="Search CMA client" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">CMA Client</th><th className="px-4 py-3">Shipping Lines</th><th className="px-4 py-3">Trucker Clients</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">Loading CMA clients...</td></tr> : filtered.length === 0 ? <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">No CMA clients found.</td></tr> : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4"><div className="font-black text-slate-950">{item.name}</div><div className="mt-1 font-mono text-xs text-slate-500">{item.code}</div></td>
                  <td className="px-4 py-4"><div className="flex max-w-[320px] flex-wrap gap-1">{(item.shippingLines || []).length ? item.shippingLines.map((line) => <span key={line} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{line}</span>) : <span className="text-slate-400">No automatic shipping-line tag</span>}</div></td>
                  <td className="px-4 py-4 font-bold text-slate-700">{item.truckerCount || 0}</td>
                  <td className="px-4 py-4"><div className="font-semibold text-slate-700">{item.contactPerson || "-"}</div><div className="text-xs text-slate-500">{item.email || item.phoneNumber || "-"}</div></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.status}</span></td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Edit" onClick={() => openEdit(item)}><Pencil size={15} /></button>{item.status === "active" && <button type="button" className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50" title="Deactivate" onClick={() => deactivate(item)}><X size={15} /></button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <form onSubmit={submit}>
              <div className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-black text-slate-950">{editing ? "Edit CMA Client" : "Register CMA Client"}</h3><p className="mt-1 text-sm text-slate-500">CMA account details are used only for CMA billing and reporting.</p></div><button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={() => setModalOpen(false)} disabled={saving}><X size={20} /></button></div>
              <div className="grid gap-5 p-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">CMA Client Name *</span><input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Client Code</span><input className="input" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="e.g. CMA" /></label>
                    <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Status</span><select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                  </div>
                  <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Contact Person</span><input className="input" value={form.contactPerson} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} /></label>
                  <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Email</span><input type="email" className="input" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label><label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Phone</span><input className="input" value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} /></label></div>
                  <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Address</span><textarea className="input min-h-20" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></label>
                  <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Automatic Shipping-Line Tags</span><textarea className="input min-h-20" value={form.shippingLines} onChange={(event) => setForm((current) => ({ ...current, shippingLines: event.target.value }))} placeholder="CMA CGM, CMA SHIPPING\nSeparate with comma or new line" /><span className="mt-1 block text-xs text-slate-500">A booking under one of these shipping lines will automatically become a CMA Special Client booking.</span></label>
                  <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Notes</span><textarea className="input min-h-20" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between"><div><h4 className="font-black text-slate-950">Assigned Trucker Clients</h4><p className="mt-1 text-xs text-slate-500">These clients keep their normal booking account but their bookings can be linked automatically to this CMA account.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700 shadow-sm">{form.truckerClientIds.length} selected</span></div>
                  <div className="relative mt-4" data-field-control><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input !pl-9" placeholder="Search trucker" value={truckerSearch} onChange={(event) => setTruckerSearch(event.target.value)} /></div>
                  <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto pr-1">
                    {filteredTruckers.map((trucker) => {
                      const checked = form.truckerClientIds.includes(trucker.id)
                      const belongsElsewhere = trucker.cmaClientId && trucker.cmaClientId !== editing?.id
                      return <label key={trucker.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}><input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={() => toggleTrucker(trucker.id)} /><span className="min-w-0"><span className="block font-bold text-slate-800">{trucker.companyName || trucker.name}</span><span className="block truncate text-xs text-slate-500">{trucker.name}{trucker.email ? ` · ${trucker.email}` : ""}</span>{belongsElsewhere && <span className="mt-1 block text-xs font-bold text-amber-700">Currently assigned to {trucker.cmaClientName || "another CMA client"}. Selecting this will move the assignment.</span>}</span></label>
                    })}
                    {!filteredTruckers.length && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No trucker clients found.</div>}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Register CMA Client"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminCMAClients
