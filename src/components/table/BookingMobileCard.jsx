import { Check, Clock3, XCircle } from "lucide-react";

import { getBookingCardProgress, isStoppedBookingStatus } from "./bookingCardProgress";

const statusTone = (status) => {
  if (["rejected", "cancelled", "payment_rejected"].includes(status))
    return "bg-red-50 text-red-800";
  if (["pending_admin_approval", "gate_out_requested", "gate_out_reversal_requested"].includes(status))
    return "bg-amber-100 text-amber-900";
  if (["completed_gate_out_done", "stored_in_assigned_area", "paid_approved"].includes(status))
    return "bg-emerald-50 text-emerald-800";
  return "bg-blue-50 text-blue-800";
};

const paymentTone = (status) => {
  if (["unpaid", "payment_rejected", "additional_payment_required"].includes(status))
    return "text-red-700";
  if (status === "paid_approved") return "text-emerald-700";
  if (["payment_submitted", "payment_under_review"].includes(status))
    return "text-amber-800";
  return "text-slate-800";
};

const formatDateTime = (value) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const BookingProgress = ({ booking, context }) => {
  const { steps } = getBookingCardProgress(booking, context);
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Booking progress">
      {steps.map(({ label, state }) => (
        <li key={label} aria-current={state === "active" ? "step" : undefined} className="min-w-0">
          <span
            aria-hidden="true"
            className={`block h-1 rounded-full ${
              state === "done" ? "bg-emerald-600" :
              state === "active" ? "bg-amber-500" :
              state === "stopped" ? "bg-red-500" : "bg-slate-200"
            }`}
          />
          <span className={`mt-1.5 block break-words text-[10px] leading-4 min-[380px]:text-[11px] ${
            state === "done" ? "font-medium text-slate-600" :
            state === "active" ? "font-semibold text-amber-800" :
            state === "stopped" ? "font-semibold text-red-700" : "text-slate-500"
          }`}>{label}</span>
        </li>
      ))}
    </ol>
  );
};

export const BookingCardDetail = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
    <dd className="mt-1 break-words text-xs font-semibold leading-5 text-slate-800">{children ?? "Not provided"}</dd>
  </div>
);

/**
 * Compact, presentation-only booking card shared by operational workflows,
 * tracking, and history. Menus and footer actions are passed in unchanged.
 */
const BookingMobileCard = ({
  booking,
  statusLabel,
  billingLabel,
  onOpen,
  actions,
  footer,
  progressContext = "auto",
  children,
}) => {
  const status = booking?.status || "pending_admin_approval";
  const { outbound } = getBookingCardProgress(booking, progressContext);
  const dateOut = outbound && booking?.outDate;
  const dateValue = dateOut || booking?.inDate || booking?.expectedArrivalDate;
  const dateLabel = dateOut ? "Date out" : booking?.inDate ? "Date in" : "Expected gate in";
  const deferred = booking?.status === "approved_area_assigned" && booking?.loloPaymentStage === "gate_out";
  const paymentLabel = deferred ? "Deferred to Gate-Out" : billingLabel || booking?.billingStatus?.replaceAll("_", " ") || "Not recorded";
  const payTone = deferred ? "text-blue-700" : paymentTone(booking?.billingStatus);
  const yardArea = booking?.assignedAreaName || booking?.assignedArea?.name || "Unassigned";
  const sizeLabel = booking?.containerSize ? `${booking.containerSize} ft` : "Size unknown";
  const shippingLine = booking?.shippingLine?.trim() || "Not provided";

  return (
    <article className="min-w-0 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_3px_16px_-7px_rgba(15,23,42,0.25)]">
      <div className="px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className={`inline-flex max-w-[85%] items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold leading-4 ${statusTone(status)}`}>
            {isStoppedBookingStatus(status) ? <XCircle size={13} className="shrink-0" /> : status === "completed_gate_out_done" ? <Check size={13} className="shrink-0" /> : <Clock3 size={13} className="shrink-0" />}
            <span className="break-words">{statusLabel || status.replaceAll("_", " ")}</span>
          </span>
          {actions && <div className="-mr-1 -mt-1 shrink-0" onClick={(event) => event.stopPropagation()}>{actions}</div>}
        </div>

        {onOpen ? (
          <button type="button" onClick={onOpen} className="mt-3 block max-w-full break-all text-left text-[21px] font-bold leading-6 tracking-[0.025em] text-slate-950 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            {booking?.containerNumber || "Container not assigned"}
          </button>
        ) : (
          <h3 className="mt-3 break-all text-[21px] font-bold leading-6 tracking-[0.025em] text-slate-950">{booking?.containerNumber || "Container not assigned"}</h3>
        )}
        <p className="mt-1 break-all font-mono text-[11px] tracking-wide text-slate-600">{booking?.bookingReference || "Reference pending"}</p>
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-1 max-w-full break-words text-[12px] font-semibold text-slate-900">{booking?.clientName || "Client"}</span>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{sizeLabel}</span>
          <span className="min-w-0 max-w-full break-words rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">Line: <strong className="font-semibold">{shippingLine}</strong></span>
        </div>
        <BookingProgress booking={booking} context={progressContext} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 min-[380px]:grid-cols-3">
        <BookingCardDetail label="Payment"><span className={`inline-flex items-start gap-1.5 ${payTone}`}><span aria-hidden="true" className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current`} />{paymentLabel}</span></BookingCardDetail>
        <BookingCardDetail label={dateLabel}>{formatDateTime(dateValue)}</BookingCardDetail>
        <div className="col-span-2 min-[380px]:col-span-1"><BookingCardDetail label="Yard area">{yardArea}{booking?.assignedSlotNumber ? <span className="mt-0.5 block text-[11px] font-normal text-slate-600">Slot {booking.assignedSlotNumber}</span> : null}</BookingCardDetail></div>
      </dl>

      {children && <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 px-4 py-3">{children}</dl>}
      {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3">{footer}</footer>}
    </article>
  );
};

export default BookingMobileCard;
