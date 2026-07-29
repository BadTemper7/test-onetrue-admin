import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const clampNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const formatCompact = (value) =>
  new Intl.NumberFormat("en-US", {
    notation: Math.abs(Number(value) || 0) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);

const formatPeso = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    notation: Math.abs(Number(value) || 0) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(Number(value) || 0) >= 100000 ? 1 : 2,
  }).format(Number(value) || 0);

const normalizeData = (data = []) =>
  data.map((point, index) => ({
    ...point,
    chartKey: point.key || `${point.label || "point"}-${index}`,
    label: point.label || `Point ${index + 1}`,
    containersReceived: clampNumber(point.containersReceived),
    containersReleased: clampNumber(point.containersReleased),
    occupancyRate: Math.min(Math.max(clampNumber(point.occupancyRate), 0), 100),
    occupiedSlots: clampNumber(point.occupiedSlots),
    revenue: clampNumber(point.revenue),
  }));

const EmptyChart = () => (
  <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-400">
    No dashboard activity for this period.
  </div>
);

const ChartShell = ({ title, description, summary, children }) => (
  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-yard-navy">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {summary && <div className="text-sm font-bold text-yard-green">{summary}</div>}
    </div>
    <div className="mt-5 h-[300px] w-full min-w-0">{children}</div>
  </section>
);

const tooltipStyle = {
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
  fontSize: "12px",
};

const axisTick = {
  fill: "#64748b",
  fontSize: 11,
};

const MovementChart = ({ data = [] }) => {
  const chartData = normalizeData(data);

  return (
    <ChartShell
      title="Container movement"
      description="Gate-In completions compared with fully completed releases."
    >
      {!chartData.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#0f172a", fontWeight: 700 }}
              formatter={(value, name) => [Math.round(clampNumber(value)), name]}
            />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
            <Line
              type="monotone"
              dataKey="containersReceived"
              name="Received"
              stroke="#059669"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="containersReleased"
              name="Released"
              stroke="#2563eb"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
};

const OccupancyChart = ({ data = [] }) => {
  const chartData = normalizeData(data);

  return (
    <ChartShell
      title="Occupancy rate"
      description="Historical TEU slot utilization for each point in the selected period."
    >
      {!chartData.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: -4, bottom: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#0f172a", fontWeight: 700 }}
              formatter={(value) => [`${clampNumber(value).toFixed(2)}%`, "Occupancy rate"]}
            />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
            <Line
              type="monotone"
              dataKey="occupancyRate"
              name="Occupancy rate"
              stroke="#d97706"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
};

const RevenueChart = ({ data = [] }) => {
  const chartData = normalizeData(data);
  const periodTotal = chartData.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <ChartShell
      title="Recorded revenue"
      description="Revenue recognized when Gate-Out release completion reports were generated."
      summary={`Period total: ${formatPeso(periodTotal)}`}
    >
      {!chartData.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#cbd5e1" }}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#0f172a", fontWeight: 700 }}
              formatter={(value) => [formatPeso(value), "Revenue"]}
            />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#0f766e"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2, fill: "#ffffff" }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
};

const DashboardCharts = ({ data = [] }) => (
  <div className="grid gap-6 xl:grid-cols-2">
    <MovementChart data={data} />
    <OccupancyChart data={data} />
    <div className="xl:col-span-2">
      <RevenueChart data={data} />
    </div>
  </div>
);

export default DashboardCharts;
