import { useEffect, useId, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  FiAlertTriangle,
  FiBox,
  FiCalendar,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiLogIn,
  FiLogOut,
  FiMapPin,
  FiPackage,
  FiStar,
  FiTruck,
  FiUserCheck,
} from "react-icons/fi";
import DashboardPeriodControls from "../components/dashboard/DashboardPeriodControls";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import RegistrationEmailUsage from "../components/dashboard/RegistrationEmailUsage";
import Pagination from "../components/table/Pagination";
import TableLoadingRow from "../components/table/TableLoadingRow";
import { useAuthStore } from "../stores/authStore";
import { useAdminDashboardStore } from "../stores/adminDashboardStore";
import { usePagination } from "../hooks/usePagination";

const periodLabel = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom: "Custom range",
};

const periodText = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
  yearly: "this year",
  custom: "for the selected dates",
};

const releasedLabel = {
  daily: "Containers released today",
  weekly: "Containers released this week",
  monthly: "Containers released this month",
  yearly: "Containers released this year",
  custom: "Containers released",
};

const card =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-16px_rgba(15,23,42,0.14)]";

const tones = {
  emerald: { chip: "bg-emerald-50 text-emerald-700", color: "#059669" },
  blue: { chip: "bg-blue-50 text-blue-700", color: "#2563eb" },
  teal: { chip: "bg-teal-50 text-teal-700", color: "#0f766e" },
  amber: { chip: "bg-amber-50 text-amber-700", color: "#d97706" },
};

const statusStyle = (status) => {
  if (["active", "verified"].includes(status))
    return { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  if (["pending", "resubmitted"].includes(status))
    return { pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" };
  if (["rejected", "suspended", "inactive"].includes(status))
    return { pill: "bg-red-50 text-red-700", dot: "bg-red-500" };
  return { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");

// FIX: Round to whole numbers for physical containers
const formatWholeNumber = (value) =>
  Math.round(Number(value) || 0).toLocaleString("en-US");

const formatPercent = (value) =>
  value == null ? "N/A" : `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

const formatDateRange = (range) => {
  if (!range?.start || !range?.end) return "";
  const formatter = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
  return `${formatter.format(new Date(range.start))} to ${formatter.format(new Date(range.end))}`;
};

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

const occupancyTone = (rate) =>
  rate == null ? { bar: "bg-slate-300", text: "text-slate-500" } : rate >= 90
    ? { bar: "bg-red-500", text: "text-red-700" }
    : rate >= 70
      ? { bar: "bg-amber-500", text: "text-amber-700" }
      : { bar: "bg-emerald-500", text: "text-emerald-700" };

const Sparkline = ({ data, dataKey, color }) => {
  const id = useId().replace(/:/g, "");
  if (!data?.length) return <div className="h-12" />;
  return (
    <div className="h-12 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  helper,
  tone = "emerald",
  series,
  dataKey,
  size = "lg",
}) => {
  const t = tones[tone];
  const valueSize =
    size === "lg" ? "text-4xl" : size === "md" ? "text-3xl" : "text-xl";
  return (
    <article className={`${card} flex flex-col p-5`}>
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.chip}`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
      <p
        className={`mt-4 break-words font-semibold tracking-tight text-yard-navy tabular-nums ${valueSize}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{helper}</p>
      {series && (
        <div className="-mx-1 mt-auto pt-4">
          <Sparkline data={series} dataKey={dataKey} color={t.color} />
        </div>
      )}
    </article>
  );
};

const SectionHeading = ({ title, description }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
    <h2 className="text-base font-semibold text-yard-navy">{title}</h2>
    <p className="text-xs text-slate-500">{description}</p>
  </div>
);

const MiniStat = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-yard-navy">
      {value}
    </p>
  </div>
);

// UPDATED: Added tooltip and clamped width
const OccupancyBar = ({ label, rate, tooltipText }) => {
  const tone = occupancyTone(rate);
  // Clamp the visual width to 100% so the bar doesn't break the container
  const barWidth = rate == null ? 0 : Math.min(100, Math.max(0, rate));
  return (
    <div title={tooltipText}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={`font-semibold tabular-nums ${tone.text}`}>
          {formatPercent(rate)}
        </span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={barWidth}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const {
    period,
    customRange,
    metrics,
    bookingSummary,
    recentAccounts,
    pendingClients,
    range,
    trend,
    loading,
    error,
    setPeriod,
    applyCustomRange,
    fetchDashboard,
  } = useAdminDashboardStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const refresh = () => fetchDashboard();
    window.addEventListener("otli:realtime", refresh);
    return () => window.removeEventListener("otli:realtime", refresh);
  }, [fetchDashboard]);

  const accountPagination = usePagination(recentAccounts, 5);
  const periodDescription = periodText[period] || "today";

  const series = useMemo(
    () =>
      (trend?.series || []).map((point) => ({
        ...point,
        containersReceived: Number(point.containersReceived) || 0,
        containersReleased: Number(point.containersReleased) || 0,
        revenue: Number(point.revenue) || 0,
      })),
    [trend],
  );

  // Occupancy values are calculated by the dashboard API, never from the chart points.
  const currentOccupancy = metrics.currentOccupancyRate == null ? null : Number(metrics.currentOccupancyRate);
  const averageOccupancy = metrics.averageOccupancyRate == null ? null : Number(metrics.averageOccupancyRate);
  const occupancyQuality = metrics.occupancyQuality;
  const overstaying = Number(metrics.overstayingContainers || 0);
  const topCustomer = metrics.topCustomer;

  const quickActions = [
    {
      label: "Verify clients",
      icon: FiUserCheck,
      path: "/accounts/client-verification",
    },
    { label: "Bookings", icon: FiPackage, path: "/operations/tracking" },
    { label: "Gate-in", icon: FiTruck, path: "/operations/gate-in" },
    { label: "Yard inventory", icon: FiMapPin, path: "/yard/inventory" },
    {
      label: "Verify payments",
      icon: FiCreditCard,
      path: "/billing/payment-verification",
    },
  ];

  const queues = [
    {
      label: "Pending bookings",
      value: bookingSummary.pending || 0,
      icon: FiPackage,
    },
    {
      label: "Gate-out requests",
      value: bookingSummary.gateOutRequested || 0,
      icon: FiTruck,
    },
    {
      label: "Pending client accounts",
      value: pendingClients || 0,
      icon: FiUserCheck,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero + period toolbar */}
      <div>
        <section className="relative overflow-hidden rounded-3xl bg-yard-navy px-6 pb-20 pt-8 text-white md:px-10 md:pt-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl"
          />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200 ring-1 ring-white/10">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live yard data
                </p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                  Welcome back, {user?.name || "Administrator"}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                  Container movement, yard utilization, overstays and revenue in
                  one view.
                </p>
              </div>
              {range && (
                <div className="inline-flex items-center gap-2 self-start rounded-xl bg-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 ring-1 ring-white/10">
                  <FiCalendar className="h-3.5 w-3.5 text-emerald-300" />
                  {periodLabel[period] || "Daily"}: {formatDateRange(range)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.path}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <action.icon className="h-4 w-4 text-emerald-300" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className={`${card} relative z-10 -mt-12 mx-4 p-4 md:mx-8`}>
          <DashboardPeriodControls
            period={period}
            customRange={customRange}
            loading={loading}
            onPresetChange={setPeriod}
            onApplyCustomRange={applyCustomRange}
            onRefresh={() => fetchDashboard()}
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Period metrics */}
      <section className="space-y-4" aria-label="Period performance">
        <SectionHeading
          title={`Performance ${periodDescription}`}
          description="Follows the selected reporting period."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={FiDollarSign}
            tone="teal"
            label="Revenue"
            value={formatCurrency(metrics.revenue)}
            helper="Approved Gate-In and Gate-Out payments from completed releases"
            series={series}
            dataKey="revenue"
            size="md"
          />
          <KpiCard
            icon={FiLogIn}
            tone="emerald"
            label="Containers received"
            value={formatNumber(metrics.containersReceived)}
            helper="Gate-In completed"
            series={series}
            dataKey="containersReceived"
          />
          <KpiCard
            icon={FiLogOut}
            tone="blue"
            label={releasedLabel[period] || "Containers released"}
            value={formatNumber(metrics.containersReleased)}
            helper="Release report generated"
            series={series}
            dataKey="containersReleased"
          />
          <KpiCard
            icon={FiStar}
            tone="amber"
            label="Top customer"
            value={topCustomer?.name || "No completed transactions"}
            helper={
              topCustomer
                ? `${formatNumber(topCustomer.transactionCount)} transaction(s), ${formatCurrency(topCustomer.revenue)}`
                : `No customer activity ${periodDescription}`
            }
            size="sm"
          />
        </div>
      </section>

      {/* Live status */}
      <section className="space-y-4" aria-label="Live yard status">
        <SectionHeading
          title="Live yard status"
          description="Always current, regardless of the reporting period."
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <article className={`${card} p-6`}>
            {/* Align items to baseline for perfect typographic alignment */}
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-yard-navy">
                  Yard capacity
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {formatWholeNumber(metrics.totalYardCapacity)} configured
                  slots
                </p>
              </div>
              <span
                className={`text-3xl font-semibold tabular-nums ${occupancyTone(currentOccupancy).text}`}
              >
                {formatPercent(currentOccupancy)}
              </span>
            </div>

            <div className="mt-6 space-y-5">
              <OccupancyBar
                label="Current allocated occupancy"
                rate={currentOccupancy}
                tooltipText={`Current occupancy: ${formatPercent(currentOccupancy)} (${formatWholeNumber(metrics.currentInventory)} containers inside)`}
              />
              {/* Note: If the average exceeds 100%, it means the yard was over capacity for a period. */}
              <OccupancyBar
                label={`${periodLabel[period] || "Daily"} physical occupancy average`}
                rate={averageOccupancy}
                tooltipText={`Average occupancy ${periodDescription}: ${formatPercent(averageOccupancy)}. Derived from confirmed Gate-In to release intervals using the current configured block capacity.`}
              />
              {occupancyQuality && occupancyQuality.reliability !== "verified_from_records" && (
                <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                  {occupancyQuality.reliability === "no_capacity"
                    ? "Occupancy is unavailable because no active yard capacity is configured."
                    : occupancyQuality.reliability === "estimated"
                      ? "Historical occupancy uses estimated entry dates for migrated records and today's configured yard capacity."
                      : "Historical occupancy is partial: some older records lack confirmed event dates or yard blocks. The denominator uses today's configured capacity."}
                </p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Current utilization includes reserved slots. The period average measures confirmed physical Gate-In to release time.
              </p>
              {occupancyQuality?.overCapacityBuckets > 0 && (
                <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
                  Historical records imply utilization above 100%. Review yard capacity and missing or inconsistent Gate-Out records.
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {/* Use formatWholeNumber to prevent fractional slots */}
              <MiniStat
                icon={FiBox}
                label="Inside the yard"
                value={formatWholeNumber(metrics.currentInventory)}
              />
              <MiniStat
                icon={FiMapPin}
                label="Available slots"
                value={formatWholeNumber(metrics.availableYardCapacity)}
              />
              <MiniStat
                icon={FiPackage}
                label="Total slots"
                value={formatWholeNumber(metrics.totalYardCapacity)}
              />
            </div>

            {/* Conditionally render icon and copy based on overstaying state */}
            <div
              className={`mt-4 flex items-start gap-3 rounded-xl p-4 ${
                overstaying > 0
                  ? "bg-amber-50 text-amber-900"
                  : "bg-emerald-50 text-emerald-900"
              }`}
            >
              {overstaying > 0 ? (
                <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <div className="text-sm">
                <p className="font-semibold">
                  {overstaying > 0
                    ? `${formatWholeNumber(overstaying)} overstaying container${overstaying === 1 ? "" : "s"}`
                    : "All containers are within their allowed time"}
                </p>
                <p className="mt-0.5 text-xs opacity-80">
                  {overstaying > 0
                    ? "Gate-Out approved, but physical release is not yet completed."
                    : "No pending Gate-Out approvals or un-released containers."}
                </p>
              </div>
            </div>
          </article>

          <article className={`${card} p-6`}>
            <h3 className="text-lg font-semibold text-yard-navy">
              Needs your attention
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Open items waiting on an admin.
            </p>
            <ul className="mt-5 divide-y divide-slate-100">
              {queues.map(({ label, value, icon: Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-yard-green">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-600">
                    {label}
                  </span>
                  <span
                    className={`min-w-[2.5rem] rounded-full px-3 py-1 text-center text-sm font-semibold tabular-nums ${
                      value > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {formatNumber(value)}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* Trends */}
      <section className="space-y-4" aria-label="Trends">
        <SectionHeading
          title="Trends"
          description="Each point is one interval of the reporting period."
        />
        <DashboardCharts data={trend?.series || []} occupancyAverageRate={metrics.averageOccupancyRate} />
      </section>

      {/* Accounts + email */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-yard-navy">
                Recent accounts
              </h2>
              <p className="text-sm text-slate-500">
                Latest admin and client records
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {pendingClients || 0} pending
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="otli-data-table w-full min-w-[640px] text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && recentAccounts.length === 0 && (
                  <TableLoadingRow
                    colSpan={4}
                    rows={5}
                    label="Loading recent accounts"
                  />
                )}
                {accountPagination.paginatedItems.map((item) => {
                  const style = statusStyle(item.status);
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                            {initials(item.name)}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">
                        {item.email}
                      </td>
                      <td className="px-6 py-3.5 capitalize text-slate-500">
                        {item.userType}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style.pill}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                          />
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && recentAccounts.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No account records yet. New registrations will appear
                      here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination {...accountPagination} />
        </section>

        <RegistrationEmailUsage />
      </div>
    </div>
  );
};

export default Dashboard;
