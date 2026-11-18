import FilterDropdownPortal from "../../components/table/FilterDropdownPortal";
import { TableToolbar, TableSearchField, TableFilterButton } from "../../components/table/TableToolbar";
import { useEffect, useRef, useState } from "react"
import { RefreshCw, ShieldCheck  } from "lucide-react"
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton"
import TableCrudActions from "../../components/table/TableCrudActions"
import { api, getApiError } from "../../lib/api"
import TableLoadingRow from "../../components/table/TableLoadingRow"

const actionClass = {
  add: "bg-emerald-50 text-emerald-700",
  edit: "bg-blue-50 text-blue-700",
  delete: "bg-red-50 text-red-700",
}

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const filterRef = useRef(null)
  const [modules, setModules] = useState([])
  const [filters, setFilters] = useState({
    search: "",
    module: "all",
    action: "all",
  })
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedLog, setSelectedLog] = useState(null)

  const loadLogs = async () => {
    try {
      setLoading(true)
      setError("")
      const { data } = await api.get("/admin/audit-logs", {
        params: { ...filters, page, limit: 25 },
      })
      setLogs(data.logs || [])
      setModules(data.modules || [])
      setPages(data.pagination?.pages || 1)
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [page, filters.module, filters.action])

  return (
    <div className="space-y-5">
      <section className="otli-module-hero otli-module-standalone rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <ShieldCheck />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-950">Audit Logs</h1>
            <p className="text-sm font-semibold text-slate-500">
              Every successful Add, Edit, and Delete action in the admin system is recorded.
            </p>
          </div>
        </div>
      </section>

      {error && <Alert type="error" message={error} />}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <TableToolbar>
            <TableSearchField ariaLabel="Search audit events" placeholder="Search user, record, description..." value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && loadLogs()} />
            <div className="relative shrink-0" ref={filterRef}>
              <TableFilterButton open={showFilters} onClick={() => setShowFilters((current) => !current)} count={Number(filters.module !== "all") + Number(filters.action !== "all")} />
              <FilterDropdownPortal open={showFilters} anchorRef={filterRef} onClose={() => setShowFilters(false)} className="w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">Filter audit events</h4>
                <label className="block text-xs font-semibold text-slate-600">Module
                  <select className="input mt-1 w-full" value={filters.module} onChange={(event) => {
                    setPage(1); setFilters((current) => ({ ...current, module: event.target.value }));
                  }}>
                    <option value="all">All modules</option>{modules.map((module) => <option key={module} value={module}>{module}</option>)}
                  </select>
                </label>
                <label className="mt-3 block text-xs font-semibold text-slate-600">Action
                  <select className="input mt-1 w-full" value={filters.action} onChange={(event) => {
                    setPage(1); setFilters((current) => ({ ...current, action: event.target.value }));
                  }}>
                    <option value="all">All actions</option><option value="add">Add</option><option value="edit">Edit</option><option value="delete">Delete</option>
                  </select>
                </label>
                <button type="button" className="mt-3 text-xs font-semibold text-emerald-700" onClick={() => { setPage(1); setFilters((current) => ({ ...current, module: "all", action: "all" })); }}>Reset filters</button>
              </FilterDropdownPortal>
            </div>
            <button type="button" onClick={loadLogs} className="otli-table-toolbar-filter" aria-label="Apply search" disabled={loading}>
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Search</span>
            </button>
          </TableToolbar>
        </div>

        <div className="overflow-x-auto">
          <table className="otli-data-table w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date / Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && logs.length === 0 && <TableLoadingRow colSpan={7} rows={6} actionColumn label="Loading audit logs" />}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {new Date(log.createdAt).toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-800">{log.userName}</p>
                    <p className="text-xs text-slate-500">{log.userEmail}</p>
                  </td>
                  <td className="px-4 py-4 capitalize text-slate-700">{log.module}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                        actionClass[log.action] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500">
                    {log.recordId || "-"}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{log.description}</td>
                  <td className="px-4 py-4">
                    <TableCrudActions
                      recordLabel={`audit log ${log.id || "record"}`}
                      onView={() => setSelectedLog(log)}
                      editDisabled
                      deleteDisabled
                      editLabel="Audit logs are immutable and cannot be edited"
                      deleteLabel="Audit logs are immutable and cannot be deleted"
                    />
                  </td>
                </tr>
              ))}

              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-14 text-center text-slate-500">
                    No audit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 p-4">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(value - 1, 1))}
          >
            Previous
          </button>
          <span className="text-sm font-bold text-slate-500">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= pages}
            onClick={() => setPage((value) => Math.min(value + 1, pages))}
          >
            Next
          </button>
        </div>
      </section>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-log-details-title"
            className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
                  Read-only record
                </p>
                <h2 id="audit-log-details-title" className="mt-1 text-2xl font-black text-slate-950">
                  Audit Log Details
                </h2>
              </div>
              <ModalCloseButton onClick={() => setSelectedLog(null)} label="Close audit log details" />
            </header>

            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <AuditDetail label="Date / Time" value={new Date(selectedLog.createdAt).toLocaleString("en-PH")} />
              <AuditDetail label="Action" value={selectedLog.action} capitalize />
              <AuditDetail label="User" value={selectedLog.userName} />
              <AuditDetail label="Email" value={selectedLog.userEmail} />
              <AuditDetail label="Module" value={selectedLog.module} capitalize />
              <AuditDetail label="Record ID" value={selectedLog.recordId || "-"} />
              <div className="sm:col-span-2">
                <AuditDetail label="Description" value={selectedLog.description || "-"} />
              </div>
            </div>

            <footer className="flex justify-end border-t border-slate-200 p-5">
              <button type="button" className="btn-secondary" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}

const AuditDetail = ({ label, value, capitalize = false }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`mt-1 break-words font-bold text-slate-800 ${capitalize ? "capitalize" : ""}`}>
      {value || "-"}
    </p>
  </div>
)

export default AdminAuditLogs
