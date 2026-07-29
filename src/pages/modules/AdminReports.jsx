import { useEffect, useMemo, useState } from "react"
import {
  Boxes,
  Container,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Ship,
  Warehouse,
} from "lucide-react"
import Alert from "../../components/Alert"
import InputDate from "../../components/ui/InputDate"
import { api, getApiError } from "../../lib/api"

const emptyCounts = { 20: 0, 40: 0, total: 0 }
const emptyReport = {
  totalContainersInYard: 0,
  empty: emptyCounts,
  laden: emptyCounts,
  international: emptyCounts,
  totalTeu: 0,
  totalFeu: 0,
  releasedContainers: 0,
  totalRecordedRevenue: 0,
  releaseReports: [],
  clientRevenue: [],
  clientOptions: [],
}

const formatDateTime = (value) => {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

const toDateOnlyString = (value) => {
  if (!value) return ""
  if (typeof value === "string") return value.slice(0, 10)

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const normalizeDateValue = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const AdminReports = () => {
  const [filters, setFilters] = useState({ startDate: "", endDate: "", clientId: "" })
  const [report, setReport] = useState(emptyReport)
  const [generatedAt, setGeneratedAt] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadReport = async () => {
    try {
      setLoading(true)
      setError("")
      const { data } = await api.get("/admin/reports/yard-containers", { params: filters })
      setReport(data.report || emptyReport)
      setGeneratedAt(data.generatedAt || new Date().toISOString())
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  const rows = useMemo(
    () => [
      ["Total Containers in Yard", "All sizes", report.totalContainersInYard],
      ["Empty Container", "20 FT", report.empty?.[20] || 0],
      ["Empty Container", "40 FT", report.empty?.[40] || 0],
      ["Laden Container", "20 FT", report.laden?.[20] || 0],
      ["Laden Container", "40 FT", report.laden?.[40] || 0],
      ["International Container", "20 FT", report.international?.[20] || 0],
      ["International Container", "40 FT", report.international?.[40] || 0],
      ["Capacity Equivalent", "TEU", report.totalTeu || 0],
      ["Capacity Equivalent", "FEU", report.totalFeu || 0],
    ],
    [report],
  )

  const exportCsv = () => {
    const csv = [
      ["OneTrue Yard Container Report"],
      ["Generated", formatDateTime(generatedAt)],
      ["Start Date", filters.startDate || "All"],
      ["End Date", filters.endDate || "All"],
      ["Client", report.clientOptions?.find((client) => client.id === filters.clientId)?.name || "All Clients"],
      [],
      ["Report", "Container Size / Unit", "Quantity"],
      ...rows,
      [],
      ["Client Revenue", "Completed Releases", "Subtotal", "VAT", "Total Revenue"],
      ...(report.clientRevenue || []).map((client) => [client.clientName, client.bookingCount, client.subtotal, client.vat, client.revenue]),
      [],
      ["Release Report", "Client", "Container", "Classification", "Released At", "Subtotal", "VAT", "Recorded Revenue"],
      ...(report.releaseReports || []).map((item) => [item.reportNumber, item.clientName, item.containerNumber, item.rateType, formatDateTime(item.releasedAt), item.billingSubtotal, item.vatAmount, item.revenueTotal]),
    ]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `yard-container-report-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const summaryCards = [
    { label: "Containers in Yard", value: report.totalContainersInYard || 0, icon: Warehouse },
    { label: "Empty Containers", value: report.empty?.total || 0, icon: Container },
    { label: "Laden Containers", value: report.laden?.total || 0, icon: Boxes },
    { label: "International", value: report.international?.total || 0, icon: Ship },
    { label: "Completed Releases", value: report.releasedContainers || 0, icon: FileText },
    { label: "Recorded Revenue", value: formatCurrency(report.totalRecordedRevenue), icon: Download },
  ]

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="card p-5 print:shadow-none">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Reports Module</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Yard Container Report</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Review empty, laden, international, TEU, and FEU totals for containers currently inside the yard.
            </p>
            <p className="mt-2 text-xs font-bold text-slate-400">Generated: {formatDateTime(generatedAt)}</p>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" className="btn-secondary" onClick={loadReport} disabled={loading}>
              <RefreshCw size={17} /> {loading ? "Loading..." : "Refresh"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              <Printer size={17} /> Print
            </button>
            <button type="button" className="btn-primary" onClick={exportCsv}>
              <Download size={17} /> Export CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <InputDate
            label="Start Date"
            name="startDate"
            value={filters.startDate}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                startDate: toDateOnlyString(event.target.value),
              }))
            }
            maxDate={filters.endDate ? normalizeDateValue(filters.endDate) : null}
          />
          <InputDate
            label="End Date"
            name="endDate"
            value={filters.endDate}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                endDate: toDateOnlyString(event.target.value),
              }))
            }
            minDate={filters.startDate ? normalizeDateValue(filters.startDate) : null}
          />
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Client</span>
            <select className="input" value={filters.clientId} onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value }))}>
              <option value="">All Clients</option>
              {(report.clientOptions || []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" className="btn-primary w-full" onClick={loadReport} disabled={loading}>
              <FileText size={17} /> Apply Filters
            </button>
          </div>
        </div>

        <div className="mt-4"><Alert type="error">{error}</Alert></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card flex items-center gap-4 p-5 print:border print:shadow-none">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white"><Icon size={22} /></div>
            <div><div className="text-2xl font-black text-slate-950">{value}</div><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div></div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <ReportSection title="Total Empty Container" counts={report.empty} />
        <ReportSection title="Laden Container" counts={report.laden} />
        <ReportSection title="International Container" counts={report.international} />
      </div>

      <div className="card overflow-hidden print:border print:shadow-none">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-lg font-black text-slate-950">Revenue by Client</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">Ranks clients by revenue recorded when container release was completed within the selected period.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Rank</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Completed Releases</th><th className="px-5 py-3">Subtotal</th><th className="px-5 py-3">VAT</th><th className="px-5 py-3 text-right">Revenue</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {(report.clientRevenue || []).map((client, index) => <tr key={client.clientId}><td className="px-5 py-4 font-black text-slate-500">#{index + 1}</td><td className="px-5 py-4 font-black text-slate-950">{client.clientName}</td><td className="px-5 py-4 font-bold text-slate-600">{client.bookingCount}</td><td className="px-5 py-4 font-bold text-slate-600">PHP {Number(client.subtotal || 0).toLocaleString()}</td><td className="px-5 py-4 font-bold text-slate-600">PHP {Number(client.vat || 0).toLocaleString()}</td><td className="px-5 py-4 text-right font-black text-emerald-700">PHP {Number(client.revenue || 0).toLocaleString()}</td></tr>)}
              {(report.clientRevenue || []).length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center font-bold text-slate-500">No completed release revenue found for the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden print:border print:shadow-none">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-lg font-black text-slate-950">Release Completion Reports</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">Generated automatically after Gate-Out completion. Each row is the final revenue snapshot for one released container.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Report</th><th className="px-5 py-3">Client</th><th className="px-5 py-3">Container</th><th className="px-5 py-3">Classification</th><th className="px-5 py-3">Released</th><th className="px-5 py-3">Billing Days</th><th className="px-5 py-3">Subtotal</th><th className="px-5 py-3">VAT</th><th className="px-5 py-3 text-right">Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(report.releaseReports || []).map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 font-black text-emerald-700">{item.reportNumber}</td>
                  <td className="px-5 py-4 font-black text-slate-950">{item.clientName}</td>
                  <td className="px-5 py-4"><div className="font-black text-slate-900">{item.containerNumber}</div><div className="text-xs font-semibold text-slate-400">{item.containerSize} FT</div></td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${item.rateType === "international" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>{item.rateType}</span></td>
                  <td className="px-5 py-4 font-semibold text-slate-600">{formatDateTime(item.releasedAt)}</td>
                  <td className="px-5 py-4 font-bold text-slate-600">{item.billingDays || 0}</td>
                  <td className="px-5 py-4 font-bold text-slate-600">{formatCurrency(item.billingSubtotal)}</td>
                  <td className="px-5 py-4 font-bold text-slate-600">{formatCurrency(item.vatAmount)}</td>
                  <td className="px-5 py-4 text-right font-black text-emerald-700">{formatCurrency(item.revenueTotal)}</td>
                </tr>
              ))}
              {(report.releaseReports || []).length === 0 && <tr><td colSpan="9" className="px-5 py-10 text-center font-bold text-slate-500">No release completion reports found for the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden print:border print:shadow-none">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-lg font-black text-slate-950">Capacity Equivalent Summary</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">20 FT container = 1 TEU or 0.5 FEU. 40 FT container = 2 TEU or 1 FEU.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <CapacityCard label="TEU" description="Twenty-Foot Equivalent Unit" value={report.totalTeu || 0} />
          <CapacityCard label="FEU" description="Forty-Foot Equivalent Unit" value={report.totalFeu || 0} />
        </div>
      </div>
    </div>
  )
}

const ReportSection = ({ title, counts = emptyCounts }) => (
  <section className="card overflow-hidden print:border print:shadow-none">
    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
      <h3 className="font-black text-slate-950">{title}</h3>
    </div>
    <div className="divide-y divide-slate-100">
      {[20, 40].map((size) => (
        <div key={size} className="flex items-center justify-between px-5 py-3">
          <span className="font-bold text-slate-600">{size} FT</span>
          <span className="text-lg font-black text-slate-950">{counts?.[size] || 0} units</span>
        </div>
      ))}
      <div className="flex items-center justify-between bg-emerald-50 px-5 py-3">
        <span className="font-black text-emerald-800">Total</span>
        <span className="text-lg font-black text-emerald-800">{counts?.total || 0} units</span>
      </div>
    </div>
  </section>
)

const CapacityCard = ({ label, description, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <div className="text-xs font-black uppercase tracking-widest text-slate-500">{description}</div>
    <div className="mt-2 text-3xl font-black text-slate-950">{value} {label}</div>
  </div>
)

export default AdminReports
