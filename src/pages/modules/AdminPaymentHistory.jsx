import { useEffect, useMemo, useRef, useState } from "react"
import { CreditCard, Printer, RefreshCw, Search, SlidersHorizontal } from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import Pagination from "../../components/ui/Pagination"
import TableActionButton from "../../components/ui/TableActionButton"
import TableCrudActions from "../../components/ui/TableCrudActions"
import ContainerClassificationBadges from "../../components/ui/ContainerClassificationBadges"
import ContainerClassificationFilters from "../../components/ui/ContainerClassificationFilters"
import { usePagination } from "../../hooks/usePagination"
import { useClickOutside } from "../../hooks/useClickOutside"
import { api, getApiError } from "../../lib/api"
import { printBookingDocument } from "../../lib/printDocument"

const money = (value) => `PHP ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatDate = (value) => value ? new Date(value).toLocaleString("en-PH") : "-"

const buildInvoicePrintPayload = (item) => ({
  ...item,
  billingTotal: Number(item.grossBillingTotal || item.total || 0),
  billingSubtotal: Number(item.subtotal || 0),
  billingLineItems: item.lineItems || [],
})

const buildReceiptPrintPayload = (item) => {
  const total = Number(item.total || 0)
  const vatRate = item.isVatApplicable === false ? 0 : Number(item.vatRate || 0)
  const subtotal = vatRate > 0 ? Math.round((total / (1 + vatRate)) * 100) / 100 : total
  const vatAmount = Math.round((total - subtotal) * 100) / 100
  return {
    ...item,
    billingTotal: total,
    billingSubtotal: subtotal,
    vatRate,
    vatAmount,
    billingLineItems: [{
      description: `Approved payment for ${item.bookingReference}`,
      quantity: 1,
      rateAmount: subtotal,
      amount: subtotal,
    }],
  }
}

const AdminPaymentHistory = ({ mode = "history" }) => {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [paymentType, setPaymentType] = useState("all")
  const [loadStatus, setLoadStatus] = useState("all")
  const [rateType, setRateType] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [error, setError] = useState("")

  const loadTransactions = async () => {
    try {
      setLoading(true)
      setError("")
      const { data } = await api.get("/admin/payments/history")
      setTransactions(data.transactions || [])
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useClickOutside(filterRef, () => setShowFilters(false), showFilters)

  useEffect(() => { loadTransactions() }, [])
  useEffect(() => {
    const refresh = () => loadTransactions()
    window.addEventListener("otli:realtime", refresh)
    return () => window.removeEventListener("otli:realtime", refresh)
  }, [])

  const filtered = useMemo(() => transactions.filter((item) => {
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || [item.bookingReference, item.containerNumber, item.clientName, item.paymentReferenceNumber, item.receiptNumber]
      .some((value) => String(value || "").toLowerCase().includes(term))
    const matchesType = paymentType === "all" || String(item.paymentTypeCategory || item.paymentType || "").toLowerCase().includes(paymentType)
    const matchesLoadStatus = loadStatus === "all" || item.containerLoadStatus === loadStatus
    const matchesRateType = rateType === "all" || (item.rateType || "local") === rateType
    return matchesSearch && matchesType && matchesLoadStatus && matchesRateType
  }), [transactions, search, paymentType, loadStatus, rateType])

  const pagination = usePagination(filtered, 12, `${search}|${paymentType}|${loadStatus}|${rateType}`)
  const title = mode === "invoices" ? "Invoices and Receipts" : "Payment History"
  const description = mode === "invoices"
    ? "Print VAT invoices, official receipts, and Non-VAT acknowledgement receipts."
    : "All approved and completed payment transactions are shown here."

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Billing Records</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">{title}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={loadTransactions} disabled={loading} className="btn-secondary">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      {error && <Alert type="error" message={error} />}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search booking, container, client, payment, or receipt" />
          </label>
          <select className="input md:max-w-[220px]" value={paymentType} onChange={(event) => setPaymentType(event.target.value)}>
            <option value="all">All payment types</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="ewallet">E-wallet</option>
          </select>
          <div className="relative" ref={filterRef}>
            <button type="button" onClick={() => setShowFilters((current) => !current)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 md:w-auto">
              <SlidersHorizontal size={18} /> Container Filters
            </button>
            {showFilters && (
              <div className="absolute right-0 z-40 mt-2 w-[310px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <p className="text-sm font-black text-slate-950">Filter Containers</p>
                  <button type="button" onClick={() => { setLoadStatus("all"); setRateType("all") }} className="text-xs font-black text-emerald-700">Reset</button>
                </div>
                <div className="mt-4 space-y-4">
                  <ContainerClassificationFilters
                    loadStatus={loadStatus}
                    rateType={rateType}
                    onLoadStatusChange={setLoadStatus}
                    onRateTypeChange={setRateType}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">Client / Container</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Tax Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.paginatedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4"><p className="font-black text-emerald-700">{item.bookingReference}</p>{item.recordSource === "legacy_migration" && <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">Legacy</span>}<p className="text-xs text-slate-500">Payment {item.sequence || 1} • {formatDate(item.paymentDate)}</p></td>
                  <td className="px-4 py-4"><p className="font-bold text-slate-800">{item.clientName}</p><p className="text-xs text-slate-500">{item.containerNumber}</p><ContainerClassificationBadges loadStatus={item.containerLoadStatus} rateType={item.rateType} className="mt-2" compact /></td>
                  <td className="px-4 py-4"><p className="font-bold text-slate-700">{item.paymentType}</p><p className="text-xs text-slate-500">{item.paymentReferenceNumber || "Auto-generated"}</p></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${item.isVatApplicable ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{item.isVatApplicable ? "VAT" : "Non-VAT"}</span></td>
                  <td className="px-4 py-4"><p className="font-black text-slate-900">{money(item.total)}</p>{Number(item.grossBillingTotal || 0) !== Number(item.total || 0) && <p className="text-xs font-semibold text-slate-500">Gross bill: {money(item.grossBillingTotal)}</p>}</td>
                  <td className="px-4 py-4"><p className="font-bold text-slate-700">{item.receiptNumber || "Pending"}</p><p className="text-xs text-slate-500">{item.receiptType === "acknowledgement_receipt" ? "Acknowledgement Receipt" : "Official Receipt"}</p></td>
                  <td className="px-4 py-4">
                    <TableCrudActions
                      recordLabel={`payment ${item.bookingReference}`}
                      onView={() => setSelectedTransaction(item)}
                      editDisabled
                      deleteDisabled
                      editLabel="Completed payment records cannot be edited"
                      deleteLabel="Completed payment records cannot be deleted"
                    >
                      {item.isVatApplicable && (
                        <TableActionButton
                          label={`Print VAT invoice for ${item.bookingReference}`}
                          variant="info"
                          onClick={() => printBookingDocument(buildInvoicePrintPayload(item), "invoice")}
                        >
                          <Printer size={17} aria-hidden="true" />
                        </TableActionButton>
                      )}
                      <TableActionButton
                        label={`Print ${item.isVatApplicable ? "receipt" : "acknowledgement receipt"} for ${item.bookingReference}`}
                        variant="success"
                        onClick={() => printBookingDocument(buildReceiptPrintPayload(item), "receipt")}
                      >
                        <CreditCard size={17} aria-hidden="true" />
                      </TableActionButton>
                    </TableCrudActions>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan="7" className="px-4 py-14 text-center font-semibold text-slate-500">No finished transactions found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </section>

      {selectedTransaction && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Payment Details</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedTransaction.bookingReference}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedTransaction.clientName} • {selectedTransaction.containerNumber}</p>
                <ContainerClassificationBadges loadStatus={selectedTransaction.containerLoadStatus} rateType={selectedTransaction.rateType} className="mt-3" />
              </div>
              <ModalCloseButton onClick={() => setSelectedTransaction(null)} label="Close payment details" />
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Container" value={`${selectedTransaction.containerSize || "-"}ft • ${String(selectedTransaction.containerType || "").replaceAll("_", " ") || "Unknown type"}`} />
              <Detail label="Load Status" value={selectedTransaction.containerLoadStatus === "laden" ? "Laden" : selectedTransaction.containerLoadStatus === "empty" ? "Empty" : "Unknown"} />
              <Detail label="Rate Classification" value={selectedTransaction.rateType === "international" ? "International" : "Local"} />
              <Detail label="Payment Type" value={selectedTransaction.paymentType} />
              <Detail label="Payment Date" value={formatDate(selectedTransaction.paymentDate)} />
              <Detail label="Payment Reference" value={selectedTransaction.paymentReferenceNumber || "Auto-generated"} />
              <Detail label="Tax Type" value={selectedTransaction.isVatApplicable ? "VAT" : "Non-VAT"} />
              <Detail label="Subtotal" value={money(selectedTransaction.subtotal)} />
              <Detail label="VAT Amount" value={money(selectedTransaction.vatAmount)} />
              <Detail label="Payment Amount" value={money(selectedTransaction.total)} />
              <Detail label="Gross Bill at Payment" value={money(selectedTransaction.grossBillingTotal || selectedTransaction.total)} />
              <Detail label="Payment Sequence" value={`Payment ${selectedTransaction.sequence || 1}`} />
              <Detail label="Receipt Number" value={selectedTransaction.receiptNumber} />
              <Detail label="Receipt Type" value={selectedTransaction.receiptType === "acknowledgement_receipt" ? "Acknowledgement Receipt" : "Official Receipt"} />
              {(selectedTransaction.lineItems || []).length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 lg:col-span-3">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400">Transaction Breakdown</div>
                  <div className="mt-3 space-y-2">
                    {(selectedTransaction.lineItems || []).map((line, index) => (
                      <div key={`${line.chargeCode || line.description}-${index}`} className="flex items-start justify-between gap-4 rounded-xl bg-white px-3 py-2 text-sm">
                        <span className="font-bold text-slate-700">{line.description || line.chargeCode || `Charge ${index + 1}`}</span>
                        <span className="font-black text-slate-950">{money(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

export default AdminPaymentHistory
