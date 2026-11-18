import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiRefreshCw } from "react-icons/fi";
import ModernDateInput from "../ModernDateInput";

const OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

// All calendar dates are interpreted by the API in Asia/Manila.
const manilaToday = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const dateOffset = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const DashboardPeriodControls = ({
  period, customRange, loading, onPresetChange, onApplyCustomRange, onRefresh,
}) => {
  const today = manilaToday();
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [draftRange, setDraftRange] = useState(() => ({
    startDate: customRange?.startDate || dateOffset(today, -6),
    endDate: customRange?.endDate || today,
  }));
  useEffect(() => setSelectedPeriod(period), [period]);
  useEffect(() => {
    if (customRange?.startDate && customRange?.endDate) {
      setDraftRange({ startDate: customRange.startDate, endDate: customRange.endDate });
    }
  }, [customRange]);

  const customSelected = selectedPeriod === "custom";
  const isValid = useMemo(() => Boolean(
    draftRange.startDate && draftRange.endDate &&
    draftRange.startDate <= draftRange.endDate && draftRange.endDate <= today,
  ), [draftRange, today]);
  const hasPendingChanges = customSelected && (
    period !== "custom" ||
    customRange?.startDate !== draftRange.startDate ||
    customRange?.endDate !== draftRange.endDate
  );
  const changePeriod = (value) => {
    setSelectedPeriod(value);
    if (value !== "custom") onPresetChange(value);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div role="group" aria-label="Dashboard period" className="inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1">
            {OPTIONS.map(({ value, label }) => {
              const active = selectedPeriod === value;
              return (
                <button key={value} type="button" aria-pressed={active} disabled={loading}
                  onClick={() => changePeriod(value)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yard-green/40 disabled:cursor-not-allowed disabled:opacity-60 ${active ? "bg-white text-yard-navy shadow-sm" : "text-slate-500 hover:text-yard-navy"}`}>
                  {label}
                </button>
              );
            })}
          </div>
          {customSelected && (
            <>
              <div className="min-w-[155px] flex-1 sm:flex-none">
                <ModernDateInput label="Start date" type="date" value={draftRange.startDate}
                  onChange={(event) => setDraftRange((current) => ({ ...current, startDate: event.target.value }))}
                  max={draftRange.endDate < today ? draftRange.endDate : today}
                  clearable={false} disabled={loading} placeholder="From" variant="compact" />
              </div>
              <div className="min-w-[155px] flex-1 sm:flex-none">
                <ModernDateInput label="End date" type="date" value={draftRange.endDate}
                  onChange={(event) => setDraftRange((current) => ({ ...current, endDate: event.target.value }))}
                  min={draftRange.startDate} max={today}
                  clearable={false} disabled={loading} placeholder="To" variant="compact" />
              </div>
              <button type="button" onClick={() => onApplyCustomRange(draftRange)}
                disabled={loading || !isValid || !hasPendingChanges}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-yard-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                <FiCheck /> Apply range
              </button>
            </>
          )}
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || hasPendingChanges}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      {customSelected && hasPendingChanges && (
        <p role="status" className="text-xs font-medium text-slate-600">
          {isValid ? "Click Apply range to update all period-based metrics and charts." : "Choose a valid range ending on or before today."}
        </p>
      )}
    </div>
  );
};
export default DashboardPeriodControls;
