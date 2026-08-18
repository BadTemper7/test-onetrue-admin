import { useEffect, useMemo, useState } from "react"
import {
  Boxes,
  CalendarRange,
  Container,
  Download,
  FileText,
  LayoutDashboard,
  ListFilter,
  Printer,
  RefreshCw,
  Ship,
  Warehouse,
} from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import TableCrudActions from "../../components/ui/TableCrudActions"
import Pagination from "../../components/ui/Pagination"
import ContainerClassificationBadges from "../../components/ui/ContainerClassificationBadges"
import ContainerClassificationFilters from "../../components/ui/ContainerClassificationFilters"
import ModernDateInput from "../../components/ModernDateInput"
import { api, getApiError } from "../../lib/api"
import { usePagination } from "../../hooks/usePagination"

const emptyCounts = { 20: 0, 40: 0, total: 0 }
const emptyReport = {
  totalContainersInYard: 0,
  legacyContainers: 0,
  empty: emptyCounts,
  laden: emptyCounts,
  international: emptyCounts,
  local: emptyCounts,
  totalTeu: 0,
  totalFeu: 0,
  releasedContainers: 0,
  totalRecordedRevenue: 0,
  releaseReports: [],
  clientRevenue: [],
  clientOptions: [],
}

const periodOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "specific_date", label: "Specific Date" },
  { value: "all_time", label: "All Time" },
]

const contentOptions = [
  { value: "all", label: "All Analytics" },
  { value: "overview", label: "Overview Cards" },
  { value: "containers", label: "Container Breakdown" },
  { value: "revenue", label: "Revenue by Client" },
  { value: "releases", label: "Release Reports" },
  { value: "capacity", label: "Capacity Summary" },
]

const formatDateTime = (value) => {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const formatDateOnly = (value) => {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const formatPeriodDate = (value) => {
  if (!value) return ""
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`))
}

const getPeriodRange = (period, referenceDate = new Date(), specificDate = "") => {
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  let start = new Date(end)

  if (period === "specific_date") {
    const selected = specificDate || formatDateOnly(end)
    return { startDate: selected, endDate: selected }
  }

  if (period === "daily") {
    return { startDate: formatDateOnly(start), endDate: formatDateOnly(end) }
  }

  if (period === "weekly") {
    const mondayOffset = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - mondayOffset)
    return { startDate: formatDateOnly(start), endDate: formatDateOnly(end) }
  }

  if (period === "monthly") {
    start = new Date(end.getFullYear(), end.getMonth(), 1)
    return { startDate: formatDateOnly(start), endDate: formatDateOnly(end) }
  }

  if (period === "yearly") {
    start = new Date(end.getFullYear(), 0, 1)
    return { startDate: formatDateOnly(start), endDate: formatDateOnly(end) }
  }

  return { startDate: "", endDate: "" }
}

const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

const AdminReports = () => {
  const [filters, setFilters] = useState({ startDate: "", endDate: "", clientId: "", loadStatus: "all", rateType: "all", recordSource: "all" })
  const [datePeriod, setDatePeriod] = useState("all_time")
  const [specificDate, setSpecificDate] = useState(formatDateOnly(new Date()))
  const [contentView, setContentView] = useState("all")
  const [report, setReport] = useState(emptyReport)
  const [generatedAt, setGeneratedAt] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedReportRow, setSelectedReportRow] = useState(null)

  const reportPaginationKey = `${generatedAt}|${filters.startDate}|${filters.endDate}|${filters.clientId}|${filters.loadStatus}|${filters.rateType}|${filters.recordSource}`
  const revenuePagination = usePagination(report.clientRevenue || [], 10, `revenue|${reportPaginationKey}`)
  const releasePagination = usePagination(report.releaseReports || [], 10, `release|${reportPaginationKey}`)

  const loadReport = async (nextFilters = filters) => {
    try {
      setLoading(true)
      setError("")
      const { data } = await api.get("/admin/reports/yard-containers", { params: nextFilters })
      setReport(data.report || emptyReport)
      setGeneratedAt(data.generatedAt || new Date().toISOString())
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport({ startDate: "", endDate: "", clientId: "", loadStatus: "all", rateType: "all", recordSource: "all" })
  }, [])

  const rows = useMemo(
    () => [
      ["Total Containers in Yard", "All sizes", report.totalContainersInYard],
      ["Empty Container", "20 FT", report.empty?.[20] || 0],
      ["Empty Container", "40 FT", report.empty?.[40] || 0],
      ["Laden Container", "20 FT", report.laden?.[20] || 0],
      ["Laden Container", "40 FT", report.laden?.[40] || 0],
      ["Local Container", "20 FT", report.local?.[20] || 0],
      ["Local Container", "40 FT", report.local?.[40] || 0],
      ["International Container", "20 FT", report.international?.[20] || 0],
      ["International Container", "40 FT", report.international?.[40] || 0],
      ["Capacity Equivalent", "TEU", report.totalTeu || 0],
      ["Capacity Equivalent", "FEU", report.totalFeu || 0],
    ],
    [report],
  )

  const activeRange = useMemo(() => getPeriodRange(datePeriod, new Date(), specificDate), [datePeriod, specificDate])

  const periodLabel = datePeriod === "all_time"
    ? "All available records"
    : activeRange.startDate === activeRange.endDate
      ? formatPeriodDate(activeRange.startDate)
      : `${formatPeriodDate(activeRange.startDate)} to ${formatPeriodDate(activeRange.endDate)}`

  const handlePeriodChange = (period) => {
    const range = getPeriodRange(period, new Date(), specificDate)
    setDatePeriod(period)
    setFilters((current) => ({ ...current, ...range }))
  }

  const handleSpecificDateChange = (event) => {
    const value = event.target.value
    setSpecificDate(value)
    setDatePeriod("specific_date")
    setFilters((current) => ({ ...current, startDate: value, endDate: value }))
  }

  const applyFilters = () => {
    const nextFilters = { ...filters, ...getPeriodRange(datePeriod, new Date(), specificDate) }
    setFilters(nextFilters)
    loadReport(nextFilters)
  }

  const resetFilters = () => {
    const nextFilters = { startDate: "", endDate: "", clientId: "", loadStatus: "all", rateType: "all", recordSource: "all" }
    setDatePeriod("all_time")
    setSpecificDate(formatDateOnly(new Date()))
    setContentView("all")
    setFilters(nextFilters)
    loadReport(nextFilters)
  }

  const exportCsv = () => {
    const selectedClient = report.clientOptions?.find((client) => client.id === filters.clientId)?.name || "All Clients"
    const selectedContent = contentOptions.find((option) => option.value === contentView)?.label || "All Analytics"
    const selectedPeriod = periodOptions.find((option) => option.value === datePeriod)?.label || "All Time"
    const csvRows = [
      ["OneTrue Yard Container Report"],
      ["Generated", formatDateTime(generatedAt)],
      ["Content", selectedContent],
      ["Period", selectedPeriod],
      ["Date Range", periodLabel],
      ["Client", selectedClient],
      ["Container Load", filters.loadStatus === "all" ? "All" : filters.loadStatus],
      ["Rate Classification", filters.rateType === "all" ? "All" : filters.rateType],
      ["Record Source", filters.recordSource === "all" ? "All" : filters.recordSource],
    ]

    if (["all", "overview", "containers", "capacity"].includes(contentView)) {
      csvRows.push([], ["Report", "Container Size / Unit", "Quantity"], ...rows)
    }

    if (["all", "revenue"].includes(contentView)) {
      csvRows.push(
        [],
        ["Client Revenue", "Completed Releases", "Subtotal", "VAT", "Total Revenue"],
        ...(report.clientRevenue || []).map((client) => [client.clientName, client.bookingCount, client.subtotal, client.vat, client.revenue]),
      )
    }

    if (["all", "releases"].includes(contentView)) {
      csvRows.push(
        [],
        ["Release Report", "Client", "Container", "Record Source", "Load Status", "Classification", "Released At", "Subtotal", "VAT", "Recorded Revenue"],
        ...(report.releaseReports || []).map((item) => [item.reportNumber, item.clientName, item.containerNumber, item.recordSource, item.containerLoadStatus, item.rateType, formatDateTime(item.releasedAt), item.billingSubtotal, item.vatAmount, item.revenueTotal]),
      )
    }

    const csv = csvRows.map((row) => row.map(escapeCsv).join(",")).join("\n")
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
    { label: "Legacy Records", value: report.legacyContainers || 0, icon: FileText },
    { label: "Empty Containers", value: report.empty?.total || 0, icon: Container },
    { label: "Laden Containers", value: report.laden?.total || 0, icon: Boxes },
    { label: "Local Containers", value: report.local?.total || 0, icon: Warehouse },
    { label: "International", value: report.international?.total || 0, icon: Ship },
    { label: "Completed Releases", value: report.releasedContainers || 0, icon: FileText },
    { label: "Recorded Revenue", value: formatCurrency(report.totalRecordedRevenue), icon: Download },
  ]

  const showOverview = contentView === "all" || contentView === "overview"
  const showContainers = contentView === "all" || contentView === "containers"
  const showRevenue = contentView === "all" || contentView === "revenue"
  const showReleases = contentView === "all" || contentView === "releases"
  const showCapacity = contentView === "all" || contentView === "capacity"

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="card p-5 print:shadow-none">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">Analytics Module</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Yard and Revenue Analytics</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Choose the analytics content and reporting period you need instead of loading every section at once.
            </p>
            <p className="mt-2 text-xs font-bold text-slate-400">Generated: {formatDateTime(generatedAt)}</p>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" className="btn-secondary" onClick={() => loadReport()} disabled={loading}>
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

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 print:hidden">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white"><ListFilter size={17} /></span>
            <div>
              <h3 className="font-black text-slate-900">Analytics Filters</h3>
              <p className="text-xs font-semibold text-slate-500">Use a preset period or select an exact date from the calendar.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-9">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Content to Show</span>
              <select className="input" value={contentView} onChange={(event) => setContentView(event.target.value)}>
                {contentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Date Period</span>
              <select className="input" value={datePeriod} onChange={(event) => handlePeriodChange(event.target.value)}>
                {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <div className="relative z-30">
              <ModernDateInput
                label="Specific Date"
                type="date"
                name="specificDate"
                value={specificDate}
                onChange={handleSpecificDateChange}
                clearable={false}
                variant="compact"
                hint="Selecting a date switches the report to that day."
              />
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Client</span>
              <select className="input" value={filters.clientId} onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value }))}>
                <option value="">All Clients</option>
                {(report.clientOptions || []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Record Source</span>
              <select className="input" value={filters.recordSource} onChange={(event) => setFilters((current) => ({ ...current, recordSource: event.target.value }))}>
                <option value="all">All record sources</option>
                <option value="client_booking">Client booking</option>
                <option value="legacy_migration">Legacy migration</option>
                <option value="admin_manual">Admin manual</option>
              </select>
            </label>

            <ContainerClassificationFilters
              loadStatus={filters.loadStatus}
              rateType={filters.rateType}
              onLoadStatusChange={(loadStatus) => setFilters((current) => ({ ...current, loadStatus }))}
              onRateTypeChange={(rateType) => setFilters((current) => ({ ...current, rateType }))}
              selectClassName="input"
            />

            <div className="flex items-end gap-2 xl:col-span-2">
              <button type="button" className="btn-primary min-w-0 flex-1" onClick={applyFilters} disabled={loading}>
                <FileText size={17} /> Apply
              </button>
              <button type="button" className="btn-secondary" onClick={resetFilters} disabled={loading}>
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
            <CalendarRange size={15} /> {datePeriod === "specific_date" ? "Specific Date" : "Active period"}: {periodLabel}
          </div>
        </div>

        <div className="mt-4"><Alert type="error">{error}</Alert></div>
      </div>

      {showOverview && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <LayoutDashboard size={18} className="text-emerald-700" />
            <h3 className="font-black text-slate-900">Overview</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card flex items-center gap-4 p-5 print:border print:shadow-none">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white"><Icon size={22} /></div>
                <div><div className="text-2xl font-black text-slate-950">{value}</div><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showContainers && (
        <section>
          <div className="mb-3">
            <h3 className="font-black text-slate-900">Container Breakdown</h3>
            <p className="text-sm font-semibold text-slate-500">Current yard inventory separated by condition and classification.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <ReportSection title="Total Empty Container" counts={report.empty} />
            <ReportSection title="Laden Container" counts={report.laden} />
            <ReportSection title="Local Container" counts={report.local} />
            <ReportSection title="International Container" counts={report.international} />
          </div>
        </section>
      )}

      {showRevenue && (
        <div className="card overflow-hidden print:border print:shadow-none">
          <div className="border-b border-slate-200 p-5">
            <h3 className="text-lg font-black text-slate-950">Revenue by Client</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Ranks clients by revenue recorded when container release was completed within the selected period.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Completed Releases</th>
                  <th className="px-5 py-3">Subtotal</th>
                  <th className="px-5 py-3">VAT</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                  <th className="px-5 py-3 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {revenuePagination.paginatedItems.map((client, index) => {
                  const rank = (revenuePagination.page - 1) * revenuePagination.pageSize + index + 1
                  return (
                  <tr key={client.clientId}>
                    <td className="px-5 py-4 font-black text-slate-500">#{rank}</td>
                    <td className="px-5 py-4 font-black text-slate-950">{client.clientName}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{client.bookingCount}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{formatCurrency(client.subtotal)}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{formatCurrency(client.vat)}</td>
                    <td className="px-5 py-4 text-right font-black text-emerald-700">{formatCurrency(client.revenue)}</td>
                    <td className="px-5 py-4 print:hidden">
                      <TableCrudActions
                        recordLabel={`${client.clientName || "client"} revenue report`}
                        onView={() => setSelectedReportRow({ type: "client", rank, data: client })}
                        editDisabled
                        deleteDisabled
                        editLabel="Generated report summaries cannot be edited"
                        deleteLabel="Generated report summaries cannot be deleted"
                      />
                    </td>
                  </tr>
                  )
                })}
                {(report.clientRevenue || []).length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-5 py-10 text-center font-bold text-slate-500">
                      No completed release revenue found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="print:hidden">
            <Pagination {...revenuePagination} pageSizeOptions={[10]} />
          </div>
        </div>
      )}

      {showReleases && (
        <div className="card overflow-hidden print:border print:shadow-none">
          <div className="border-b border-slate-200 p-5">
            <h3 className="text-lg font-black text-slate-950">Release Container History</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Generated automatically after Gate-Out completion. Each row is the final revenue snapshot for one released container.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Report</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Container</th>
                  <th className="px-5 py-3">Load / Market</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Released</th>
                  <th className="px-5 py-3">Billing Days</th>
                  <th className="px-5 py-3">Subtotal</th>
                  <th className="px-5 py-3">VAT</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                  <th className="px-5 py-3 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {releasePagination.paginatedItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 font-black text-emerald-700">{item.reportNumber}</td>
                    <td className="px-5 py-4 font-black text-slate-950">{item.clientName}</td>
                    <td className="px-5 py-4"><div className="font-black text-slate-900">{item.containerNumber}</div><div className="text-xs font-semibold text-slate-400">{item.containerSize} FT</div></td>
                    <td className="px-5 py-4"><ContainerClassificationBadges loadStatus={item.containerLoadStatus} rateType={item.rateType} compact /></td>
                    <td className="px-5 py-4">{item.recordSource === "legacy_migration" ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700">Legacy</span> : <span className="text-xs font-bold text-slate-500">Client Booking</span>}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{formatDateTime(item.releasedAt)}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{item.billingDays || 0}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{formatCurrency(item.billingSubtotal)}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{formatCurrency(item.vatAmount)}</td>
                    <td className="px-5 py-4 text-right font-black text-emerald-700">{formatCurrency(item.revenueTotal)}</td>
                    <td className="px-5 py-4 print:hidden">
                      <TableCrudActions
                        recordLabel={`release report ${item.reportNumber || item.id || "record"}`}
                        onView={() => setSelectedReportRow({ type: "release", data: item })}
                        editDisabled
                        deleteDisabled
                        editLabel="Completed release reports are immutable and cannot be edited"
                        deleteLabel="Completed release reports are immutable and cannot be deleted"
                      />
                    </td>
                  </tr>
                ))}
                {(report.releaseReports || []).length === 0 && (
                  <tr>
                    <td colSpan="11" className="px-5 py-10 text-center font-bold text-slate-500">
                      No release completion reports found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="print:hidden">
            <Pagination {...releasePagination} pageSizeOptions={[10]} />
          </div>
        </div>
      )}

      {showCapacity && (
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
      )}

      {selectedReportRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-row-details-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Read-only report</p>
                <h2 id="report-row-details-title" className="mt-1 text-2xl font-black text-slate-950">
                  {selectedReportRow.type === "client" ? "Client Revenue Details" : "Release Report Details"}
                </h2>
              </div>
              <ModalCloseButton onClick={() => setSelectedReportRow(null)} label="Close report details" />
            </header>

            {selectedReportRow.type === "client" ? (
              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <ReportDetail label="Rank" value={`#${selectedReportRow.rank}`} />
                <ReportDetail label="Client" value={selectedReportRow.data.clientName} />
                <ReportDetail label="Completed Releases" value={selectedReportRow.data.bookingCount || 0} />
                <ReportDetail label="Subtotal" value={formatCurrency(selectedReportRow.data.subtotal)} />
                <ReportDetail label="VAT" value={formatCurrency(selectedReportRow.data.vat)} />
                <ReportDetail label="Total Revenue" value={formatCurrency(selectedReportRow.data.revenue)} emphasis />
              </div>
            ) : (
              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <ReportDetail label="Report Number" value={selectedReportRow.data.reportNumber} />
                <ReportDetail label="Released At" value={formatDateTime(selectedReportRow.data.releasedAt)} />
                <ReportDetail label="Client" value={selectedReportRow.data.clientName} />
                <ReportDetail label="Container" value={selectedReportRow.data.containerNumber} />
                <ReportDetail label="Container Size" value={`${selectedReportRow.data.containerSize || "-"} FT`} />
                <ReportDetail label="Load Status" value={selectedReportRow.data.containerLoadStatus || "Unknown"} capitalize />
                <ReportDetail label="Classification" value={selectedReportRow.data.rateType} capitalize />
                <ReportDetail label="Billing Days" value={selectedReportRow.data.billingDays || 0} />
                <ReportDetail label="Subtotal" value={formatCurrency(selectedReportRow.data.billingSubtotal)} />
                <ReportDetail label="VAT" value={formatCurrency(selectedReportRow.data.vatAmount)} />
                <ReportDetail label="Recorded Revenue" value={formatCurrency(selectedReportRow.data.revenueTotal)} emphasis />
              </div>
            )}

            <footer className="flex justify-end border-t border-slate-200 p-5">
              <button type="button" className="btn-secondary" onClick={() => setSelectedReportRow(null)}>
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
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

const ReportDetail = ({ label, value, capitalize = false, emphasis = false }) => (
  <div className={`rounded-2xl border p-4 ${emphasis ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
    <p className={`text-xs font-black uppercase tracking-wide ${emphasis ? "text-emerald-600" : "text-slate-400"}`}>{label}</p>
    <p className={`mt-1 break-words font-black ${emphasis ? "text-emerald-800" : "text-slate-800"} ${capitalize ? "capitalize" : ""}`}>
      {value || value === 0 ? value : "-"}
    </p>
  </div>
)

const CapacityCard = ({ label, description, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <div className="text-xs font-black uppercase tracking-widest text-slate-500">{description}</div>
    <div className="mt-2 text-3xl font-black text-slate-950">{value} {label}</div>
  </div>
)

export default AdminReports
