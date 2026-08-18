import { useEffect, useMemo, useRef, useState } from "react"
import {
  Building2,
  CreditCard,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
} from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import Pagination from "../../components/ui/Pagination"
import TableCrudActions from "../../components/ui/TableCrudActions"
import { useClickOutside } from "../../hooks/useClickOutside"
import { usePagination } from "../../hooks/usePagination"
import { api, getApiError, resolveFileUrl } from "../../lib/api"

const initialForm = {
  type: "bank",
  name: "",
  bankName: "",
  accountNumber: "",
  accountName: "",
  instructions: "",
  status: "active",
  qr: null,
}

const maskAccount = (value = "") => {
  const text = String(value)
  if (text.length <= 4) return text
  return `${"•".repeat(Math.max(text.length - 4, 4))}${text.slice(-4)}`
}

const AdminPaymentTypes = () => {
  const [paymentTypes, setPaymentTypes] = useState([])
  const [filters, setFilters] = useState({ search: "", type: "all", status: "all" })
  const [showFilters, setShowFilters] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [editing, setEditing] = useState(null)
  const [selectedPaymentType, setSelectedPaymentType] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ type: "", message: "" })
  const filterRef = useRef(null)

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  const loadPaymentTypes = async () => {
    try {
      setLoading(true)
      const { data } = await api.get("/admin/payment-types")
      setPaymentTypes((data.paymentTypes || []).filter((item) => item.type !== "cash"))
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPaymentTypes()
  }, [])

  const filteredItems = useMemo(() => {
    const term = filters.search.trim().toLowerCase()
    return paymentTypes.filter((item) => {
      const matchesSearch = !term || [item.name, item.bankName, item.accountName, item.accountNumber].some((value) => String(value || "").toLowerCase().includes(term))
      const matchesType = filters.type === "all" || item.type === filters.type
      const matchesStatus = filters.status === "all" || item.status === filters.status
      return matchesSearch && matchesType && matchesStatus
    })
  }, [filters, paymentTypes])

  const pagination = usePagination(filteredItems, 10, `${filters.search}|${filters.type}|${filters.status}`)

  const openAdd = () => {
    setEditing(null)
    setForm(initialForm)
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      type: item.type,
      name: item.name,
      bankName: item.bankName || "",
      accountNumber: item.accountNumber,
      accountName: item.accountName,
      instructions: item.instructions || "",
      status: item.status,
      qr: null,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setForm(initialForm)
  }

  const submit = async (event) => {
    event.preventDefault()
    const payload = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (key === "qr") {
        if (value) payload.append("qr", value)
      } else {
        payload.append(key, value)
      }
    })

    try {
      setSaving(true)
      setAlert({ type: "", message: "" })
      if (editing) await api.patch(`/admin/payment-types/${editing.id}`, payload, { headers: { "Content-Type": "multipart/form-data" } })
      else await api.post("/admin/payment-types", payload, { headers: { "Content-Type": "multipart/form-data" } })
      setAlert({ type: "success", message: editing ? "Payment type updated." : "Payment type added." })
      setModalOpen(false)
      setEditing(null)
      setForm(initialForm)
      await loadPaymentTypes()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return
    try {
      await api.delete(`/admin/payment-types/${item.id}`)
      setAlert({ type: "success", message: "Payment type deleted." })
      await loadPaymentTypes()
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    }
  }

  const activeCount = paymentTypes.filter((item) => item.status === "active").length
  const banks = paymentTypes.filter((item) => item.type === "bank").length
  const wallets = paymentTypes.filter((item) => item.type === "ewallet").length

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Billing Management</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Payment Types</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Cash is created automatically for authorized cashier transactions and is not managed here. Set up the bank and eWallet accounts clients can select when submitting payment.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={loadPaymentTypes} className="btn-secondary shrink-0" disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={openAdd} className="btn-primary shrink-0"><Plus size={18} /> Add Payment Type</button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-wide text-emerald-600">Active Methods</div><div className="mt-2 text-3xl font-black text-emerald-700">{activeCount}</div></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm"><CreditCard size={20} /></div></div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-wide text-blue-600">Bank Accounts</div><div className="mt-2 text-3xl font-black text-blue-700">{banks}</div></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm"><Building2 size={20} /></div></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-wide text-slate-500">eWallet Accounts</div><div className="mt-2 text-3xl font-black text-slate-950">{wallets}</div></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><Smartphone size={20} /></div></div>
          </div>
        </div>
        <div className="mt-4"><Alert type={alert.type}>{alert.message}</Alert></div>
      </section>

      <section className="card overflow-visible">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Available Payment Accounts</h3>
            <p className="text-sm font-semibold text-slate-500">Search and filter the payment methods displayed to clients.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative" data-field-control>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input className="input w-full !rounded-2xl !py-3 !pl-10 !pr-4 text-sm sm:w-[320px]" placeholder="Search payment account" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
            </div>
            <div className="relative" ref={filterRef}>
              <button type="button" onClick={() => setShowFilters((current) => !current)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:w-auto">
                <SlidersHorizontal size={18} /> Filters
              </button>
              {showFilters && (
                <div className="absolute right-0 z-40 mt-2 w-[290px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-sm font-black text-slate-950">Filter Payment Types</p>
                    <button type="button" onClick={() => setFilters((current) => ({ ...current, type: "all", status: "all" }))} className="text-xs font-black text-emerald-700">Reset</button>
                  </div>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Type</span>
                      <select className="input !py-3" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
                        <option value="all">All types</option><option value="bank">Bank</option><option value="ewallet">eWallet</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
                      <select className="input !py-3" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                        <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">Showing {filteredItems.length} of {paymentTypes.length} payment types</div>
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Payment Type</th><th className="px-5 py-4">Account Details</th><th className="px-5 py-4">QR</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.paginatedItems.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${item.type === "bank" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{item.type === "bank" ? <Building2 size={19} /> : <Smartphone size={19} />}</span><div><p className="font-black text-slate-950">{item.name}</p><p className="text-xs font-bold capitalize text-slate-500">{item.type === "ewallet" ? "eWallet" : "Bank"}</p></div></div></td>
                  <td className="px-5 py-4"><p className="font-bold text-slate-800">{item.bankName || item.name}</p><p className="mt-1 text-slate-600">{maskAccount(item.accountNumber)}</p><p className="text-xs text-slate-500">{item.accountName}</p></td>
                  <td className="px-5 py-4">{item.qrUrl ? <a href={resolveFileUrl(item.qrUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"><QrCode size={16} /> View QR</a> : <span className="text-xs font-semibold text-slate-400">No QR uploaded</span>}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{item.status}</span></td>
                  <td className="px-5 py-4">
                    <TableCrudActions
                      recordLabel={item.name}
                      onView={() => setSelectedPaymentType(item)}
                      onEdit={() => openEdit(item)}
                      onDelete={() => remove(item)}
                    />
                  </td>
                </tr>
              ))}
              {!loading && filteredItems.length === 0 && <tr><td colSpan="5" className="px-5 py-16 text-center font-semibold text-slate-500">No payment types found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </section>


      {selectedPaymentType && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Payment Type Details</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedPaymentType.name}</h2>
              </div>
              <ModalCloseButton onClick={() => setSelectedPaymentType(null)} label="Close payment type details" />
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Detail label="Type" value={selectedPaymentType.type === "ewallet" ? "eWallet" : "Bank"} />
              <Detail label="Status" value={selectedPaymentType.status} />
              <Detail label="Bank / Provider" value={selectedPaymentType.bankName || selectedPaymentType.name} />
              <Detail label="Account Number" value={selectedPaymentType.accountNumber} />
              <Detail label="Account Owner" value={selectedPaymentType.accountName} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">Instructions</div>
                <div className="mt-1 text-sm font-bold leading-6 text-slate-800">{selectedPaymentType.instructions || "No instructions added."}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">QR Code</div>
                {selectedPaymentType.qrUrl ? <a href={resolveFileUrl(selectedPaymentType.qrUrl)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700"><QrCode size={16} /> Open QR Image</a> : <div className="mt-2 text-sm font-bold text-slate-500">No QR image uploaded.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-6"><div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Payment Setup</p><h2 className="mt-1 text-2xl font-black text-slate-950">{editing ? "Edit Payment Type" : "Add Payment Type"}</h2></div><ModalCloseButton onClick={closeModal} label="Close payment type form" /></div>
            <div className="grid gap-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Type</span><select className="input" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value, bankName: event.target.value === "bank" ? current.bankName : "" }))}><option value="bank">Bank</option><option value="ewallet">eWallet</option></select></label>
                <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Display Name</span><input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={form.type === "bank" ? "Example: BDO Savings" : "Example: GCash"} required /></label>
              </div>
              {form.type === "bank" && <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Bank Name</span><input className="input" value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} placeholder="Example: BDO Unibank" required /></label>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Account Number</span><input className="input" value={form.accountNumber} onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))} required /></label>
                <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Account Owner</span><input className="input" value={form.accountName} onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))} required /></label>
              </div>
              <label className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"><span className="flex items-center gap-2 text-sm font-black text-slate-700"><QrCode size={18} /> QR Image <span className="font-semibold text-slate-400">(Optional)</span></span><input type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 block w-full text-sm text-slate-600" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && file.size > 5 * 1024 * 1024) { event.target.value = ""; window.alert("QR image exceeds the 5 MB maximum upload size."); return; } setForm((current) => ({ ...current, qr: file })); }} /><p className="mt-2 text-xs text-slate-500">Maximum file size: 5 MB. Uploading a new QR replaces the existing QR image.</p></label>
              <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Payment Instructions</span><textarea className="input min-h-24" value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Optional instructions shown to the client" /></label>
              <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Status</span><select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white p-5"><button type="button" onClick={closeModal} className="btn-secondary" disabled={saving}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{editing ? <Pencil size={17} /> : <Plus size={17} />} {saving ? "Saving..." : editing ? "Save Changes" : "Add Payment Type"}</button></div>
          </form>
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

export default AdminPaymentTypes
