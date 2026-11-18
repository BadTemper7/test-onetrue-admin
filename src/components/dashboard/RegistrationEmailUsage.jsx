import { useCallback, useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiMail,
  FiRefreshCw,
} from "react-icons/fi";
import { api, getApiError } from "../../lib/api";

const fmt = (value) => Number(value ?? 0).toLocaleString("en-US");

const formatNextSlot = (value) => {
  if (!value) return "Available now";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "Check again shortly";
  return `${time.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })} PHT`;
};

const Ring = ({ remaining, limit, blocked }) => {
  const size = 84;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = limit > 0 ? Math.min(1, Math.max(0, remaining / limit)) : 0;
  const color = blocked ? "#d97706" : ratio < 0.2 ? "#d97706" : "#059669";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-lg font-semibold leading-none tabular-nums text-yard-navy">
            {fmt(remaining)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">left</p>
        </div>
      </div>
    </div>
  );
};

const QuotaRow = ({ label, stats }) => {
  if (!stats) return null;
  const percent =
    stats.limit > 0 ? Math.min(100, (stats.used / stats.limit) * 100) : 0;
  const isFull = stats.remaining <= 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-800">
          {fmt(stats.used)} / {fmt(stats.limit)}
          <span
            className={`ml-2 font-medium ${isFull ? "text-amber-700" : "text-emerald-700"}`}
          >
            {fmt(stats.remaining)} left
          </span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${label} email allowance used`}
        aria-valuenow={stats.used}
        aria-valuemin={0}
        aria-valuemax={stats.limit}
      >
        <div
          className={`h-full rounded-full transition-all ${isFull ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Dashboard-only, read-only monitoring. Never sends email or overrides limits.
 * Fetches independently so a slow mail-status query cannot block other stats.
 */
const RegistrationEmailUsage = () => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshNumber, setRefreshNumber] = useState(0);

  const refresh = useCallback(
    () => setRefreshNumber((number) => number + 1),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const getUsage = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/email-usage", {
          signal: controller.signal,
          timeout: 12000,
        });
        if (controller.signal.aborted) return;
        setUsage(data);
        setError("");
      } catch (failure) {
        if (controller.signal.aborted) return;
        setUsage(null); // Never display stale allowance as current during an outage.
        setError(getApiError(failure));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    getUsage();
    return () => controller.abort();
  }, [refreshNumber]);

  // Light polling for a single MongoDB record. Only runs on this dashboard.
  useEffect(() => {
    const interval = window.setInterval(refresh, 60000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const daily = usage?.windows?.day;
  const today = usage?.calendarToday;
  const blocked = usage && !usage.canSendNow;

  return (
    <section
      className="self-start rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-16px_rgba(15,23,42,0.14)]"
      aria-label="Registration email usage"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <FiMail className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-yard-navy">
              Registration emails
            </h2>
            <p className="text-sm text-slate-500">OTP sending allowance</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          aria-label="Refresh email usage"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <div>
            Email usage is unavailable. {error} Use Refresh to try again.
          </div>
        </div>
      ) : !usage ? (
        <div className="mt-5 space-y-3" aria-live="polite">
          <div className="h-20 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
          <div className="h-3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          <span className="sr-only">Checking the email allowance</span>
        </div>
      ) : (
        <>
          <div
            className={`mt-5 flex items-center gap-4 rounded-xl p-4 ${blocked ? "bg-amber-50" : "bg-slate-50"}`}
          >
            <Ring
              remaining={daily?.remaining ?? 0}
              limit={daily?.limit ?? 0}
              blocked={blocked}
            />
            <div className="min-w-0">
              <div
                className={`flex items-center gap-1.5 text-sm font-semibold ${
                  blocked ? "text-amber-800" : "text-emerald-700"
                }`}
              >
                {blocked ? <FiAlertCircle /> : <FiCheckCircle />}
                {blocked ? "Temporarily rate limited" : "OTPs can be sent"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {blocked
                  ? `Next slot: ${formatNextSlot(usage.nextAvailableAt)}`
                  : `${fmt(daily?.remaining)} of ${fmt(daily?.limit)} rolling 24h slots available.`}
              </p>
              {usage.firstRollingSlotAt && (
                <p className="mt-1 text-xs text-slate-500">
                  First slot returns {formatNextSlot(usage.firstRollingSlotAt)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-sky-800">
                Reserved today (Philippine time)
              </p>
              <p className="text-[11px] text-sky-700">
                Resets at 12:00 AM PHT{today?.date ? `, ${today.date}` : ""}
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-sky-900">
              {today ? fmt(today.used) : "-"}
            </p>
          </div>

          <div className="mt-5 space-y-3.5">
            <QuotaRow label="Last minute" stats={usage.windows?.minute} />
            <QuotaRow label="Last hour" stats={usage.windows?.hour} />
            <QuotaRow label="Last 24 hours" stats={daily} />
          </div>

          <details className="group mt-5 border-t border-slate-100 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
              How this is counted
              <FiChevronDown className="transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-500">
              {usage.mailbox && (
                <p>
                  Sending account:{" "}
                  <span className="font-semibold text-slate-700">
                    {usage.mailbox}
                  </span>
                </p>
              )}
              <p>
                These are app sending slots, not Hostinger's live quota. Slots
                return 24 hours after each reserved attempt. The Today counter
                resets at Philippine midnight, but it does not reset the rolling
                24-hour limit.
              </p>
              {usage.rollingByLocalDay?.length > 0 && (
                <p>
                  Rolling-window reservations by PH date:{" "}
                  {usage.rollingByLocalDay
                    .map(({ date, used }) => `${date}: ${fmt(used)}`)
                    .join(", ")}
                </p>
              )}
              <p>
                Usage counts reserved OTP attempts, including failed or
                uncertain sends, not confirmed deliveries. Emails sent outside
                OneTrue are not included.
              </p>
              <p>
                Safely reclaimable unused slots:{" "}
                <strong>{fmt(usage.reclaimableUnused)}</strong>. Older
                unclassified reservations held for safety:{" "}
                <strong>{fmt(usage.unclassifiedReservations)}</strong>. Super
                Admin can review reconciliation in Reports, Email Monitoring.
              </p>
              <p>
                To check your actual mailbox quota: Hostinger, Emails,
                Mailboxes, View limits.
              </p>
            </div>
          </details>

          <p className="mt-3 text-[11px] text-slate-400">
            Updated {new Date(usage.measuredAt).toLocaleString("en-PH")}
          </p>
        </>
      )}
    </section>
  );
};

export default RegistrationEmailUsage;
