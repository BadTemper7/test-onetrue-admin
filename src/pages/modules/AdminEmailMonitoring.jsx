import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity, FiAlertCircle, FiCheckCircle, FiClock, FiDownload,
  FiMail, FiRefreshCw, FiShield, FiXCircle,
} from "react-icons/fi";
import { api, getApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { Link } from "react-router-dom";
import RegistrationEmailUsage from "../../components/dashboard/RegistrationEmailUsage";

const DAY_MS = 86400000;
const todayInManila = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const isoDay = (date) => date.toISOString().slice(0, 10);
const asUtcDate = (day) => new Date(`${day}T00:00:00.000Z`);
const addDays = (day, amount) => isoDay(new Date(asUtcDate(day).getTime() + amount * DAY_MS));
const dateRangeFor = (period, anchor, customFrom, customTo) => {
  if (period === "custom") return { from: customFrom, to: customTo };
  if (period === "daily") return { from: anchor, to: anchor };
  const date = asUtcDate(anchor);
  if (period === "weekly") {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    const from = addDays(anchor, -daysSinceMonday);
    return { from, to: addDays(from, 6) };
  }
  const from = `${anchor.slice(0, 7)}-01`;
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const to = isoDay(new Date(Date.UTC(year, month, 0)));
  return { from, to };
};
const number = (value) => Number(value || 0).toLocaleString("en-PH");
const dateTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
};
const eventNames = {
  reserved: "Sending slot reserved",
  smtp_accepted: "Accepted by SMTP",
  smtp_rejected: "Rejected by SMTP",
  smtp_unconfirmed: "Delivery unconfirmed",
  rate_limited: "Rate limited",
};
const eventColors = {
  reserved: "bg-slate-100 text-slate-700",
  smtp_accepted: "bg-emerald-50 text-emerald-700",
  smtp_rejected: "bg-red-50 text-red-700",
  smtp_unconfirmed: "bg-amber-50 text-amber-800",
  rate_limited: "bg-orange-50 text-orange-800",
};
const metrics = [
  { key: "attempted", title: "Sending slots used", icon: FiMail, tone: "text-blue-700", panel: "bg-blue-50" },
  { key: "accepted", title: "SMTP accepted", icon: FiCheckCircle, tone: "text-emerald-700", panel: "bg-emerald-50" },
  { key: "rejected", title: "SMTP rejected", icon: FiXCircle, tone: "text-red-700", panel: "bg-red-50" },
  { key: "unconfirmed", title: "Unconfirmed", icon: FiAlertCircle, tone: "text-amber-800", panel: "bg-amber-50" },
  { key: "rateLimited", title: "Rate-limit blocks", icon: FiClock, tone: "text-orange-700", panel: "bg-orange-50" },
];

const DailyActivity = ({ daily, range }) => {
  const series = useMemo(() => {
    if (!range?.from || !range?.to) return [];
    const events = new Map((daily || []).map((day) => [day.date, day]));
    const days = [];
    for (let day = range.from; day <= range.to && days.length < 93; day = addDays(day, 1)) {
      const value = events.get(day) || {};
      days.push({ date: day, attempted: Number(value.attempted || 0), accepted: Number(value.accepted || 0) });
    }
    return days;
  }, [daily, range]);
  const max = Math.max(1, ...series.map((item) => Math.max(item.attempted, item.accepted)));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Daily registration email activity">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Daily activity</h2>
          <p className="text-xs text-slate-500">Sending-slot reservations and provider-accepted OTP emails, by Philippine date</p>
        </div>
        <div className="flex gap-4 text-xs font-medium text-slate-600">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-blue-400" />Slots used</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Accepted</span>
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex h-40 items-end gap-2 border-b border-slate-200 pb-2" style={{ minWidth: Math.max(320, series.length * 28) }}>
          {series.map((item) => (
            <div key={item.date} className="group flex h-full min-w-5 flex-1 flex-col items-center justify-end gap-1" title={`${item.date}: ${item.attempted} used, ${item.accepted} accepted`}>
              <div className="flex h-[120px] w-full items-end justify-center gap-[2px]">
                <div className="w-2 max-w-[48%] rounded-t bg-blue-400" style={{ height: `${Math.max(item.attempted ? 3 : 0, (item.attempted / max) * 100)}%` }} />
                <div className="w-2 max-w-[48%] rounded-t bg-emerald-500" style={{ height: `${Math.max(item.accepted ? 3 : 0, (item.accepted / max) * 100)}%` }} />
              </div>
              <span className="w-full truncate text-center font-mono text-[9px] text-slate-500">{item.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const AdminEmailMonitoring = () => {
  const [period, setPeriod] = useState("daily");
  const [anchor, setAnchor] = useState(todayInManila);
  const [customFrom, setCustomFrom] = useState(todayInManila);
  const [customTo, setCustomTo] = useState(todayInManila);
  const [eventType, setEventType] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [reclaiming, setReclaiming] = useState(false);
  const [reclaimMessage, setReclaimMessage] = useState("");
  const [reclaimError, setReclaimError] = useState("");
  const isSuperAdmin = useAuthStore((state) => state.user?.role === "super_admin");
  const range = useMemo(() => dateRangeFor(period, anchor, customFrom, customTo), [period, anchor, customFrom, customTo]);
  const validRange = Boolean(range.from && range.to && range.from <= range.to &&
    (asUtcDate(range.to).getTime() - asUtcDate(range.from).getTime()) / DAY_MS < 93);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    if (!validRange) {
      setReport(null);
      setError("Choose a valid date range (up to 93 days).");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/admin/email-monitoring", {
          params: { ...range, ...(eventType !== "all" ? { type: eventType } : {}), page, limit: 25 },
          timeout: 15000,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setReport(data);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setReport(null);
          setError(getApiError(failure));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [range, eventType, page, refreshKey, validRange]);

  const changeFilter = (setter, value) => {
    setter(value);
    setPage(1);
    setExportError("");
  };
  const exportCsv = async () => {
    if (!validRange || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const { data } = await api.get("/admin/email-monitoring/export", {
        params: { ...range, ...(eventType !== "all" ? { type: eventType } : {}) },
        timeout: 60000,
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `registration-email-${range.from}-to-${range.to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setExportError(getApiError(failure));
    } finally {
      setExporting(false);
    }
  };

  const reclaimUnused = async () => {
    if (reclaiming || !isSuperAdmin) return;
    const confirmed = window.confirm(
      "Reclaim ONLY OTP reservations proven not to have reached SMTP, and older than 15 minutes? " +
      "Sent, uncertain, and old unclassified reservations will NOT be removed. This does not increase Hostinger's actual quota."
    );
    if (!confirmed) return;
    setReclaiming(true);
    setReclaimError("");
    setReclaimMessage("");
    try {
      const { data } = await api.post("/admin/email-usage/reconcile", {}, { timeout: 15000 });
      setReclaimMessage(data.message);
      refresh();
    } catch (error) {
      setReclaimError(getApiError(error));
    } finally {
      setReclaiming(false);
    }
  };

  const summary = report?.summary || {};
  const history = report?.history;
  const rows = history?.rows || [];
  return (
    <div className="space-y-5">
      <header className="otli-module-hero otli-module-standalone rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><FiMail size={22} /></span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Email Monitoring</h1>
              <p className="mt-1 text-sm text-slate-500">Registration OTP activity and historical sending reports</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            <FiShield /> Monitoring • Admin access
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">Historical events start from this feature’s deployment. Times and reporting dates use Philippine time (Asia/Manila). SMTP acceptance does not guarantee inbox delivery.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Email report filters">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">
            Reporting period
            <select className="input" value={period} onChange={(e) => changeFilter(setPeriod, e.target.value)}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option><option value="custom">Custom date range</option>
            </select>
          </label>
          {period === "custom" ? (
            <>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">From (PH time)
                <input type="date" className="input" value={customFrom} onChange={(e) => changeFilter(setCustomFrom, e.target.value)} />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">To (PH time)
                <input type="date" className="input" value={customTo} onChange={(e) => changeFilter(setCustomTo, e.target.value)} />
              </label>
            </>
          ) : (
            <label className="space-y-1.5 text-xs font-semibold text-slate-600">
              {period === "daily" ? "Select date" : "Select a date in the period"}
              <input type="date" className="input" value={anchor} onChange={(e) => changeFilter(setAnchor, e.target.value)} />
            </label>
          )}
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">Activity type
            <select className="input" value={eventType} onChange={(e) => changeFilter(setEventType, e.target.value)}>
              <option value="all">All email events</option>
              {Object.entries(eventNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">{validRange ? `${range.from} to ${range.to} (PHT)` : "Please choose a valid date range"}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={loading} onClick={refresh}><FiRefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</button>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={exporting || !validRange} onClick={exportCsv}><FiDownload size={15} />{exporting ? "Exporting..." : "Export CSV"}</button>
          </div>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {exportError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">CSV export failed: {exportError}</div>}
      {loading && !report ? <div role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading email history...</div> : null}

      {report && !error && (
        <>
          <section className="otli-kpi-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Registration email metrics">
            {metrics.map(({ key, title, icon: Icon, tone, panel }) => (
              <article key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-600">{title}</span><span className={`rounded-lg p-2 ${panel} ${tone}`}><Icon /></span></div>
                <p className="mt-3 text-3xl font-extrabold tabular-nums text-slate-900">{number(summary[key])}</p>
              </article>
            ))}
          </section>
          <DailyActivity daily={report.daily} range={report.range} />
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Registration email event history">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
              <div><h2 className="text-lg font-bold text-slate-900">Activity history</h2><p className="text-xs text-slate-500">Recent events first • Recipient addresses are masked</p></div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><FiActivity /> {number(history?.totalRecords)} history records</div>
            </div>
            <div className="overflow-x-auto">
              <table className="otli-data-table w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                  <th className="px-4 py-3">Date / Time (PHT)</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Recipient</th><th className="px-4 py-3 text-right">Count</th><th className="px-4 py-3">Error code</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">{dateTime(item.at)}</td>
                      <td className="px-4 py-3"><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${eventColors[item.eventType] || "bg-slate-100"}`}>{eventNames[item.eventType] || item.eventType}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.flow === "resend_otp" ? "Resend OTP" : "Registration OTP"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.recipientMasked || "Not stored"}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{number(item.count)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.errorCode || "—"}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>No email events recorded for these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-600">Page {history?.page || 1} of {Math.max(1, history?.totalPages || 1)} • {number(history?.totalRecords)} records</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                <button type="button" className="btn-secondary" disabled={loading || page >= (history?.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Email slot recovery">
        <h2 className="text-lg font-bold text-slate-900">Registration continuity</h2>
        <p className="mt-2 text-sm text-slate-600">
          Clients do not need an OTP to submit for pending manual review. Admin staff can also create
          a pending account through Client Verification without sending email.
        </p>
        <Link to="/accounts/client-verification" className="mt-3 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          Go to Client Verification / Add Client
        </Link>
        {isSuperAdmin && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-slate-800">Reclaim unused email slots</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Only newly tracked reservations that never reached SMTP and have been unused for at least 15 minutes can be released.
              Sent emails, uncertain sends, and the older 100 unclassified reservations cannot be cleared safely.
              This button does not add sending capacity or bypass Hostinger's mailbox limit.
            </p>
            <button type="button" onClick={reclaimUnused} disabled={reclaiming}
              className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50">
              {reclaiming ? "Checking unused slots..." : "Reclaim Safely Unused Slots"}
            </button>
            {reclaimMessage && <p role="status" className="mt-2 text-sm text-emerald-700">{reclaimMessage}</p>}
            {reclaimError && <p role="alert" className="mt-2 text-sm text-red-700">{reclaimError}</p>}
          </div>
        )}
      </section>
      <RegistrationEmailUsage key={refreshKey} />
      <p className="px-1 text-xs leading-relaxed text-slate-500">The date-filtered report shows app-recorded OTP activity, not confirmed inbox delivery or Hostinger's full mailbox usage. An SMTP timeout may mean the provider accepted a message without returning confirmation. Today’s reservation count resets at midnight Philippine time, but the sending allowance follows Hostinger’s rolling 24-hour window. The totals will not always match, and a new day does not guarantee an available slot.</p>
    </div>
  );
};

export default AdminEmailMonitoring;
