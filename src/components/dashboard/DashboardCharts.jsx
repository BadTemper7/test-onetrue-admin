import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const clampNumber = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

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
    occupancyRate: point.occupancyRate == null ? null : Math.max(clampNumber(point.occupancyRate), 0),
    occupiedSlots: clampNumber(point.occupiedSlots),
    revenue: clampNumber(point.revenue),
  }));

const card =
  "overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-16px_rgba(15,23,42,0.14)]";

const axisTick = { fill: "#94a3b8", fontSize: 11 };

const EmptyChart = () => (
  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
    No activity recorded for this period. Pick a wider range to see data.
  </div>
);

const ChartShell = ({ title, description, summary, legend, children }) => (
  <section className={card}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-yard-navy">{title}</h3>
        <p className="mt-0.5 max-w-md text-sm text-slate-500">{description}</p>
      </div>
      {summary && (
        <div className="rounded-xl bg-slate-50 px-3.5 py-2 text-right">
          <p className="text-xs text-slate-500">{summary.label}</p>
          <p className="text-base font-semibold tabular-nums text-yard-navy">
            {summary.value}
          </p>
        </div>
      )}
      {legend && (
        <ul className="flex gap-4 text-xs font-medium text-slate-600">
          {legend.map(({ label, color }) => (
            <li key={label} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: color }}
              />
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
    <div className="mt-6 h-[280px] w-full min-w-0">{children}</div>
  </section>
);

const ChartTooltip = ({ active, payload, label, format }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 font-semibold text-slate-900">{label}</p>
      {payload.map((item) => (
        <p
          key={item.dataKey}
          className="flex items-center gap-2 text-slate-600"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: item.color }}
          />
          {item.name}
          <span className="ml-auto pl-4 font-semibold tabular-nums text-slate-900">
            {format(item.value)}
          </span>
        </p>
      ))}
    </div>
  );
};

// Returns an element (not a component) so recharts accepts it inside <defs>.
const gradient = (id, color) => (
  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
  </linearGradient>
);

const Grid = () => <CartesianGrid stroke="#eef2f7" vertical={false} />;

const xAxis = (
  <XAxis
    dataKey="label"
    tick={axisTick}
    tickLine={false}
    axisLine={false}
    tickMargin={10}
    minTickGap={28}
    interval="preserveStartEnd"
  />
);

const cursor = { stroke: "#cbd5e1", strokeDasharray: "4 4" };
const activeDot = (color) => ({
  r: 5,
  fill: "#fff",
  stroke: color,
  strokeWidth: 2.5,
});

const MovementChart = ({ data }) => {
  const uid = useId().replace(/:/g, "");
  const chartData = normalizeData(data);
  const green = "#059669";
  const blue = "#2563eb";

  return (
    <ChartShell
      title="Container movement"
      description="Gate-In completions compared with fully completed releases."
      legend={[
        { label: "Received", color: green },
        { label: "Released", color: blue },
      ]}
    >
      {!chartData.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              {gradient(`${uid}-in`, green)}
              {gradient(`${uid}-out`, blue)}
            </defs>
            {Grid()}
            {xAxis}
            <YAxis
              allowDecimals={false}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={cursor}
              content={
                <ChartTooltip
                  format={(value) => Math.round(clampNumber(value))}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="containersReceived"
              name="Received"
              stroke={green}
              strokeWidth={2.5}
              fill={`url(#${uid}-in)`}
              dot={false}
              activeDot={activeDot(green)}
            />
            <Area
              type="monotone"
              dataKey="containersReleased"
              name="Released"
              stroke={blue}
              strokeWidth={2.5}
              fill={`url(#${uid}-out)`}
              dot={false}
              activeDot={activeDot(blue)}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
};

const OccupancyChart = ({ data, averageRate }) => {
  const uid = useId().replace(/:/g, "");
  const chartData = normalizeData(data);
  const amber = "#d97706";


  return (
    <ChartShell
      title="Occupancy rate"
      description="Time-weighted physical yard-slot utilization from confirmed Gate-In and release events."
      summary={{ label: "Backend period average", value: averageRate == null ? "N/A" : `${Number(averageRate).toFixed(2)}%` }}
    >
      {!chartData.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
          >
            <defs>{gradient(`${uid}-occ`, amber)}</defs>
            {Grid()}
            {xAxis}
            <YAxis
              domain={[0, (dataMax) => Math.max(100, Math.ceil(dataMax / 25) * 25)]}
              tickFormatter={(value) => `${value}%`}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              cursor={cursor}
              content={
                <ChartTooltip
                  format={(value) => `${clampNumber(value).toFixed(2)}%`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="occupancyRate"
              name="Occupancy rate"
              stroke={amber}
              strokeWidth={2.5}
              fill={`url(#${uid}-occ)`}
              dot={false}
              activeDot={activeDot(amber)}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
};

const RevenueChart = ({ data }) => {
  const uid = useId().replace(/:/g, "");
  const chartData = normalizeData(data);
  const teal = "#0f766e";
  const periodTotal = chartData.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <ChartShell
      title="Recorded revenue"
      description="Total of approved Gate-In and Gate-Out payments for completed releases."
      summary={{ label: "Period total", value: formatPeso(periodTotal) }}
    >
      {!chartData.length ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          >
            <defs>{gradient(`${uid}-rev`, teal)}</defs>
            {Grid()}
            {xAxis}
            <YAxis
              tickFormatter={formatCompact}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              cursor={cursor}
              content={<ChartTooltip format={formatPeso} />}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={teal}
              strokeWidth={2.5}
              fill={`url(#${uid}-rev)`}
              dot={false}
              activeDot={activeDot(teal)}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartShell>
  );
};

const DashboardCharts = ({ data = [], occupancyAverageRate = null }) => (
  <div className="grid gap-4 xl:grid-cols-2">
    <div className="xl:col-span-2">
      <RevenueChart data={data} />
    </div>
    <MovementChart data={data} />
    <OccupancyChart data={data} averageRate={occupancyAverageRate} />
  </div>
);

export default DashboardCharts;
