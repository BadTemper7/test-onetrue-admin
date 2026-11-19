import { TableToolbar, TableSearchField, TableFilterButton } from "../../components/table/TableToolbar";
import FilterDropdownPortal from "../../components/table/FilterDropdownPortal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Eye,
  Inbox,
  MapPinned,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Truck,
  Warehouse,
 } from "lucide-react";
import Alert from "../../components/Alert";
import ModalCloseButton from "../../components/ui/ModalCloseButton";
import Pagination from "../../components/table/Pagination";
import TableActionButton from "../../components/table/TableActionButton";
import TableCrudActions from "../../components/table/TableCrudActions";
import WorkflowDecisionPanel from "../../components/ui/WorkflowDecisionPanel";
import ContainerClassificationBadges from "../../components/ui/ContainerClassificationBadges";
import ContainerClassificationFilters from "../../components/ui/ContainerClassificationFilters";
import AvailableSlotPicker from "../../components/ui/AvailableSlotPicker";
import { api, getApiError, resolveFileUrl } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { hasModulePermission } from "../../lib/permissions";
import { printBookingDocument } from "../../lib/printDocument";
import TableLoadingRow from "../../components/table/TableLoadingRow";
import BookingMobileCard, { BookingCardDetail } from "../../components/table/BookingMobileCard"

const statusLabels = {
  pending_admin_approval: "Pending Admin Approval",
  approved_area_assigned: "Approved / Area Assigned",
  rejected: "Rejected",
  gate_in_approved: "Gate-In Approved",
  stored_in_assigned_area: "Stored in Assigned Area",
  gate_out_requested: "Gate-Out Requested",
  gate_out_approved: "Gate-Out Approved",
  gate_out_reversal_requested: "Gate-Out Reversal Requested",
  completed_gate_out_done: "Completed / Gate-Out Done",
  cancelled: "Cancelled",
};

const toDateTimeLocalString = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:00`;
};

const billingLabels = {
  unpaid: "Unpaid",
  payment_submitted: "Payment Submitted",
  payment_under_review: "Payment Under Review",
  payment_rejected: "Payment Rejected",
  additional_payment_required: "Additional Payment Required",
  paid_approved: "Paid / Approved",
};

const moduleConfig = {
  preAdvice: {
    badge: "Pre-Advice Verification",
    title: "Booking Pre-Advice Verification",
    description:
      "Shows only bookings pending admin approval. Verify the booking details, check yard capacity, and assign a yard area before approval.",
    icon: ClipboardList,
    defaultStatus: "pending_admin_approval",
    defaultBillingStatus: "all",
    primarySection: "approval",
    queueTitle: "Bookings Pending Pre-Advice Verification",
  },
  gateIn: {
    badge: "Gate-In Module",
    title: "Gate-In Verification and Inspection",
    description:
      "Shows only approved and area-assigned containers ready for Gate-In inspection and approval.",
    icon: Truck,
    defaultStatus: "approved_area_assigned",
    defaultBillingStatus: "all",
    primarySection: "gateIn",
    queueTitle: "Bookings Ready for Gate-In",
  },
  billing: {
    badge: "Payment Verification Module",
    title: "Payment Verification and Approval",
    description:
      "Review the system-generated payment reference, amount, payment proof, and approve or reject the client payment submission.",
    icon: Banknote,
    defaultStatus: "all",
    defaultBillingStatus: "payment_under_review",
    primarySection: "billing",
    queueTitle: "Payments Under Review",
  },
  gateOut: {
    badge: "Gate-Out Module",
    title: "Gate-Out Request Approval",
    description:
      "Review client Gate-Out requests, process eligible cash payments, verify approved online payments, and approve the Gate-Out request before release.",
    icon: PackageCheck,
    defaultStatus: "gate_out_requested",
    defaultBillingStatus: "all",
    primarySection: "gateOut",
    queueTitle: "Gate-Out Requests",
  },
  releaseContainer: {
    badge: "Release Container Module",
    title: "Release Container",
    description:
      "Release containers only after the Gate-Out request has been approved. Complete the physical release and review containers that have already left the yard.",
    icon: Truck,
    defaultStatus: "all",
    defaultBillingStatus: "all",
    primarySection: "release",
    queueTitle: "Containers Ready for Release",
  },
};

/* -------------------------------------------------------------------------- */
/*  Status tones                                                              */
/*  neutral = no action yet, pending = waiting on staff, info = in progress,  */
/*  success = done / paid, danger = rejected / cancelled, action = needs a    */
/*  decision or extra payment.                                                */
/* -------------------------------------------------------------------------- */

const TONES = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  action: "bg-violet-50 text-violet-800 ring-violet-200",
};

const STATUS_TONE = {
  pending_admin_approval: "pending",
  approved_area_assigned: "info",
  gate_in_approved: "info",
  stored_in_assigned_area: "success",
  gate_out_requested: "pending",
  gate_out_approved: "info",
  gate_out_reversal_requested: "action",
  completed_gate_out_done: "success",
  rejected: "danger",
  cancelled: "danger",
  unpaid: "neutral",
  payment_submitted: "pending",
  payment_under_review: "pending",
  payment_rejected: "danger",
  additional_payment_required: "action",
  paid_approved: "success",
};

const StatusBadge = ({ status, label }) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONES[STATUS_TONE[status] || "neutral"]}`}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    {label || status || "-"}
  </span>
);

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                        */
/* -------------------------------------------------------------------------- */

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

// Compact date for dense table rows. The full value stays in a title tooltip.
const formatShort = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// One money format everywhere: PHP 1,500.00
const money = (value) =>
  `PHP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getBookingInDate = (booking = {}) =>
  booking.inDate || booking.expectedArrivalDate;
const getBookingOutDate = (booking = {}) => booking.outDate;

const ONLINE_PAYMENT_TYPES = new Set(["bank", "ewallet"]);

const getPaymentTypeName = (booking = {}) =>
  String(booking.paymentTypeSnapshot?.type || "")
    .trim()
    .toLowerCase();

const hasExistingOnlinePayment = (booking = {}) => {
  if (
    !["payment_submitted", "payment_under_review"].includes(
      booking.billingStatus,
    )
  )
    return false;
  const paymentType = getPaymentTypeName(booking);
  const hasOnlineProof =
    Array.isArray(booking.paymentProofs) && booking.paymentProofs.length > 0;
  return ONLINE_PAYMENT_TYPES.has(paymentType) || hasOnlineProof;
};

const hasApprovedPayment = (booking = {}) =>
  booking.billingStatus === "paid_approved";

const getCashPaymentDisabledReason = (booking = {}) => {
  const isGateInPayment =
    booking.status === "approved_area_assigned" &&
    booking.loloPaymentStage !== "gate_out";
  const isGateOutPayment = ["gate_out_requested", "gate_out_approved"].includes(
    booking.status,
  );

  if (
    booking.status === "approved_area_assigned" &&
    booking.loloPaymentStage === "gate_out"
  ) {
    return "LOLO payment is configured for Gate-Out for this booking. No Gate-In payment is required.";
  }

  if (!isGateInPayment && !isGateOutPayment) {
    return "Cash payment is available only for Gate-In LOLO when configured for Gate-In, or an active Gate-Out balance.";
  }

  if (
    isGateInPayment &&
    booking.billingStatus === "paid_approved" &&
    Number(booking.paymentBalanceDue || 0) <= 0
  ) {
    return "Cash payment is disabled because the Gate-In LOLO transaction is already paid.";
  }

  // Once the Gate-Out transaction is fully paid / approved, payment is locked.
  // Release Container must use that approved Gate-Out payment and must not
  // create or request another payment during physical release.
  if (
    isGateOutPayment &&
    booking.billingStatus === "paid_approved" &&
    Number(booking.paymentBalanceDue || 0) <= 0
  ) {
    return "Gate-Out payment is already paid / approved. No additional payment is required before release.";
  }

  if (hasExistingOnlinePayment(booking)) {
    return "Cash payment is disabled while an online payment is under review.";
  }

  if (isGateOutPayment && !booking.outDate) {
    return "Cash payment is unavailable until the Date Out is set.";
  }

  if (Number(booking.billingSubtotal || booking.billingTotal || 0) <= 0) {
    return isGateInPayment
      ? "Cash payment is unavailable until Gate-In Lift On / Lift Off billing is computed."
      : "Cash payment is unavailable until Gate-Out billing has been computed.";
  }

  return "";
};

const getRequiredYardCapacity = (containerSize, yardContainerSize) => {
  const bookingSize = Number(containerSize) || 20;
  const yardSize = Number(yardContainerSize) || 20;
  if (yardSize === 20) return bookingSize === 40 ? 2 : 1;
  return bookingSize === 20 ? 0.5 : 1;
};

const blockHasCapacity = (block, booking) => {
  if (!block || !booking) return false;
  return (
    Number(block.availableSlots || 0) >=
    getRequiredYardCapacity(booking.containerSize, block.containerSize)
  );
};

/* -------------------------------------------------------------------------- */
/*  Shared UI building blocks                                                 */
/* -------------------------------------------------------------------------- */

// Keeps Escape / scroll-lock correct when one modal opens on top of another
// (for example the cash modal opened from the booking modal).
const modalStack = [];
let scrollLocks = 0;
let previousBodyOverflow = "";

const Modal = ({
  title,
  eyebrow,
  subtitle,
  badges,
  onClose,
  children,
  footer,
  size = "max-w-6xl",
  zIndex = "z-[80]",
  closeOnBackdrop = false,
}) => {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = Symbol("modal");
    const previouslyFocused = document.activeElement;
    modalStack.push(id);
    if (scrollLocks === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLocks += 1;

    if (
      dialogRef.current &&
      !dialogRef.current.contains(document.activeElement)
    )
      dialogRef.current.focus();

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (modalStack[modalStack.length - 1] !== id) return;
      onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = modalStack.indexOf(id);
      if (index >= 0) modalStack.splice(index, 1);
      scrollLocks = Math.max(scrollLocks - 1, 0);
      if (scrollLocks === 0)
        document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function")
        previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4`}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget)
          onCloseRef.current?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={`flex max-h-[100dvh] w-full ${size} flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:max-h-[92vh] sm:rounded-3xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold text-emerald-700">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-0.5 truncate text-xl font-bold text-slate-950">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
            )}
            {badges && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {badges}
              </div>
            )}
          </div>
          <ModalCloseButton onClick={onClose} label="Close dialog" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-4px_12px_-8px_rgba(15,23,42,0.25)]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

// A visible "what is still missing" list so disabled buttons are never silent.
const ChecklistPanel = ({ items, title = "Requirements" }) => {
  const remaining = items.filter((item) => !item.ok).length;
  return (
    <div
      className={`rounded-2xl border p-3 ${remaining === 0 ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"}`}
    >
      <p className="text-xs font-semibold text-slate-600">
        {title}{" "}
        <span className="font-medium text-slate-400">
          {remaining === 0 ? "• all met" : `• ${remaining} remaining`}
        </span>
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-2 ${item.ok ? "text-emerald-700" : "text-slate-600"}`}
          >
            {item.ok ? (
              <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
            ) : (
              <Circle
                size={16}
                className="shrink-0 text-slate-400"
                aria-hidden="true"
              />
            )}
            <span className="font-medium">
              {item.label}
              <span className="sr-only">
                {item.ok ? " (done)" : " (not done)"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const WORKFLOW_STEPS = [
  "Pre-Advice",
  "Gate-In",
  "Stored",
  "Gate-Out",
  "Released",
];

const getWorkflowStepIndex = (status) =>
  ({
    pending_admin_approval: 0,
    approved_area_assigned: 1,
    gate_in_approved: 2,
    stored_in_assigned_area: 2,
    gate_out_requested: 3,
    gate_out_approved: 3,
    gate_out_reversal_requested: 3,
    completed_gate_out_done: 4,
  })[status] ?? -1;

const WorkflowStepper = ({ status }) => {
  const current = getWorkflowStepIndex(status);
  if (current < 0) return null;
  const finished = status === "completed_gate_out_done";
  return (
    <ol
      className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-slate-50 px-4 py-3"
      aria-label="Booking progress"
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const done = index < current || finished;
        const active = index === current && !finished;
        return (
          <li
            key={step}
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : active ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500" : "bg-slate-200 text-slate-500"}`}
            >
              {done ? <Check size={14} aria-hidden="true" /> : index + 1}
            </span>
            <span
              className={`truncate text-xs ${active ? "font-bold text-slate-900" : done ? "font-semibold text-slate-600" : "font-medium text-slate-400"}`}
            >
              {step}
            </span>
            {index < WORKFLOW_STEPS.length - 1 && (
              <span
                className={`hidden h-px flex-1 sm:block ${done ? "bg-emerald-300" : "bg-slate-200"}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

const FilterTabs = ({ label, options, value, onChange }) => (
  <div
    role="tablist"
    aria-label={label}
    className="flex flex-wrap gap-2 border-b border-slate-200 p-4"
  >
    {options.map(([optionValue, optionLabel]) => {
      const selected = value === optionValue;
      return (
        <button
          key={optionValue}
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(optionValue)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selected ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          {optionLabel}
        </button>
      );
    })}
  </div>
);

const EmptyState = ({ filtered, onClear }) => (
  <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
      <Inbox size={22} aria-hidden="true" />
    </div>
    <div>
      <p className="font-bold text-slate-800">No records found</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {filtered
          ? "Nothing matches your current search or filters. Try clearing them to see the full queue."
          : "There is nothing waiting in this module right now. New records appear here automatically."}
      </p>
    </div>
    {filtered && (
      <button type="button" className="btn-secondary" onClick={onClear}>
        Clear search and filters
      </button>
    )}
  </div>
);

const PaymentHistoryBreakdown = ({ booking, className = "" }) => {
  const transactions = Array.isArray(booking?.paymentTransactions)
    ? booking.paymentTransactions
    : [];
  const totalPaid = transactions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const gateInPaid = transactions
    .filter((item) => item.paymentStage === "gate_in")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gateOutPaid = transactions
    .filter((item) => item.paymentStage === "gate_out")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentGateOutBalance =
    booking?.status === "gate_out_approved"
      ? 0
      : Number(booking?.paymentBalanceDue ?? booking?.paymentAmount ?? 0);
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-5 ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-700">
            Billing information
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">
            Complete payment history
          </h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Gate-In and Gate-Out payments are shown together for this booking,
            while each remains a separate transaction.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
          <p className="text-xs font-semibold text-slate-400">Total paid</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
            {money(totalPaid)}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-700">Gate-In</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
            {money(gateInPaid)}
          </p>
        </div>
        <div className="rounded-2xl bg-sky-50 p-4">
          <p className="text-xs font-semibold text-sky-700">Gate-Out</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
            {money(gateOutPaid)}
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-700">
            Current Gate-Out balance
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
            {money(currentGateOutBalance)}
          </p>
        </div>
      </div>
      {transactions.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
          No approved payment transactions have been recorded yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {transactions.map((payment, index) => {
            const stage =
              payment.paymentStage === "gate_in" ? "Gate-In LOLO" : "Gate-Out";
            return (
              <div
                key={payment.id || `${stage}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${payment.paymentStage === "gate_in" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}
                    >
                      {stage}
                    </span>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {formatDate(payment.paymentDate)}
                      {payment.referenceNumber
                        ? ` • Ref ${payment.referenceNumber}`
                        : ""}
                      {payment.receiptNumber
                        ? ` • Receipt ${payment.receiptNumber}`
                        : ""}
                    </p>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-slate-900">
                    {money(payment.amount)}
                  </p>
                </div>
                {Array.isArray(payment.lineItems) &&
                  payment.lineItems.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold text-slate-400">
                        Transaction breakdown
                      </p>
                      <div className="mt-2 space-y-2">
                        {payment.lineItems.map((item, itemIndex) => (
                          <div
                            key={`${item.chargeCode || item.description}-${itemIndex}`}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="font-medium text-slate-700">
                              {String(item.chargeCode || "").startsWith(
                                "LIFT_ON",
                              )
                                ? "Lift On Charge"
                                : String(item.chargeCode || "").startsWith(
                                      "LIFT_OFF",
                                    )
                                  ? "Lift Off Charge"
                                  : item.description || item.chargeCode}
                            </span>
                            <span className="font-bold tabular-nums text-slate-900">
                              {money(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm">
                        <span className="font-medium text-slate-600">
                          Subtotal + VAT
                        </span>
                        <span className="font-bold tabular-nums text-slate-900">
                          {money(payment.grossTotal || payment.amount)}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StagePaymentAdjustment = ({ booking, stage, onEdit }) => {
  const transactions = (booking?.paymentTransactions || []).filter(
    (item) => item.paymentStage === stage,
  );
  const paidTotal = transactions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const billingTotal =
    stage === "gate_in"
      ? Number(booking?.gateInBillingTotal || 0)
      : Number(booking?.gateOutBillingTotal ?? booking?.billingTotal ?? 0);
  const balanceDue = Math.max(
    Math.round((billingTotal - paidTotal) * 100) / 100,
    0,
  );
  const stageLabel = stage === "gate_in" ? "Gate-In" : "Gate-Out";

  return (
    <div className="card border-violet-200 bg-violet-50/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-violet-700">
            Super admin • editable payment
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">
            {stageLabel} payment
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Correct an approved {stageLabel} payment amount without changing the
            billing breakdown. Any remaining balance is recalculated
            automatically.
          </p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2 text-right">
          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400">Paid</p>
            <p className="mt-1 font-bold tabular-nums text-slate-900">
              {money(paidTotal)}
            </p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-400">Balance</p>
            <p
              className={`mt-1 font-bold tabular-nums ${balanceDue > 0 ? "text-amber-700" : "text-emerald-700"}`}
            >
              {money(balanceDue)}
            </p>
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-4 text-sm font-medium text-slate-500">
          No approved {stageLabel} payment exists yet. Record or approve the
          payment first, then the payment amount becomes editable here.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {transactions.map((payment, index) => (
            <div
              key={payment.id || `${stage}-${index}`}
              className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {payment.referenceNumber
                    ? `Reference ${payment.referenceNumber}`
                    : `${stageLabel} payment ${index + 1}`}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {formatDate(payment.paymentDate || payment.approvedAt)}
                  {payment.receiptNumber
                    ? ` • Receipt ${payment.receiptNumber}`
                    : ""}
                </p>
                <p className="mt-2 text-xl font-bold tabular-nums text-slate-950">
                  {money(payment.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEdit(payment)}
                className="btn-secondary shrink-0"
              >
                <Pencil size={16} /> Edit payment
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
      {label}
    </span>
    {children}
    {hint && (
      <span className="mt-1 block text-xs font-medium text-slate-400">
        {hint}
      </span>
    )}
  </label>
);

const containerConditionOptions = [
  "GOOD",
  "DENTED",
  "RUST",
  "HOLE",
  "DOOR DAMAGE",
  "OTHER",
];

const normalizeConditionSelections = (values = []) => {
  const next = Array.isArray(values) ? values : values ? [values] : [];
  return Array.from(
    new Set(
      next
        .map((value) =>
          String(value || "")
            .trim()
            .toUpperCase(),
        )
        .filter((value) => containerConditionOptions.includes(value)),
    ),
  );
};

const toggleConditionSelection = (values = [], value) => {
  const normalizedValue = String(value || "")
    .trim()
    .toUpperCase();
  const current = normalizeConditionSelections(values);
  if (current.includes(normalizedValue))
    return current.filter((item) => item !== normalizedValue);
  return [...current, normalizedValue];
};

const formatConditionSummary = (values = [], otherValue = "") => {
  const selected = normalizeConditionSelections(values);
  const labels = selected.filter((value) => value !== "OTHER");
  const trimmedOther = String(otherValue || "").trim();
  if (selected.includes("OTHER"))
    labels.push(trimmedOther ? `OTHER: ${trimmedOther}` : "OTHER");
  return labels.join(", ") || "GOOD";
};

const ConditionChecklist = ({
  value = [],
  otherValue = "",
  onToggle,
  onOtherChange,
  hint,
}) => {
  const selected = normalizeConditionSelections(value);
  const hasOther = selected.includes("OTHER");

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {containerConditionOptions.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 ${selected.includes(option) ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {hasOther && (
        <input
          className="input mt-3"
          placeholder="Specify other condition"
          value={otherValue}
          onChange={(event) => onOtherChange(event.target.value)}
        />
      )}
      {hint && (
        <p className="mt-2 text-xs font-medium text-slate-400">{hint}</p>
      )}
    </div>
  );
};

const emptyCashAdditionalItem = () => ({
  description: "",
  quantity: "1",
  rateAmount: "",
  notes: "",
});

const initialGateIn = {
  actualContainerNumber: "",
  physicalCondition: "Good",
  gateInConditions: ["GOOD"],
  gateInConditionOther: "",
  sealNumber: "",
  sealIntact: "yes",
  truckPlateNumber: "",
  driverName: "",
  driverLicenseNumber: "",
  inspectionRemarks: "",
};

const initialGateInDetails = {
  containerNumber: "",
  containerSize: "20",
  containerType: "dry",
  containerLoadStatus: "empty",
  rateType: "local",
  shippingLine: "",
  bookingNumber: "",
  blNumber: "",
  vesselVoyage: "",
  cargoDescription: "",
  weight: "",
  inDate: "",
  truckPlateNumber: "",
  driverName: "",
  driverLicenseNumber: "",
  hauler: "",
  clientRemarks: "",
};

const dangerGhostButton =
  "btn-secondary !border-transparent !bg-transparent !text-red-700 hover:!bg-red-50";

const AdminBookingModule = ({ mode }) => {
  const config = moduleConfig[mode] || moduleConfig.preAdvice;
  const location = useLocation();
  const navigate = useNavigate();
  const HeaderIcon = config.icon;
  const isPreAdviceApprovalMode = mode === "preAdvice";
  const bookingBasePath = isPreAdviceApprovalMode
    ? "/admin/pre-advice-bookings"
    : "/admin/bookings";
  const yardBasePath = isPreAdviceApprovalMode
    ? "/admin/pre-advice-bookings/yard"
    : "/admin/yard";

  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState({});
  const [areas, setAreas] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [slotAvailability, setSlotAvailability] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedModalMode, setSelectedModalMode] = useState("view");
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef(null);
  const [filters, setFilters] = useState({
    status: config.defaultStatus,
    billingStatus: config.defaultBillingStatus,
    loadStatus: "all",
    rateType: "all",
    search: "",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [approval, setApproval] = useState({
    areaId: "",
    blockId: "",
    bay: "",
    row: "",
    tier: "",
    loloPaymentStage: "gate_out",
  });
  const [gateIn, setGateIn] = useState(initialGateIn);
  const [gateInDetails, setGateInDetails] = useState(initialGateInDetails);
  const [releaseConditions, setReleaseConditions] = useState({
    gateOutConditions: [],
    gateOutConditionOther: "",
  });
  const [rejectReason, setRejectReason] = useState("");
  const [paymentRejectReason, setPaymentRejectReason] = useState("");
  const [gateOutRejectReason, setGateOutRejectReason] = useState("");
  const [reversalRejectReason, setReversalRejectReason] = useState("");
  const [additionalCharge, setAdditionalCharge] = useState({
    description: "",
    quantity: "1",
    rateAmount: "",
    notes: "",
  });
  const [cashPayment, setCashPayment] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentReferenceNumber: "",
    paymentRemarks: "",
    cashReceived: "",
    isVatApplicable: true,
  });
  const [cashAdditionalItems, setCashAdditionalItems] = useState([]);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashBookingId, setCashBookingId] = useState("");
  const [showPaymentAdjustmentModal, setShowPaymentAdjustmentModal] =
    useState(false);
  const [paymentAdjustment, setPaymentAdjustment] = useState({
    transactionId: "",
    paymentStage: "gate_in",
    amount: "",
    previousAmount: 0,
    referenceNumber: "",
    reason: "",
  });
  const [congestionOption, setCongestionOption] = useState(null);
  const [congestionLoading, setCongestionLoading] = useState(false);
  const [gateOutDates, setGateOutDates] = useState({ inDate: "", outDate: "" });
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    totalPages: 1,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const user = useAuthStore((state) => state.user);
  const canDeleteBooking = hasModulePermission(user, "operations", "delete");
  const bookingsRequestRef = useRef({ key: "", promise: null });
  const bookingsAbortRef = useRef(null);
  const bookingsGenerationRef = useRef(0);
  const summaryGenerationRef = useRef(0);
  const areasRequestRef = useRef({ key: "", promise: null });
  const blocksRequestRef = useRef({ key: "", promise: null });
  const slotsRequestRef = useRef({ key: "", promise: null });
  const realtimeRefreshTimerRef = useRef(null);

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedId) || null,
    [bookings, selectedId],
  );

  const openBookingModal = (booking, modalMode = "view") => {
    setSelectedModalMode(modalMode);
    setRejectReason("");
    setPaymentRejectReason("");
    setGateOutRejectReason("");
    setReversalRejectReason("");
    setRemarks("");
    setAlert({ type: "", message: "" });
    setSelectedId(booking.id);
  };

  const closeBookingModal = useCallback(() => {
    setSelectedId("");
    setSelectedModalMode("view");
  }, []);

  const cashBooking = useMemo(
    () => bookings.find((booking) => booking.id === cashBookingId) || null,
    [bookings, cashBookingId],
  );
  const cashPaymentStage =
    cashBooking?.status === "approved_area_assigned" ? "gate_in" : "gate_out";
  const cashAdditionalSubtotal = useMemo(
    () =>
      Math.round(
        cashAdditionalItems.reduce((sum, item) => {
          const quantity = Math.max(Number(item.quantity) || 0, 0);
          const rateAmount = Math.max(Number(item.rateAmount) || 0, 0);
          return sum + quantity * rateAmount;
        }, 0) * 100,
      ) / 100,
    [cashAdditionalItems],
  );
  const cashBaseSubtotal = Number(cashBooking?.billingSubtotal || 0);
  const cashSubtotal =
    Math.round((cashBaseSubtotal + cashAdditionalSubtotal) * 100) / 100;
  const cashVatRate = Number(cashBooking?.vatRate || 0.12);
  const cashVatAmount = cashPayment.isVatApplicable
    ? Math.round(cashSubtotal * cashVatRate * 100) / 100
    : 0;
  const cashGrossTotal = Math.round((cashSubtotal + cashVatAmount) * 100) / 100;
  const cashGateInPayment = Math.max(
    (cashBooking?.paymentTransactions || [])
      .filter((item) => item.paymentStage === "gate_in")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    0,
  );
  const cashGateOutPayment = Math.max(
    (cashBooking?.paymentTransactions || [])
      .filter((item) => item.paymentStage === "gate_out")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    0,
  );
  const cashApprovedCredit =
    cashPaymentStage === "gate_in"
      ? Math.max(
          cashGateInPayment,
          Number(cashBooking?.approvedPaymentAmount || 0),
        )
      : cashGateOutPayment;
  const cashTotal = Math.max(
    Math.round((cashGrossTotal - cashApprovedCredit) * 100) / 100,
    0,
  );
  const cashReceivedValue = Number(cashPayment.cashReceived || 0);
  const cashChange = Math.max(
    Math.round((cashReceivedValue - cashTotal) * 100) / 100,
    0,
  );

  // Suggested cash amounts: exact, then the next round numbers above the total.
  const quickCashAmounts = useMemo(() => {
    if (!(cashTotal > 0)) return [];
    const whole = Math.ceil(cashTotal);
    const candidates = [
      cashTotal,
      whole,
      Math.ceil(whole / 100) * 100,
      Math.ceil(whole / 500) * 500,
      Math.ceil(whole / 1000) * 1000,
    ].filter((amount) => amount >= cashTotal);
    return Array.from(new Set(candidates)).slice(0, 4);
  }, [cashTotal]);

  const selectedBlock = useMemo(
    () => blocks.find((block) => String(block.id) === String(approval.blockId)),
    [blocks, approval.blockId],
  );
  const usableBlocks = useMemo(
    () =>
      blocks
        .filter((block) => {
          const isActive = !block.status || block.status === "active";

          // In the Pre-advice Module, the admin selects a Yard Area only.
          // The backend keeps an internal location record for slot tracking, but the UI does not expose Block anymore.
          if (isPreAdviceApprovalMode) return isActive;

          const bookingSize = Number(selectedBooking?.containerSize);
          const blockSize = Number(block.containerSize);
          const matchesSize =
            !bookingSize ||
            !blockSize ||
            blockSize === bookingSize ||
            (bookingSize === 40 && blockSize === 20);
          return matchesSize && isActive;
        })
        .sort(
          (left, right) =>
            Number(Boolean(left.isCongestionArea)) -
            Number(Boolean(right.isCongestionArea)),
        ),
    [blocks, selectedBooking, isPreAdviceApprovalMode],
  );
  const regularYardHasSpace = useMemo(
    () =>
      usableBlocks.some(
        (block) =>
          !block.isCongestionArea && blockHasCapacity(block, selectedBooking),
      ),
    [usableBlocks, selectedBooking],
  );
  const hasCongestionArea = useMemo(
    () => usableBlocks.some((block) => block.isCongestionArea),
    [usableBlocks],
  );
  const selectedBlockHasCapacity = selectedBlock
    ? blockHasCapacity(selectedBlock, selectedBooking)
    : false;
  const selectedUsesCongestionArea = Boolean(selectedBlock?.isCongestionArea);
  const unavailableSlotKeys = useMemo(
    () => new Set(slotAvailability.map((slot) => slot.key)),
    [slotAvailability],
  );
  const hasSelectedSlot = Boolean(
    approval.blockId && approval.bay && approval.row && approval.tier,
  );
  const selectedSlotKeys = useMemo(() => {
    if (!hasSelectedSlot) return [];
    const bay = Number(approval.bay);
    const row = Number(approval.row);
    const tier = Number(approval.tier);
    const keys = [`${bay}-${row}-${tier}`];
    if (
      Number(selectedBooking?.containerSize) === 40 &&
      Number(selectedBlock?.containerSize) === 20
    ) {
      keys.push(`${bay + 1}-${row}-${tier}`);
    }
    return keys;
  }, [
    approval.bay,
    approval.row,
    approval.tier,
    hasSelectedSlot,
    selectedBooking?.containerSize,
    selectedBlock?.containerSize,
  ]);
  const selectedSlotOutOfBounds = Boolean(
    hasSelectedSlot &&
    Number(selectedBooking?.containerSize) === 40 &&
    Number(selectedBlock?.containerSize) === 20 &&
    Number(approval.bay) + 1 >
      Number(selectedBlock?.bayCount || selectedBlock?.lineCount || 1),
  );
  const selectedSlotTaken = hasSelectedSlot
    ? selectedSlotKeys.some((key) => unavailableSlotKeys.has(key))
    : false;

  // Requirements shown to the admin so a disabled "Approve" is never a mystery.
  const approvalChecks = [
    {
      label: isPreAdviceApprovalMode
        ? "Yard area selected"
        : "Yard area and block section selected",
      ok: Boolean(approval.areaId && approval.blockId),
    },
    { label: "Slot (bay / row / tier) selected", ok: hasSelectedSlot },
    {
      label: "Selected slot is still available",
      ok:
        hasSelectedSlot &&
        !slotsLoading &&
        !selectedSlotTaken &&
        !selectedSlotOutOfBounds,
    },
    {
      label: "Area has enough remaining capacity",
      ok: Boolean(selectedBlock) && selectedBlockHasCapacity,
    },
    ...(selectedUsesCongestionArea
      ? [
          {
            label: "Regular yard is full and congestion surcharge is set",
            ok:
              !regularYardHasSpace &&
              !congestionLoading &&
              Boolean(congestionOption?.available),
          },
        ]
      : []),
  ];
  const approvalReady = approvalChecks.every((check) => check.ok);

  const gateInLoloCleared =
    selectedBooking?.loloPaymentStage === "gate_out" ||
    (selectedBooking?.billingStatus === "paid_approved" &&
      Number(selectedBooking?.paymentBalanceDue || 0) <= 0);
  const gateInChecks = [
    {
      label: "Booking is approved and ready for Gate-In",
      ok: selectedBooking?.status === "approved_area_assigned",
    },
    {
      label:
        selectedBooking?.loloPaymentStage === "gate_out"
          ? "LOLO payment deferred to Gate-Out"
          : "LOLO payment fully paid and approved",
      ok: Boolean(gateInLoloCleared),
    },
  ];
  const gateInReady = gateInChecks.every((check) => check.ok);

  const gateOutChecks =
    config.primarySection === "release"
      ? [
          {
            label: "Gate-Out request is approved",
            ok: selectedBooking?.status === "gate_out_approved",
          },
          {
            label: "Container has not been released yet",
            ok: !selectedBooking?.releasedAt,
          },
        ]
      : [
          {
            label: "Gate-Out request is pending",
            ok: selectedBooking?.status === "gate_out_requested",
          },
          {
            label: "Payment is paid and approved",
            ok: hasApprovedPayment(selectedBooking || {}),
          },
        ];
  const gateOutReady = gateOutChecks.every((check) => check.ok);

  const loadSummary = useCallback(
    async ({ force = false } = {}) => {
      const generation = ++summaryGenerationRef.current;
      try {
        const { data } = await api.get(`${bookingBasePath}/module-data`, {
          params: {
            summaryOnly: "true",
            ...(force ? { refreshSummary: "true" } : {}),
          },
        });
        if (generation === summaryGenerationRef.current && data?.summary)
          setSummary(data.summary);
      } catch (error) {
        // A slow summary must never prevent the payment/booking queue from loading.
        if (generation === summaryGenerationRef.current)
          console.warn("Booking totals unavailable; queue remains usable.");
      }
    },
    [bookingBasePath],
  );

  const loadBookings = useCallback(
    async ({ force = false } = {}) => {
      const params = new URLSearchParams();
      const fixedQueueStatus =
        mode === "preAdvice"
          ? "pending_admin_approval"
          : mode === "gateIn"
            ? "approved_area_assigned"
            : "";
      const requestedStatus =
        fixedQueueStatus ||
        (mode === "gateOut" && (!filters.status || filters.status === "all")
          ? "gate_out_requested,gate_out_approved,gate_out_reversal_requested,completed_gate_out_done"
          : mode === "releaseContainer" &&
              (!filters.status || filters.status === "all")
            ? "gate_out_approved,gate_out_reversal_requested,completed_gate_out_done"
            : filters.status || "all");
      params.set("status", requestedStatus);
      if (!fixedQueueStatus && filters.billingStatus)
        params.set("billingStatus", filters.billingStatus);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.loadStatus && filters.loadStatus !== "all")
        params.set("loadStatus", filters.loadStatus);
      if (filters.rateType && filters.rateType !== "all")
        params.set("rateType", filters.rateType);
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      params.set("includeSummary", "false");

      const requestKey = `${bookingBasePath}/module-data?${params.toString()}`;
      if (
        !force &&
        bookingsRequestRef.current.key === requestKey &&
        bookingsRequestRef.current.promise
      ) {
        return bookingsRequestRef.current.promise;
      }

      bookingsAbortRef.current?.abort();
      const controller = new AbortController();
      bookingsAbortRef.current = controller;
      const generation = ++bookingsGenerationRef.current;
      const request = (async () => {
        try {
          setLoading(true);
          const { data } = await api.get(requestKey, {
            signal: controller.signal,
          });
          if (
            generation !== bookingsGenerationRef.current ||
            controller.signal.aborted
          )
            return;
          const rawBookings = data.bookings || [];
          const gateOutStatuses = new Set([
            "gate_out_requested",
            "gate_out_approved",
            "gate_out_reversal_requested",
            "completed_gate_out_done",
          ]);
          const releaseStatuses = new Set([
            "gate_out_approved",
            "gate_out_reversal_requested",
            "completed_gate_out_done",
          ]);
          const nextBookings =
            mode === "preAdvice"
              ? rawBookings.filter(
                  (booking) => booking.status === "pending_admin_approval",
                )
              : mode === "gateIn"
                ? rawBookings.filter(
                    (booking) => booking.status === "approved_area_assigned",
                  )
                : mode === "gateOut"
                  ? rawBookings.filter((booking) =>
                      gateOutStatuses.has(booking.status),
                    )
                  : mode === "releaseContainer"
                    ? rawBookings.filter((booking) =>
                        releaseStatuses.has(booking.status),
                      )
                    : rawBookings;
          setBookings(nextBookings);
          setPaginationMeta({
            total: Number(data.pagination?.total) || 0,
            totalPages: Math.max(Number(data.pagination?.totalPages) || 1, 1),
          });
          if (data.summary) setSummary(data.summary);
          setSelectedId((current) =>
            current && nextBookings.some((booking) => booking.id === current)
              ? current
              : "",
          );
        } catch (error) {
          if (
            !controller.signal.aborted &&
            generation === bookingsGenerationRef.current
          ) {
            setAlert({ type: "error", message: getApiError(error) });
          }
        } finally {
          if (bookingsRequestRef.current.promise === request) {
            bookingsRequestRef.current = { key: "", promise: null };
          }
          if (generation === bookingsGenerationRef.current) setLoading(false);
        }
      })();

      if (force) void loadSummary({ force: true });
      bookingsRequestRef.current = { key: requestKey, promise: request };
      return request;
    },
    [
      bookingBasePath,
      debouncedSearch,
      filters.billingStatus,
      filters.loadStatus,
      filters.rateType,
      filters.status,
      loadSummary,
      mode,
      page,
      pageSize,
    ],
  );

  const loadAreas = useCallback(
    async ({ force = false } = {}) => {
      const requestKey = isPreAdviceApprovalMode
        ? `${yardBasePath}/blocks`
        : `${yardBasePath}/areas`;
      if (
        !force &&
        areasRequestRef.current.key === requestKey &&
        areasRequestRef.current.promise
      ) {
        return areasRequestRef.current.promise;
      }

      const request = (async () => {
        try {
          if (isPreAdviceApprovalMode) {
            const { data } = await api.get(requestKey);
            setAreas(data.areas || []);
            setBlocks(data.blocks || []);
            return;
          }

          const { data } = await api.get(requestKey);
          setAreas(data.areas || []);
        } catch (error) {
          setAreas([]);
          setBlocks([]);
          setAlert({ type: "error", message: getApiError(error) });
        } finally {
          if (areasRequestRef.current.promise === request) {
            areasRequestRef.current = { key: "", promise: null };
          }
        }
      })();

      areasRequestRef.current = { key: requestKey, promise: request };
      return request;
    },
    [isPreAdviceApprovalMode, yardBasePath],
  );

  const loadBlocks = useCallback(
    async (areaId, { force = false } = {}) => {
      if (!areaId) {
        setBlocks([]);
        return Promise.resolve();
      }

      const requestKey = `${yardBasePath}/areas/${areaId}/blocks`;
      if (
        !force &&
        blocksRequestRef.current.key === requestKey &&
        blocksRequestRef.current.promise
      ) {
        return blocksRequestRef.current.promise;
      }

      const request = (async () => {
        try {
          const { data } = await api.get(requestKey);
          setBlocks(data.blocks || []);
        } catch (error) {
          setAlert({ type: "error", message: getApiError(error) });
        } finally {
          if (blocksRequestRef.current.promise === request) {
            blocksRequestRef.current = { key: "", promise: null };
          }
        }
      })();

      blocksRequestRef.current = { key: requestKey, promise: request };
      return request;
    },
    [yardBasePath],
  );

  const loadSlotAvailability = useCallback(
    async (blockId, { force = false } = {}) => {
      if (!blockId) {
        setSlotAvailability([]);
        setSlotsLoading(false);
        return Promise.resolve();
      }

      const requestKey = `${bookingBasePath}/yard/blocks/${blockId}/slots`;
      if (
        !force &&
        slotsRequestRef.current.key === requestKey &&
        slotsRequestRef.current.promise
      ) {
        return slotsRequestRef.current.promise;
      }

      setSlotAvailability([]);
      setSlotsLoading(true);
      const request = (async () => {
        try {
          const { data } = await api.get(requestKey);
          if (slotsRequestRef.current.key === requestKey) {
            setSlotAvailability(data.slots || []);
          }
        } catch (error) {
          if (slotsRequestRef.current.key === requestKey) {
            setSlotAvailability([]);
            setAlert({ type: "error", message: getApiError(error) });
          }
        } finally {
          if (slotsRequestRef.current.promise === request) {
            slotsRequestRef.current = { key: "", promise: null };
            setSlotsLoading(false);
          }
        }
      })();

      slotsRequestRef.current = { key: requestKey, promise: request };
      return request;
    },
    [bookingBasePath],
  );

  useEffect(() => {
    setFilters({
      status: config.defaultStatus,
      billingStatus: config.defaultBillingStatus,
      loadStatus: "all",
      rateType: "all",
      search: "",
    });
    setSelectedId("");
    setSelectedModalMode("view");
    setAlert({ type: "", message: "" });
    setPage(1);
  }, [mode]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.status,
    filters.billingStatus,
    filters.loadStatus,
    filters.rateType,
    debouncedSearch,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(filters.search.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  // Success messages clear themselves; errors stay until dismissed or replaced.
  useEffect(() => {
    if (alert.type !== "success" || !alert.message) return undefined;
    const timer = window.setTimeout(
      () => setAlert({ type: "", message: "" }),
      6000,
    );
    return () => window.clearTimeout(timer);
  }, [alert]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => () => bookingsAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!selectedId || config.primarySection !== "approval" || areas.length > 0)
      return;
    loadAreas();
  }, [selectedId, config.primarySection, areas.length, loadAreas]);

  useEffect(() => {
    const bookingId = location.state?.bookingId;
    if (!bookingId || loading) return;

    const booking = bookings.find(
      (item) => String(item.id) === String(bookingId),
    );
    if (booking) {
      setSelectedModalMode(
        location.state?.openMode === "view" ? "view" : "edit",
      );
      setSelectedId(booking.id);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (
      filters.status !== config.defaultStatus ||
      filters.billingStatus !== config.defaultBillingStatus ||
      filters.loadStatus !== "all" ||
      filters.rateType !== "all" ||
      filters.search
    ) {
      setFilters({
        status: config.defaultStatus,
        billingStatus: config.defaultBillingStatus,
        loadStatus: "all",
        rateType: "all",
        search: "",
      });
    }
  }, [
    bookings,
    filters.billingStatus,
    filters.loadStatus,
    filters.rateType,
    filters.search,
    filters.status,
    loading,
    location.pathname,
    location.state,
    navigate,
  ]);

  useEffect(() => {
    if (!selectedBooking) return;

    setApproval({
      areaId: selectedBooking.assignedArea || "",
      blockId: selectedBooking.assignedBlock || "",
      bay: selectedBooking.assignedBay || "",
      row: selectedBooking.assignedRow || "",
      tier: selectedBooking.assignedTier || "",
      loloPaymentStage:
        selectedBooking.loloPaymentStage === "gate_in" ? "gate_in" : "gate_out",
    });

    const normalizedGateInConditions = normalizeConditionSelections(
      selectedBooking.gateInConditions,
    );
    const normalizedGateOutConditions = normalizeConditionSelections(
      selectedBooking.gateOutConditions,
    );

    setGateIn({
      actualContainerNumber:
        selectedBooking.actualContainerNumber ||
        selectedBooking.containerNumber ||
        "",
      physicalCondition: selectedBooking.physicalCondition || "Good",
      gateInConditions: normalizedGateInConditions.length
        ? normalizedGateInConditions
        : ["GOOD"],
      gateInConditionOther: selectedBooking.gateInConditionOther || "",
      sealNumber: selectedBooking.sealNumber || "",
      sealIntact: selectedBooking.sealIntact || "yes",
      truckPlateNumber: selectedBooking.truckPlateNumber || "",
      driverName: selectedBooking.driverName || "",
      driverLicenseNumber: selectedBooking.driverLicenseNumber || "",
      inspectionRemarks: selectedBooking.inspectionRemarks || "",
    });

    setGateInDetails({
      containerNumber: selectedBooking.containerNumber || "",
      containerSize: String(selectedBooking.containerSize || 20),
      containerType: selectedBooking.containerType || "dry",
      containerLoadStatus: selectedBooking.containerLoadStatus || "empty",
      rateType: selectedBooking.rateType || "local",
      shippingLine: selectedBooking.shippingLine || "",
      bookingNumber: selectedBooking.bookingNumber || "",
      blNumber: selectedBooking.blNumber || "",
      vesselVoyage: selectedBooking.vesselVoyage || "",
      cargoDescription: selectedBooking.cargoDescription || "",
      weight: selectedBooking.weight ?? "",
      inDate: toDateTimeLocalString(getBookingInDate(selectedBooking)),
      truckPlateNumber: selectedBooking.truckPlateNumber || "",
      driverName: selectedBooking.driverName || "",
      driverLicenseNumber: selectedBooking.driverLicenseNumber || "",
      hauler: selectedBooking.hauler || "",
      clientRemarks: selectedBooking.clientRemarks || "",
    });

    setReleaseConditions({
      gateOutConditions: normalizedGateOutConditions.length
        ? normalizedGateOutConditions
        : normalizedGateInConditions.length
          ? normalizedGateInConditions
          : ["GOOD"],
      gateOutConditionOther:
        selectedBooking.gateOutConditionOther ||
        selectedBooking.gateInConditionOther ||
        "",
    });

    setGateOutDates({
      inDate: toDateTimeLocalString(getBookingInDate(selectedBooking)),
      outDate: toDateTimeLocalString(selectedBooking.outDate),
    });
  }, [
    selectedBooking?.id,
    selectedBooking?.updatedAt,
    selectedBooking?.inDate,
    selectedBooking?.outDate,
    selectedBooking?.overstayFeeWaived,
    selectedBooking?.overstayFeeWaiverReason,
  ]);

  useEffect(() => {
    if (!cashBooking) return;

    setCashPayment({
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentReferenceNumber: "",
      paymentRemarks: "",
      cashReceived: "",
      isVatApplicable: cashBooking.isVatApplicable !== false,
    });
    setCashAdditionalItems([]);
  }, [cashBooking?.id]);

  useEffect(() => {
    if (
      config.primarySection !== "approval" ||
      !isPreAdviceApprovalMode ||
      !selectedBooking?.id
    ) {
      setCongestionOption(null);
      return;
    }
    let active = true;
    setCongestionLoading(true);
    api
      .get(`${bookingBasePath}/${selectedBooking.id}/congestion-surcharge`)
      .then(({ data }) => {
        if (active) setCongestionOption(data.option || null);
      })
      .catch(() => {
        if (active) setCongestionOption(null);
      })
      .finally(() => {
        if (active) setCongestionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    bookingBasePath,
    config.primarySection,
    isPreAdviceApprovalMode,
    selectedBooking?.id,
    selectedBooking?.updatedAt,
    blocks,
  ]);

  useEffect(() => {
    if (config.primarySection === "approval" && !isPreAdviceApprovalMode)
      loadBlocks(approval.areaId);
  }, [
    approval.areaId,
    config.primarySection,
    isPreAdviceApprovalMode,
    loadBlocks,
  ]);

  useEffect(() => {
    if (config.primarySection === "approval")
      loadSlotAvailability(approval.blockId);
  }, [approval.blockId, config.primarySection, loadSlotAvailability]);

  const shouldRefreshForRealtimeEvent = useCallback(
    (eventType) => {
      if (!eventType) return false;
      if (isPreAdviceApprovalMode)
        return (
          eventType.startsWith("booking:") ||
          eventType.startsWith("preAdvice:") ||
          eventType.startsWith("yard:")
        );
      if (config.primarySection === "gateIn")
        return (
          eventType.startsWith("gateIn:") ||
          eventType === "booking:gate_in_details_updated" ||
          eventType === "booking:gate_in_approved" ||
          eventType === "booking:gate_in_no_show_cancelled" ||
          eventType === "booking:approved" ||
          eventType === "booking:rejected"
        );
      if (config.primarySection === "billing")
        return (
          eventType.includes("payment_") ||
          eventType === "booking:billing_operation_updated" ||
          eventType === "booking:overstay_billing_recomputed" ||
          eventType === "booking:gate_out_requested"
        );
      if (config.primarySection === "gateOut")
        return (
          eventType.includes("gate_out") ||
          eventType.includes("overstay_fee") ||
          eventType === "booking:payment_approved" ||
          eventType === "booking:cash_payment_recorded"
        );
      if (config.primarySection === "release")
        return (
          eventType.includes("gate_out_reversal") ||
          eventType.includes("overstay_fee") ||
          eventType === "booking:gate_out_approved" ||
          eventType === "booking:overstay_billing_recomputed" ||
          eventType === "booking:payment_approved" ||
          eventType === "booking:cash_payment_recorded" ||
          eventType === "booking:completed"
        );
      return (
        eventType.startsWith("booking:") ||
        eventType.startsWith("yard:") ||
        eventType.startsWith("inventory:")
      );
    },
    [config.primarySection, isPreAdviceApprovalMode],
  );

  useEffect(() => {
    const handleRealtime = (event) => {
      const eventType = event.detail?.type || "";
      if (!shouldRefreshForRealtimeEvent(eventType)) return;

      window.clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        loadBookings({ force: true });
        if (config.primarySection === "approval" && approval.blockId) {
          loadSlotAvailability(approval.blockId, { force: true });
        }
      }, 350);
    };

    window.addEventListener("otli:realtime", handleRealtime);
    return () => {
      window.removeEventListener("otli:realtime", handleRealtime);
      window.clearTimeout(realtimeRefreshTimerRef.current);
    };
  }, [
    approval.blockId,
    config.primarySection,
    loadBookings,
    loadSlotAvailability,
    shouldRefreshForRealtimeEvent,
  ]);

  const runAction = async (callback, message) => {
    if (!selectedBooking) return;
    setAlert({ type: "", message: "" });
    try {
      setSaving(true);
      await callback();
      setAlert({ type: "success", message });
      await loadBookings({ force: true });
      return true;
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalAreaChange = (areaLocationId) => {
    const areaLocation = blocks.find(
      (item) => String(item.id) === String(areaLocationId),
    );
    setApproval((current) => ({
      ...current,
      areaId: areaLocation?.area || areaLocationId || "",
      blockId: areaLocation?.id || "",
      bay: "",
      row: "",
      tier: "",
    }));
  };

  const approveBooking = () =>
    runAction(
      () =>
        api.patch(`${bookingBasePath}/${selectedBooking.id}/approve`, approval),
      isPreAdviceApprovalMode
        ? "Pre-advice approved and yard location assigned."
        : "Booking approved and yard area assigned.",
    );

  const rejectBooking = () =>
    runAction(
      () =>
        api.patch(`${bookingBasePath}/${selectedBooking.id}/reject`, {
          reason: rejectReason,
        }),
      isPreAdviceApprovalMode ? "Pre-advice rejected." : "Booking rejected.",
    );

  const saveGateInDetails = async () => {
    if (!selectedBooking || user?.role !== "super_admin") return;
    if (!gateInDetails.inDate) {
      setAlert({
        type: "error",
        message: "Select the Gate-In date and time before saving.",
      });
      return;
    }

    const parsedInDate = new Date(gateInDetails.inDate);
    if (Number.isNaN(parsedInDate.getTime())) {
      setAlert({
        type: "error",
        message: "Select a valid Gate-In date and time.",
      });
      return;
    }

    const saved = await runAction(
      () =>
        api.patch(`/admin/bookings/${selectedBooking.id}/gate-in/details`, {
          ...gateInDetails,
          containerSize: Number(gateInDetails.containerSize),
          weight: Number(gateInDetails.weight),
          inDate: parsedInDate.toISOString(),
        }),
      "Gate-In booking details updated successfully.",
    );

    if (saved) {
      setGateIn((current) => ({
        ...current,
        actualContainerNumber: gateInDetails.containerNumber,
        truckPlateNumber: gateInDetails.truckPlateNumber,
        driverName: gateInDetails.driverName,
        driverLicenseNumber: gateInDetails.driverLicenseNumber,
      }));
    }
  };

  const approveGateIn = () =>
    runAction(
      () =>
        api.patch(`/admin/bookings/${selectedBooking.id}/gate-in`, {
          ...gateIn,
          physicalCondition: formatConditionSummary(
            gateIn.gateInConditions,
            gateIn.gateInConditionOther,
          ),
        }),
      "Gate-In approved and moved to Inventory.",
    );

  const rejectGateIn = () =>
    runAction(
      () =>
        api.patch(`/admin/bookings/${selectedBooking.id}/gate-in/reject`, {
          reason: rejectReason,
        }),
      "Gate-In rejected and the reserved yard slots were released.",
    );

  const cancelBooking = () => {
    if (!rejectReason.trim()) {
      setAlert({
        type: "error",
        message: "Enter a cancellation reason first.",
      });
      return;
    }
    const cancelPath = isPreAdviceApprovalMode
      ? `/admin/pre-advice-bookings/${selectedBooking.id}/cancel`
      : `/admin/bookings/${selectedBooking.id}/gate-in/cancel`;
    return runAction(
      () => api.patch(cancelPath, { reason: rejectReason.trim() }),
      "Booking cancelled and reserved yard capacity released.",
    );
  };

  const approvePayment = () =>
    runAction(
      () =>
        api.patch(`/admin/bookings/${selectedBooking.id}/payment/approve`, {
          remarks,
        }),
      "Payment approved. You can still view it by choosing Approved Payments / Paid Approved in this module.",
    );

  const closeCashModal = useCallback(() => {
    if (saving) return;
    setShowCashModal(false);
    setCashBookingId("");
    setCashAdditionalItems([]);
  }, [saving]);

  const addCashAdditionalItem = () => {
    setCashAdditionalItems((current) => [
      ...current,
      emptyCashAdditionalItem(),
    ]);
  };

  const updateCashAdditionalItem = (index, field, value) => {
    setCashAdditionalItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const removeCashAdditionalItem = (index) => {
    setCashAdditionalItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const openCashPayment = async (booking) => {
    const disabledReason = getCashPaymentDisabledReason(booking);
    if (disabledReason) return;

    try {
      // Fetch the latest server-side billing snapshot before opening the modal.
      // This is important for Gate-Out because storage is calculated for the
      // separate Gate-Out transaction and the list row may still contain the
      // earlier Gate-In LOLO billing snapshot.
      const { data } = await api.get(`/admin/bookings/${booking.id}`);
      const freshBooking = data?.booking || data?.data || data;
      if (freshBooking?.id) {
        setBookings((current) =>
          current.map((item) =>
            item.id === freshBooking.id ? freshBooking : item,
          ),
        );
        setCashBookingId(freshBooking.id);
      } else {
        setCashBookingId(booking.id);
      }
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) });
      return;
    }
    setShowCashModal(true);
  };

  const recordCashPayment = async () => {
    if (!cashBooking) return;

    const disabledReason = getCashPaymentDisabledReason(cashBooking);
    if (disabledReason) {
      setAlert({ type: "error", message: disabledReason });
      setShowCashModal(false);
      setCashBookingId("");
      return;
    }

    const normalizedAdditionalItems = cashAdditionalItems.map((item) => ({
      description: String(item.description || "").trim(),
      quantity: Number(item.quantity),
      rateAmount: Number(item.rateAmount),
      notes: String(item.notes || "").trim(),
    }));

    const invalidAdditionalItem = normalizedAdditionalItems.find(
      (item) =>
        !item.description ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.rateAmount) ||
        item.rateAmount <= 0,
    );
    if (invalidAdditionalItem) {
      setAlert({
        type: "error",
        message:
          "Complete every additional item with a description, quantity greater than zero, and rate greater than zero.",
      });
      return;
    }

    if (!Number.isFinite(cashReceivedValue) || cashReceivedValue < cashTotal) {
      setAlert({
        type: "error",
        message: `Cash received must be at least ${money(cashTotal)}.`,
      });
      return;
    }
    setAlert({ type: "", message: "" });
    try {
      setSaving(true);
      const { data } = await api.post(
        `/admin/bookings/${cashBooking.id}/payment/cash`,
        {
          ...cashPayment,
          cashReceived: cashReceivedValue,
          isVatApplicable: cashPayment.isVatApplicable,
          additionalItems: normalizedAdditionalItems,
        },
      );
      setAlert({
        type: "success",
        message:
          data.message ||
          "Cash payment recorded and receipt generated. Review Gate-Out from the View modal.",
      });
      setShowCashModal(false);
      setCashBookingId("");
      if (data.booking) printBookingDocument(data.booking, "receipt");
      await loadBookings({ force: true });
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) });
    } finally {
      setSaving(false);
    }
  };

  const addAdditionalCharge = () => {
    if (
      !additionalCharge.description.trim() ||
      Number(additionalCharge.rateAmount) <= 0
    ) {
      setAlert({
        type: "error",
        message:
          "Enter an additional charge description and a rate greater than zero.",
      });
      return;
    }
    return runAction(
      () =>
        api.post(
          `/admin/bookings/${selectedBooking.id}/additional-charges`,
          additionalCharge,
        ),
      "Additional billing charge added.",
    ).then((success) => {
      if (success)
        setAdditionalCharge({
          description: "",
          quantity: "1",
          rateAmount: "",
          notes: "",
        });
    });
  };

  const removeAdditionalCharge = (chargeId) =>
    runAction(
      () =>
        api.delete(
          `/admin/bookings/${selectedBooking.id}/additional-charges/${chargeId}`,
        ),
      "Additional billing charge removed.",
    );

  const rejectPayment = () =>
    runAction(
      () =>
        api.patch(`/admin/bookings/${selectedBooking.id}/payment/reject`, {
          reason: paymentRejectReason,
        }),
      "Payment rejected.",
    );

  const openPaymentAdjustment = (payment) => {
    if (!selectedBooking || user?.role !== "super_admin" || !payment?.id)
      return;
    setAlert({ type: "", message: "" });
    setPaymentAdjustment({
      transactionId: payment.id,
      paymentStage:
        payment.paymentStage === "gate_out" ? "gate_out" : "gate_in",
      amount: String(Number(payment.amount || 0)),
      previousAmount: Number(payment.amount || 0),
      referenceNumber: payment.referenceNumber || "",
      reason: "",
    });
    setShowPaymentAdjustmentModal(true);
  };

  const closePaymentAdjustment = useCallback(() => {
    if (saving) return;
    setShowPaymentAdjustmentModal(false);
    setPaymentAdjustment({
      transactionId: "",
      paymentStage: "gate_in",
      amount: "",
      previousAmount: 0,
      referenceNumber: "",
      reason: "",
    });
  }, [saving]);

  const savePaymentAdjustment = async () => {
    if (
      !selectedBooking ||
      user?.role !== "super_admin" ||
      !paymentAdjustment.transactionId
    )
      return;
    const amount = Number(paymentAdjustment.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setAlert({
        type: "error",
        message: "Enter a valid payment amount of zero or greater.",
      });
      return;
    }

    setAlert({ type: "", message: "" });
    try {
      setSaving(true);
      const { data } = await api.patch(
        `/admin/bookings/${selectedBooking.id}/payments/${paymentAdjustment.transactionId}/amount`,
        {
          amount,
          paymentStage: paymentAdjustment.paymentStage,
          reason: paymentAdjustment.reason.trim(),
        },
      );
      setAlert({
        type: "success",
        message: data.message || "Payment amount updated successfully.",
      });
      setShowPaymentAdjustmentModal(false);
      await loadBookings({ force: true });
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) });
    } finally {
      setSaving(false);
    }
  };

  const approveGateOut = () =>
    runAction(
      () =>
        api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/approve`, {
          remarks,
        }),
      "Gate-Out approved.",
    );

  const rejectGateOut = () =>
    runAction(
      () =>
        api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/reject`, {
          reason: gateOutRejectReason,
        }),
      "Gate-Out request rejected.",
    );

  const saveGateOutDates = async () => {
    if (!selectedBooking || user?.role !== "super_admin") return;
    if (!gateOutDates.inDate || !gateOutDates.outDate) {
      setAlert({
        type: "error",
        message: "Select both Gate-In and Gate-Out date/time values.",
      });
      return;
    }
    const inDate = new Date(gateOutDates.inDate);
    const outDate = new Date(gateOutDates.outDate);
    if (
      Number.isNaN(inDate.getTime()) ||
      Number.isNaN(outDate.getTime()) ||
      outDate <= inDate
    ) {
      setAlert({
        type: "error",
        message: "Gate-Out must be later than Gate-In.",
      });
      return;
    }
    setAlert({ type: "", message: "" });
    try {
      setSaving(true);
      const { data } = await api.patch(
        `/admin/bookings/${selectedBooking.id}/gate-out/dates`,
        {
          inDate: inDate.toISOString(),
          outDate: outDate.toISOString(),
        },
      );
      setAlert({
        type: "success",
        message: data.message || "Gate-In and Gate-Out dates updated.",
      });
      await loadBookings({ force: true });
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) });
    } finally {
      setSaving(false);
    }
  };

  const approveGateOutReversal = () =>
    runAction(
      () =>
        api.patch(
          `/admin/bookings/${selectedBooking.id}/gate-out/reversal/approve`,
          { remarks },
        ),
      "Gate-Out reversed. Container returned to storage and approved payment preserved as credit.",
    );

  const rejectGateOutReversal = () =>
    runAction(
      () =>
        api.patch(
          `/admin/bookings/${selectedBooking.id}/gate-out/reversal/reject`,
          { reason: reversalRejectReason },
        ),
      "Gate-Out reversal request rejected.",
    );

  const completeGateOut = async () => {
    const completed = await runAction(
      () =>
        api.patch(`/admin/bookings/${selectedBooking.id}/gate-out/complete`, {
          actualContainerNumber:
            selectedBooking.actualContainerNumber ||
            selectedBooking.containerNumber,
          remarks,
          ...releaseConditions,
        }),
      "Container released. The release report was generated and revenue was recorded.",
    );

    // Final release always recalculates using server time. Refresh after a
    // blocked release so the new balance/status is shown immediately.
    if (!completed) await loadBookings({ force: true });
  };

  const pagination = {
    page,
    setPage,
    pageSize,
    setPageSize: (value) => {
      setPageSize(Number(value) || 10);
      setPage(1);
    },
    totalItems: paginationMeta.total,
    totalPages: paginationMeta.totalPages,
    startItem: paginationMeta.total === 0 ? 0 : (page - 1) * pageSize + 1,
    endItem: Math.min(page * pageSize, paginationMeta.total),
    pageSizeOptions: [10, 25, 50, 100],
    paginatedItems: bookings,
  };

  // Each KPI card can also act as a one-click queue filter.
  const moduleStats = useMemo(() => {
    if (mode === "preAdvice") {
      return [
        {
          label: "Total Bookings",
          value: summary.total || 0,
          icon: ClipboardList,
          tone: "slate",
        },
        {
          label: "Pending Review",
          value: summary.pending || 0,
          icon: ClipboardCheck,
          tone: "amber",
        },
        {
          label: "Approved",
          value: summary.approved || 0,
          icon: CheckCircle2,
          tone: "blue",
        },
      ];
    }

    if (mode === "gateIn") {
      return [
        {
          label: "Ready for Gate-In",
          value: summary.approved || 0,
          icon: Truck,
          tone: "amber",
        },
        {
          label: "Gate-In Approved",
          value: summary.gateIn || 0,
          icon: ClipboardCheck,
          tone: "blue",
        },
        {
          label: "Stored",
          value: summary.stored || 0,
          icon: Warehouse,
          tone: "emerald",
        },
      ];
    }

    if (mode === "billing") {
      return [
        {
          label: "Unpaid",
          value: summary.unpaid || 0,
          icon: Banknote,
          tone: "amber",
          filter: { billingStatus: "unpaid" },
        },
        {
          label: "Under Review",
          value: summary.paymentReview || 0,
          icon: CreditCard,
          tone: "blue",
          filter: { billingStatus: "payment_under_review" },
        },
        {
          label: "Paid / Approved",
          value: summary.paid || 0,
          icon: CheckCircle2,
          tone: "emerald",
          filter: { billingStatus: "paid_approved" },
        },
      ];
    }

    if (mode === "gateOut") {
      return [
        {
          label: "Pending Gate-Out",
          value: summary.gateOutRequested || 0,
          icon: PackageCheck,
          tone: "amber",
          filter: { status: "gate_out_requested", billingStatus: "all" },
        },
        {
          label: "Reversal Requests",
          value: summary.gateOutReversalRequested || 0,
          icon: RotateCcw,
          tone: "amber",
          filter: {
            status: "gate_out_reversal_requested",
            billingStatus: "all",
          },
        },
        {
          label: "Payment Approved",
          value: summary.paid || 0,
          icon: CreditCard,
          tone: "blue",
          filter: { status: "all", billingStatus: "paid_approved" },
        },
        {
          label: "Released Containers",
          value: summary.completed || 0,
          icon: CheckCircle2,
          tone: "emerald",
          filter: { status: "completed_gate_out_done", billingStatus: "all" },
        },
      ];
    }

    return [
      {
        label: "Ready to Release",
        value: bookings.filter(
          (booking) => booking.status === "gate_out_approved",
        ).length,
        icon: Truck,
        tone: "amber",
        filter: { status: "gate_out_approved" },
      },
      {
        label: "Overstaying",
        value: bookings.filter((booking) => booking.isOverstaying).length,
        icon: Clock3,
        tone: "amber",
      },
      {
        label: "Reversal Requests",
        value: bookings.filter(
          (booking) => booking.status === "gate_out_reversal_requested",
        ).length,
        icon: RotateCcw,
        tone: "amber",
        filter: { status: "gate_out_reversal_requested" },
      },
      {
        label: "Released Containers",
        value: summary.completed || 0,
        icon: CheckCircle2,
        tone: "emerald",
        filter: { status: "completed_gate_out_done" },
      },
    ];
  }, [bookings, mode, summary]);

  const toneClasses = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };

  const showStatusFilters = !["preAdvice", "gateIn"].includes(mode);
  const activeFilterCount = [
    showStatusFilters && filters.status !== config.defaultStatus,
    showStatusFilters && filters.billingStatus !== config.defaultBillingStatus,
    filters.loadStatus !== "all",
    filters.rateType !== "all",
  ].filter(Boolean).length;
  const hasActiveSearchOrFilters =
    activeFilterCount > 0 || Boolean(filters.search.trim());

  const resetFilters = ({ clearSearch = false } = {}) =>
    setFilters((current) => ({
      status: config.defaultStatus,
      billingStatus: config.defaultBillingStatus,
      loadStatus: "all",
      rateType: "all",
      search: clearSearch ? "" : current.search,
    }));

  const handleSearch = () => {
    if (page !== 1) setPage(1);
    setDebouncedSearch(filters.search.trim());
    if (page === 1 && debouncedSearch === filters.search.trim())
      loadBookings({ force: true });
  };

  const requestDeleteBooking = (booking) => {
    if (!canDeleteBooking) return;
    setDeleteTarget(booking);
  };

  const cancelDeleteBooking = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const confirmDeleteBooking = async () => {
    const booking = deleteTarget;
    if (!booking || !canDeleteBooking) return;

    try {
      setDeletingId(booking.id);
      setAlert({ type: "", message: "" });
      const { data } = await api.delete(`/admin/bookings/${booking.id}`);
      if (selectedId === booking.id) closeBookingModal();
      setDeleteTarget(null);
      await loadBookings({ force: true });
      setAlert({
        type: "success",
        message: data.message || "Booking deleted successfully.",
      });
    } catch (error) {
      setDeleteTarget(null);
      setAlert({ type: "error", message: getApiError(error) });
    } finally {
      setDeletingId("");
    }
  };

  const renderRowActions = (booking) => (
    <TableCrudActions
      recordLabel={booking.bookingReference}
      onView={() => openBookingModal(booking, "view")}
      onEdit={() => openBookingModal(booking, "edit")}
      onDelete={() => requestDeleteBooking(booking)}
      editDisabled={config.primarySection !== "billing"}
      editLabel={
        config.primarySection === "billing"
          ? `Edit billing for ${booking.bookingReference}`
          : "Workflow decisions are managed from the View modal"
      }
      deleteDisabled={!canDeleteBooking}
      deleteLabel={
        canDeleteBooking
          ? `Delete ${booking.bookingReference}`
          : "You do not have permission to delete bookings"
      }
      deleting={deletingId === booking.id}
    >
      {["gateIn", "gateOut"].includes(config.primarySection) && (
        <TableActionButton
          label={
            getCashPaymentDisabledReason(booking) ||
            `Record cash payment for ${booking.bookingReference}`
          }
          menuLabel="Record cash payment"
          variant="success"
          disabled={Boolean(getCashPaymentDisabledReason(booking))}
          onClick={() => openCashPayment(booking)}
        >
          <Banknote size={17} aria-hidden="true" />
        </TableActionButton>
      )}
    </TableCrudActions>
  );

  const renderBillingCell = (booking) => {
    if (config.primarySection === "release") {
      const gateInTotal = Number(
        booking.gateInBillingTotal || booking.gateInPaymentTotal || 0,
      );
      const gateOutTotal = Number(
        booking.gateOutBillingTotal ?? booking.billingTotal ?? 0,
      );
      const totalBilling = Number(
        booking.totalBillingAmount ??
          (Number(booking.gateInBillingTotal || booking.gateInPaymentTotal) ||
            0) +
            (Number(booking.gateOutBillingTotal ?? booking.billingTotal) || 0),
      );
      return (
        <>
          <dl className="space-y-1 text-xs font-medium text-slate-600">
            <div className="flex justify-between gap-4">
              <dt>Gate-In</dt>
              <dd className="font-bold tabular-nums text-slate-900">
                {money(gateInTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Gate-Out</dt>
              <dd className="font-bold tabular-nums text-slate-900">
                {money(gateOutTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-1">
              <dt>Total</dt>
              <dd className="font-bold tabular-nums text-emerald-700">
                {money(totalBilling)}
              </dd>
            </div>
          </dl>
          <div className="mt-2">
            <StatusBadge
              status={booking.billingStatus}
              label={billingLabels[booking.billingStatus]}
            />
          </div>
        </>
      );
    }

    if (
      booking.status === "approved_area_assigned" &&
      booking.loloPaymentStage === "gate_out"
    ) {
      return (
        <>
          <p className="font-bold text-sky-700">Deferred to Gate-Out</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            No Gate-In payment
          </p>
        </>
      );
    }

    return (
      <>
        <p className="font-bold tabular-nums text-slate-900">
          {money(booking.billingTotal || booking.paymentAmount || 0)}
        </p>
        <div className="mt-2">
          <StatusBadge
            status={booking.billingStatus}
            label={billingLabels[booking.billingStatus]}
          />
        </div>
      </>
    );
  };

  const pageAlertVisible =
    Boolean(alert.message) &&
    !selectedBooking &&
    !showCashModal &&
    !showPaymentAdjustmentModal &&
    !deleteTarget;

  const modalAlert = alert.message ? (
    <div role="status" aria-live="polite">
      <Alert type={alert.type}>{alert.message}</Alert>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <section className="card p-5 otli-module-frame">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between otli-module-hero">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <HeaderIcon size={15} aria-hidden="true" /> {config.badge}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              {config.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              {config.description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="btn-secondary shrink-0"
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
              aria-hidden="true"
            />{" "}
            Refresh
          </button>
        </div>

        <div
          className={`otli-kpi-grid mt-5 grid gap-4 otli-module-kpis otli-module-kpis--icons-leading ${moduleStats.length === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}
        >
          {moduleStats.map((stat) => {
            const clickable = Boolean(stat.filter);
            const active =
              clickable &&
              Object.entries(stat.filter).every(
                ([key, value]) => filters[key] === value,
              );
            const Tag = clickable ? "button" : "div";
            return (
              <Tag
                key={stat.label}
                type={clickable ? "button" : undefined}
                onClick={
                  clickable
                    ? () =>
                        setFilters((current) => ({
                          ...current,
                          ...stat.filter,
                        }))
                    : undefined
                }
                aria-pressed={clickable ? active : undefined}
                title={
                  clickable ? `Show ${stat.label.toLowerCase()}` : undefined
                }
                className={`rounded-2xl border p-4 text-left transition ${toneClasses[stat.tone]} ${clickable ? "cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" : ""} ${active ? "ring-2 ring-emerald-500" : ""}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold opacity-80">
                      {stat.label}
                    </div>
                    <div className="mt-1 text-3xl font-bold tabular-nums">
                      {stat.value}
                    </div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 shadow-sm">
                    <stat.icon size={20} aria-hidden="true" />
                  </div>
                </div>
              </Tag>
            );
          })}
        </div>

        {pageAlertVisible && (
          <div className="mt-4" role="status" aria-live="polite">
            <Alert type={alert.type}>{alert.message}</Alert>
          </div>
        )}
      </section>

      <section className="card overflow-visible">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              {config.queueTitle}
            </h2>
            <p className="text-sm font-medium text-slate-500">
              Search and filter records before opening the complete booking
              details.
            </p>
          </div>

          <TableToolbar>
            <TableSearchField
                type="search"
                ariaLabel="Search bookings"
                placeholder="Search reference, container, client..."
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              />

            <div className="relative" ref={filterRef}>
              <TableFilterButton open={showFilters} onClick={() => setShowFilters((current) => !current)} label="Filters" count={activeFilterCount} />

              {showFilters && (
                <FilterDropdownPortal
                  open={showFilters}
                  anchorRef={filterRef}
                  onClose={() => setShowFilters(false)}
                  className="w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-sm font-bold text-slate-950">
                      Filter records
                    </p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                      onClick={() => resetFilters()}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-4 space-y-4">
                    {showStatusFilters && (
                      <>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Booking status
                          </span>
                          <select
                            className="input !py-3"
                            value={filters.status}
                            onChange={(event) =>
                              setFilters((current) => ({
                                ...current,
                                status: event.target.value,
                              }))
                            }
                          >
                            <option value="all">All booking statuses</option>
                            {Object.entries(statusLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Billing status
                          </span>
                          <select
                            className="input !py-3"
                            value={filters.billingStatus}
                            onChange={(event) =>
                              setFilters((current) => ({
                                ...current,
                                billingStatus: event.target.value,
                              }))
                            }
                          >
                            <option value="all">All billing statuses</option>
                            {Object.entries(billingLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </>
                    )}
                    <ContainerClassificationFilters
                      loadStatus={filters.loadStatus}
                      rateType={filters.rateType}
                      onLoadStatusChange={(loadStatus) =>
                        setFilters((current) => ({ ...current, loadStatus }))
                      }
                      onRateTypeChange={(rateType) =>
                        setFilters((current) => ({ ...current, rateType }))
                      }
                    />
                  </div>
                </FilterDropdownPortal>
              )}
            </div>
          </TableToolbar>
        </div>

        {config.primarySection === "billing" && (
          <FilterTabs
            label="Payment status"
            value={filters.billingStatus}
            onChange={(value) =>
              setFilters((current) => ({ ...current, billingStatus: value }))
            }
            options={[
              ["payment_under_review", "Under Review"],
              ["additional_payment_required", "Additional Payment Required"],
              ["paid_approved", "Approved Payments"],
              ["payment_rejected", "Rejected"],
              ["all", "All Payments"],
            ]}
          />
        )}

        {config.primarySection === "gateOut" && (
          <FilterTabs
            label="Gate-Out status"
            value={filters.status}
            onChange={(value) =>
              setFilters((current) => ({ ...current, status: value }))
            }
            options={[
              ["gate_out_requested", "Pending Gate-Out"],
              ["gate_out_approved", "Approved Gate-Out"],
              ["gate_out_reversal_requested", "Reversal Requests"],
              ["completed_gate_out_done", "Completed"],
              ["all", "All Gate-Out Records"],
            ]}
          />
        )}

        {config.primarySection === "release" && (
          <FilterTabs
            label="Release status"
            value={filters.status}
            onChange={(value) =>
              setFilters((current) => ({ ...current, status: value }))
            }
            options={[
              ["gate_out_approved", "Ready to Release"],
              ["gate_out_reversal_requested", "Reversal Requests"],
              ["completed_gate_out_done", "Released"],
              ["all", "All Release Records"],
            ]}
          />
        )}

        <div
          className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500"
          aria-live="polite"
        >
          Showing {pagination.startItem}-{pagination.endItem} of{" "}
          {pagination.totalItems} records in this module
        </div>

        {/* Desktop / tablet table */}
        <div className="hidden max-h-[70vh] overflow-auto md:block">
          <table className="otli-data-table w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="px-4 py-3 font-semibold">Booking / Client</th>
                <th className="px-4 py-3 font-semibold">Container</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Billing</th>
                <th className="px-4 py-3 font-semibold">Schedule / Location</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && bookings.length === 0 && (
                <TableLoadingRow
                  colSpan={6}
                  rows={7}
                  actionColumn
                  label="Loading booking records"
                />
              )}
              {pagination.paginatedItems.map((booking) => (
                <tr
                  key={booking.id}
                  tabIndex={0}
                  onClick={() => openBookingModal(booking, "view")}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      event.key === "Enter"
                    )
                      openBookingModal(booking, "view");
                  }}
                  aria-label={`Open ${booking.bookingReference}`}
                  className={`cursor-pointer align-top transition hover:bg-emerald-50/40 focus-visible:bg-emerald-50/60 focus-visible:outline-none ${loading ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-4">
                    <p className="font-bold text-emerald-700">
                      {booking.bookingReference}
                    </p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {booking.clientName || "Client"}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {booking.clientEmail || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-950">
                      {booking.containerNumber}
                    </p>
                    <p className="mt-1 text-xs font-semibold capitalize text-slate-500">
                      {booking.containerSize}ft •{" "}
                      {booking.containerType?.replaceAll("_", " ")}
                    </p>
                    <ContainerClassificationBadges
                      loadStatus={booking.containerLoadStatus}
                      rateType={booking.rateType}
                      className="mt-2"
                      compact
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {booking.shippingLine || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-2">
                      <StatusBadge
                        status={booking.status}
                        label={statusLabels[booking.status]}
                      />
                      {booking.isOverstaying && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-200">
                          <AlertTriangle size={12} aria-hidden="true" />
                          Overstaying
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">{renderBillingCell(booking)}</td>
                  <td className="px-4 py-4">
                    <p
                      className="font-semibold text-slate-800"
                      title={formatDate(getBookingInDate(booking))}
                    >
                      In: {formatShort(getBookingInDate(booking))}
                    </p>
                    {booking.outDate && (
                      <p
                        className="mt-1 text-xs font-semibold text-slate-600"
                        title={formatDate(booking.outDate)}
                      >
                        Out: {formatShort(booking.outDate)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {booking.assignedAreaName || "Yard area pending"} •{" "}
                      {booking.assignedSlotNumber || "No slot"}
                    </p>
                  </td>
                  <td
                    className="px-4 py-4 text-right"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {renderRowActions(booking)}
                  </td>
                </tr>
              ))}
              {!loading && bookings.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      filtered={hasActiveSearchOrFilters}
                      onClear={() => resetFilters({ clearSearch: true })}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards: same compact, action-safe layout in all five workflows. */}
        <div className="space-y-3 p-3 md:hidden" aria-label="Booking workflow records">
          {loading && bookings.length === 0 && (
            <div className="space-y-3" aria-busy="true" aria-label="Loading booking records">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          )}
          {pagination.paginatedItems.map((booking) => {
            const cashAllowed =
              ["gateIn", "gateOut"].includes(config.primarySection) &&
              !getCashPaymentDisabledReason(booking);
            return (
              <BookingMobileCard
                key={booking.id}
                booking={booking}
                statusLabel={statusLabels[booking.status] || booking.status}
                billingLabel={billingLabels[booking.billingStatus] || booking.billingStatus}
                progressContext={config.primarySection === "gateOut" || config.primarySection === "release" ? "outbound" : "auto"}
                onOpen={() => openBookingModal(booking, "view")}
                actions={renderRowActions(booking)}
                footer={
                  config.primarySection === "billing" || cashAllowed ? (
                    <>
                      {config.primarySection === "billing" && (
                        <button type="button" onClick={() => openBookingModal(booking, "edit")}
                          className="min-h-10 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                          Edit billing
                        </button>
                      )}
                      {cashAllowed && (
                        <button type="button" onClick={() => openCashPayment(booking)}
                          className="min-h-10 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                          Record cash
                        </button>
                      )}
                    </>
                  ) : null
                }
              >
                <BookingCardDetail label="Container type">
                  {String(booking.containerType || "Not provided").replaceAll("_", " ")}
                </BookingCardDetail>
                <BookingCardDetail label="Classification">
                  {String(booking.containerLoadStatus || "Unknown").replaceAll("_", " ")} · {String(booking.rateType || "Unknown").replaceAll("_", " ")}
                </BookingCardDetail>
                <BookingCardDetail label="Billing amount">
                  {money(booking.billingTotal || booking.paymentAmount || 0)}
                </BookingCardDetail>
                <BookingCardDetail label="Client email">
                  <span className="break-all">{booking.clientEmail || "Not provided"}</span>
                </BookingCardDetail>
                {booking.isOverstaying && (
                  <div className="col-span-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800">
                    <AlertTriangle size={13} className="mr-1 inline" /> Overstaying
                  </div>
                )}
              </BookingMobileCard>
            );
          })}
          {!loading && bookings.length === 0 && (
            <EmptyState
              filtered={hasActiveSearchOrFilters}
              onClear={() => resetFilters({ clearSearch: true })}
            />
          )}
        </div>
        <Pagination {...pagination} />
      </section>

      {selectedBooking && (
        <Modal
          eyebrow={`${selectedModalMode === "edit" ? "Edit" : "View"} • ${config.badge}`}
          title={selectedBooking.containerNumber}
          subtitle={[
            selectedBooking.bookingReference,
            selectedBooking.clientName,
            selectedBooking.clientEmail,
          ]
            .filter(Boolean)
            .join(" • ")}
          badges={
            <>
              <StatusBadge
                status={selectedBooking.status}
                label={statusLabels[selectedBooking.status]}
              />
              <StatusBadge
                status={selectedBooking.billingStatus}
                label={billingLabels[selectedBooking.billingStatus]}
              />
              <ContainerClassificationBadges
                loadStatus={selectedBooking.containerLoadStatus}
                rateType={selectedBooking.rateType}
              />
            </>
          }
          onClose={closeBookingModal}
        >
          <div className="space-y-6 p-5">
            {/* Feedback appears where the admin is looking, not behind the overlay. */}
            {modalAlert}

            <WorkflowStepper status={selectedBooking.status} />

            <div className="card p-5">
              <h3 className="text-sm font-bold text-slate-950">
                Booking summary
              </h3>
              <dl className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    "Booking No.",
                    selectedBooking.bookingNumber || "Generated after approval",
                  ],
                  ["Size", `${selectedBooking.containerSize}ft`],
                  ["Type", selectedBooking.containerType?.replaceAll("_", " ")],
                  ["Load", selectedBooking.containerLoadStatus],
                  ["Shipping line", selectedBooking.shippingLine],
                  ["In date", formatDate(getBookingInDate(selectedBooking))],
                  [
                    "Requested date / time out",
                    formatDate(getBookingOutDate(selectedBooking)),
                  ],
                  [
                    "Assigned slot",
                    selectedBooking.assignedSlotNumber || "Pending",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-0.5 font-semibold capitalize text-slate-900">
                      {value || "-"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {isPreAdviceApprovalMode && (
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck
                    size={18}
                    className="text-emerald-700"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-bold text-slate-950">
                    Submitted pre-advice documents
                  </h3>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Review the files uploaded together with the client booking.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(selectedBooking.documents || []).map((document, index) => (
                    <a
                      key={`${document.url}-${index}`}
                      href={resolveFileUrl(document.secureUrl || document.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <div className="text-sm font-bold text-slate-900">
                        {document.label || "Document"}
                      </div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-500">
                        {document.fileName || `File ${index + 1}`}
                      </div>
                    </a>
                  ))}
                  {(selectedBooking.documents || []).length === 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 sm:col-span-2">
                      No pre-advice documents were uploaded with this booking.
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedModalMode === "view" && (
              <>
                <BookingModuleViewSummary
                  booking={selectedBooking}
                  section={config.primarySection}
                />
                {user?.role === "super_admin" &&
                  ["gateIn", "gateOut"].includes(config.primarySection) && (
                    <StagePaymentAdjustment
                      booking={selectedBooking}
                      stage={
                        config.primarySection === "gateIn"
                          ? "gate_in"
                          : "gate_out"
                      }
                      onEdit={openPaymentAdjustment}
                    />
                  )}
                {config.primarySection === "billing" && (
                  <WorkflowDecisionPanel
                    icon={CreditCard}
                    eyebrow="Payment Verification"
                    title="Payment Decision"
                    description="Approve or reject the submitted payment after reviewing the billing details and proof of payment above."
                    approveLabel="Approve Payment"
                    onApprove={approvePayment}
                    approveDisabled={
                      saving ||
                      ![
                        "payment_submitted",
                        "payment_under_review",
                        "payment_rejected",
                      ].includes(selectedBooking.billingStatus)
                    }
                    rejectLabel="Reject Payment"
                    rejectReason={paymentRejectReason}
                    onRejectReasonChange={setPaymentRejectReason}
                    rejectPlaceholder="Explain why the submitted payment is being rejected"
                    rejectFieldDisabled={
                      !["payment_submitted", "payment_under_review"].includes(
                        selectedBooking.billingStatus,
                      )
                    }
                    onReject={rejectPayment}
                    rejectDisabled={
                      saving ||
                      !paymentRejectReason.trim() ||
                      !["payment_submitted", "payment_under_review"].includes(
                        selectedBooking.billingStatus,
                      )
                    }
                  >
                    <Field
                      label="Approval remarks"
                      hint="Optional remarks are recorded with the payment decision."
                    >
                      <textarea
                        className="input min-h-[82px]"
                        placeholder="Add payment review remarks"
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                      />
                    </Field>
                  </WorkflowDecisionPanel>
                )}
              </>
            )}

            <>
              {selectedModalMode === "view" &&
                config.primarySection === "approval" && (
                  <WorkflowDecisionPanel
                    icon={MapPinned}
                    eyebrow={
                      isPreAdviceApprovalMode
                        ? "Pre-Advice Review"
                        : "Booking Review"
                    }
                    title={
                      isPreAdviceApprovalMode
                        ? "Pre-Advice Decision and Yard Assignment"
                        : "Booking Decision and Yard Assignment"
                    }
                    description="Review the submitted details, select an available yard location, then approve or reject this request."
                    approveLabel="Approve / Assign"
                    approveIcon={MapPinned}
                    onApprove={approveBooking}
                    approveDisabled={
                      saving ||
                      selectedBooking.status !== "pending_admin_approval" ||
                      !approvalReady
                    }
                    rejectLabel={
                      isPreAdviceApprovalMode
                        ? "Reject Pre-Advice"
                        : "Reject Booking"
                    }
                    rejectReason={rejectReason}
                    onRejectReasonChange={setRejectReason}
                    rejectPlaceholder="Explain why this request is being rejected"
                    rejectFieldDisabled={
                      selectedBooking.status !== "pending_admin_approval"
                    }
                    onReject={rejectBooking}
                    rejectDisabled={
                      saving ||
                      !rejectReason.trim() ||
                      selectedBooking.status !== "pending_admin_approval"
                    }
                    secondaryActions={
                      <button
                        type="button"
                        onClick={cancelBooking}
                        className={dangerGhostButton}
                        disabled={
                          saving ||
                          !rejectReason.trim() ||
                          ![
                            "pending_admin_approval",
                            "approved_area_assigned",
                          ].includes(selectedBooking.status)
                        }
                        title="Enter a reason above to enable cancellation"
                      >
                        <Trash2 size={16} /> Cancel Pre-Advice
                      </button>
                    }
                  >
                    <ChecklistPanel
                      title="Before you can approve"
                      items={approvalChecks}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Field
                          label="LOLO payment collection"
                          hint="Choose when Lift On / Lift Off will be collected for this booking. Storage and all other charges stay payable only at Gate-Out."
                        >
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label
                              className={`cursor-pointer rounded-2xl border p-4 transition ${approval.loloPaymentStage === "gate_in" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                            >
                              <input
                                type="radio"
                                name="loloPaymentStage"
                                className="mr-2"
                                checked={
                                  approval.loloPaymentStage === "gate_in"
                                }
                                onChange={() =>
                                  setApproval((current) => ({
                                    ...current,
                                    loloPaymentStage: "gate_in",
                                  }))
                                }
                              />
                              <strong>Collect at Gate-In</strong>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                LOLO must be fully paid and approved before
                                Gate-In approval.
                              </p>
                            </label>
                            <label
                              className={`cursor-pointer rounded-2xl border p-4 transition ${approval.loloPaymentStage === "gate_out" ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                            >
                              <input
                                type="radio"
                                name="loloPaymentStage"
                                className="mr-2"
                                checked={
                                  approval.loloPaymentStage === "gate_out"
                                }
                                onChange={() =>
                                  setApproval((current) => ({
                                    ...current,
                                    loloPaymentStage: "gate_out",
                                  }))
                                }
                              />
                              <strong>Collect at Gate-Out</strong>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                Gate-In can proceed without LOLO payment. LOLO
                                joins storage and other charges at Gate-Out.
                              </p>
                            </label>
                          </div>
                        </Field>
                      </div>
                      {isPreAdviceApprovalMode ? (
                        <div className="md:col-span-2">
                          <Field
                            label="Yard area"
                            hint="Select the yard area where the container will be assigned."
                          >
                            <select
                              className="input"
                              value={approval.blockId}
                              onChange={(event) =>
                                handleApprovalAreaChange(event.target.value)
                              }
                            >
                              <option value="">Select yard area</option>
                              {usableBlocks.map((area) => {
                                const hasCapacity = blockHasCapacity(
                                  area,
                                  selectedBooking,
                                );
                                const congestionDisabled =
                                  area.isCongestionArea && regularYardHasSpace;
                                return (
                                  <option
                                    key={area.id}
                                    value={area.id}
                                    disabled={
                                      !hasCapacity || congestionDisabled
                                    }
                                  >
                                    {area.isCongestionArea
                                      ? "[CONGESTION] "
                                      : ""}
                                    {area.areaName || area.name || "Yard Area"}{" "}
                                    • {area.areaCode || area.code || "AREA"} •{" "}
                                    {hasCapacity
                                      ? `${area.availableSlots ?? 0} ${area.capacityUnit || "slot(s)"} left`
                                      : "FULL"}
                                  </option>
                                );
                              })}
                            </select>
                          </Field>
                          {areas.length === 0 && (
                            <div className="mt-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
                              No yard area found. Add an active area in Yard
                              Area Setup first.
                            </div>
                          )}
                          {areas.length > 0 && blocks.length === 0 && (
                            <div className="mt-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
                              Yard areas exist, but the approval area list was
                              not loaded. Refresh this page after restarting the
                              updated server.
                            </div>
                          )}
                          {blocks.length > 0 && usableBlocks.length === 0 && (
                            <div className="mt-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
                              No active yard area is available. Check the yard
                              area status in Yard Area Setup.
                            </div>
                          )}
                          {usableBlocks.length > 0 && regularYardHasSpace && (
                            <div className="mt-2 rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                              Regular yard capacity is available. Congestion
                              areas remain disabled until regular capacity is
                              full.
                            </div>
                          )}
                          {usableBlocks.length > 0 && !regularYardHasSpace && (
                            <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                              <p>
                                Regular yard capacity is full. Select a
                                designated congestion area.
                              </p>
                              {congestionLoading && (
                                <p className="mt-1">
                                  Checking the configured congestion
                                  surcharge...
                                </p>
                              )}
                              {!congestionLoading &&
                                congestionOption?.available && (
                                  <p className="mt-1">
                                    A {money(congestionOption.rate?.rateAmount)}{" "}
                                    surcharge will be added automatically.
                                  </p>
                                )}
                              {!congestionLoading &&
                                !congestionOption?.available && (
                                  <p className="mt-1 text-red-700">
                                    {congestionOption?.reason ||
                                      (hasCongestionArea
                                        ? "Configure the congestion surcharge rate before approval."
                                        : "Create a designated congestion area in Yard Area Setup.")}
                                  </p>
                                )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <Field label="Yard block / area">
                            <select
                              className="input"
                              value={approval.areaId}
                              onChange={(event) =>
                                setApproval((current) => ({
                                  ...current,
                                  areaId: event.target.value,
                                  blockId: "",
                                  bay: "",
                                  row: "",
                                  tier: "",
                                }))
                              }
                            >
                              <option value="">
                                Select Alpha, Bravo, Echo, etc.
                              </option>
                              {areas.map((area) => (
                                <option key={area.id} value={area.id}>
                                  {area.name} • {area.availableSlots} TEU
                                  available
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field
                            label="Block section"
                            hint="Only active matching container-size block sections are shown."
                          >
                            <select
                              className="input"
                              value={approval.blockId}
                              onChange={(event) =>
                                setApproval((current) => ({
                                  ...current,
                                  blockId: event.target.value,
                                  bay: "",
                                  row: "",
                                  tier: "",
                                }))
                              }
                            >
                              <option value="">Select block section</option>
                              {usableBlocks.map((block) => (
                                <option key={block.id} value={block.id}>
                                  {block.code} • {block.availableSlots} TEU left
                                  • {block.containerSize}ft
                                </option>
                              ))}
                            </select>
                          </Field>
                        </>
                      )}
                    </div>
                    {selectedBlock && (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                          {isPreAdviceApprovalMode
                            ? `${selectedBlock.areaName || selectedBlock.name || "Yard Area"}`
                            : selectedBlock.name ||
                              selectedBlock.code ||
                              "Selected block"}
                          : {selectedBlock.occupiedSlots}/
                          {selectedBlock.capacityTeu}{" "}
                          {selectedBlock.capacityUnit ||
                            (Number(selectedBlock.containerSize) === 20
                              ? "TEU"
                              : "FEU")}{" "}
                          used, {selectedBlock.availableSlots}{" "}
                          {selectedBlock.capacityUnit ||
                            (Number(selectedBlock.containerSize) === 20
                              ? "TEU"
                              : "FEU")}{" "}
                          remaining.{" "}
                          {hasSelectedSlot
                            ? `Selected location: B${approval.bay}-R${approval.row}-T${approval.tier}.`
                            : "Choose an available slot below."}
                        </div>
                        {selectedUsesCongestionArea && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                            This is a designated congestion area. The congestion
                            surcharge will be added automatically when this
                            pre-advice is approved.
                          </div>
                        )}
                        {!selectedBlockHasCapacity && (
                          <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                            This yard area does not have enough remaining
                            capacity for the container.
                          </div>
                        )}
                        {selectedSlotOutOfBounds && (
                          <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                            The selected 40ft location no longer has two
                            consecutive TEU slots. Choose another available
                            slot.
                          </div>
                        )}
                        {selectedSlotTaken && (
                          <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                            The selected location was just reserved or occupied.
                            Choose another available slot.
                          </div>
                        )}
                        <AvailableSlotPicker
                          block={selectedBlock}
                          unavailableSlots={slotAvailability}
                          containerSize={selectedBooking?.containerSize}
                          selectedBay={approval.bay}
                          selectedRow={approval.row}
                          selectedTier={approval.tier}
                          loading={slotsLoading}
                          disabled={!selectedBlockHasCapacity}
                          emptyMessage="No available slot can fit this container in the selected yard area. Choose another yard area."
                          onSelect={(slot) =>
                            setApproval((current) => ({
                              ...current,
                              bay: slot.bay,
                              row: slot.row,
                              tier: slot.tier,
                            }))
                          }
                        />
                      </div>
                    )}
                  </WorkflowDecisionPanel>
                )}

              {selectedModalMode === "view" &&
                config.primarySection === "gateIn" && (
                  <WorkflowDecisionPanel
                    icon={Truck}
                    eyebrow="Gate-In Review"
                    title="Gate-In Check and Inspection"
                    description="Complete the physical inspection details, then approve or reject the Gate-In request."
                    approveLabel="Approve Gate-In"
                    approveIcon={Truck}
                    onApprove={approveGateIn}
                    approveDisabled={saving || !gateInReady}
                    note={
                      selectedBooking.loloPaymentStage === "gate_out"
                        ? "LOLO collection is set to Gate-Out. No LOLO payment is required before Gate-In approval."
                        : !gateInLoloCleared
                          ? "Gate-In approval is locked until the Lift On / Lift Off (LOLO) charge is fully paid and approved."
                          : "Gate-In LOLO payment is fully approved. Physical inspection can proceed."
                    }
                    rejectLabel="Reject Gate-In"
                    rejectReason={rejectReason}
                    onRejectReasonChange={setRejectReason}
                    rejectPlaceholder="Explain why Gate-In is being rejected"
                    rejectFieldDisabled={
                      selectedBooking.status !== "approved_area_assigned"
                    }
                    onReject={rejectGateIn}
                    rejectDisabled={
                      saving ||
                      !rejectReason.trim() ||
                      selectedBooking.status !== "approved_area_assigned"
                    }
                    secondaryActions={
                      <button
                        type="button"
                        onClick={cancelBooking}
                        className={dangerGhostButton}
                        disabled={
                          saving ||
                          !rejectReason.trim() ||
                          ![
                            "approved_area_assigned",
                            "gate_in_approved",
                          ].includes(selectedBooking.status)
                        }
                        title="Enter a reason above to enable cancellation"
                      >
                        <Trash2 size={16} /> Cancel Gate-In
                      </button>
                    }
                  >
                    <ChecklistPanel
                      title="Before you can approve"
                      items={gateInChecks}
                    />
                    {user?.role === "super_admin" &&
                      selectedBooking.status === "approved_area_assigned" && (
                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex flex-col gap-3 border-b border-emerald-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold text-emerald-700">
                                Super admin • editable Gate-In details
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-600">
                                Update the approved booking details before
                                Gate-In. Size, classification, Gate-In schedule,
                                truck and shipping details can all be corrected
                                here.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn-primary shrink-0"
                              onClick={saveGateInDetails}
                              disabled={saving}
                            >
                              <CheckCircle2 size={16} /> Save Gate-In details
                            </button>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Field label="Container number">
                              <input
                                className="input uppercase"
                                value={gateInDetails.containerNumber}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    containerNumber:
                                      event.target.value.toUpperCase(),
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Container size">
                              <select
                                className="input"
                                value={gateInDetails.containerSize}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    containerSize: event.target.value,
                                  }))
                                }
                              >
                                <option value="20">20 ft</option>
                                <option value="40">40 ft</option>
                              </select>
                            </Field>
                            <Field label="Local / International">
                              <select
                                className="input"
                                value={gateInDetails.rateType}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    rateType: event.target.value,
                                  }))
                                }
                              >
                                <option value="local">Local</option>
                                <option value="international">
                                  International
                                </option>
                              </select>
                            </Field>
                            <Field
                              label="Gate-In date / time"
                              hint="Gate-In capacity remains limited to 4 containers per hour."
                            >
                              <input
                                type="datetime-local"
                                step="3600"
                                className="input"
                                value={gateInDetails.inDate}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    inDate: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Container type">
                              <select
                                className="input"
                                value={gateInDetails.containerType}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    containerType: event.target.value,
                                  }))
                                }
                              >
                                <option value="dry">Dry</option>
                                <option value="reefer">Reefer</option>
                                <option value="tank">Tank</option>
                                <option value="open_top">Open Top</option>
                                <option value="flat_rack">Flat Rack</option>
                              </select>
                            </Field>
                            <Field label="Load status">
                              <select
                                className="input"
                                value={gateInDetails.containerLoadStatus}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    containerLoadStatus: event.target.value,
                                  }))
                                }
                              >
                                <option value="empty">Empty</option>
                                <option value="laden">Laden</option>
                              </select>
                            </Field>
                            <Field label="Weight">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="input"
                                value={gateInDetails.weight}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    weight: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Shipping line">
                              <input
                                className="input"
                                value={gateInDetails.shippingLine}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    shippingLine: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Booking number">
                              <input
                                className="input"
                                value={gateInDetails.bookingNumber}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    bookingNumber: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="BL number">
                              <input
                                className="input"
                                value={gateInDetails.blNumber}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    blNumber: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Vessel / voyage">
                              <input
                                className="input"
                                value={gateInDetails.vesselVoyage}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    vesselVoyage: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Truck plate">
                              <input
                                className="input uppercase"
                                value={gateInDetails.truckPlateNumber}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    truckPlateNumber:
                                      event.target.value.toUpperCase(),
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Driver name">
                              <input
                                className="input"
                                value={gateInDetails.driverName}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    driverName: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Driver license">
                              <input
                                className="input"
                                value={gateInDetails.driverLicenseNumber}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    driverLicenseNumber: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Hauler">
                              <input
                                className="input"
                                value={gateInDetails.hauler}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    hauler: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                          </div>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field label="Cargo description">
                              <textarea
                                className="input min-h-[82px]"
                                value={gateInDetails.cargoDescription}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    cargoDescription: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                            <Field label="Client remarks">
                              <textarea
                                className="input min-h-[82px]"
                                value={gateInDetails.clientRemarks}
                                onChange={(event) =>
                                  setGateInDetails((current) => ({
                                    ...current,
                                    clientRemarks: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                          </div>
                        </div>
                      )}

                    {selectedBooking.loloPaymentStage === "gate_out" ? (
                      <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
                        <p className="text-xs font-semibold text-sky-700">
                          LOLO payment deferred to Gate-Out
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          Admin selected Gate-Out collection for Lift On / Lift
                          Off. Gate-In does not require payment. LOLO, storage,
                          congestion, and other charges will be collected at
                          Gate-Out.
                        </p>
                        <div className="mt-4 rounded-2xl bg-white p-3 text-sm">
                          <p className="text-xs font-semibold text-slate-400">
                            Gate-In amount due
                          </p>
                          <p className="mt-1 font-bold text-emerald-700">
                            {money(0)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold text-sky-700">
                              Gate-In LOLO payment
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-700">
                              Lift On and Lift Off are collected at Gate-In.
                              Storage, congestion, and other charges are payable
                              only at Gate-Out.
                            </p>
                          </div>
                          {Number(
                            selectedBooking.paymentBalanceDue ??
                              selectedBooking.paymentAmount ??
                              0,
                          ) > 0 && (
                            <button
                              type="button"
                              onClick={() => openCashPayment(selectedBooking)}
                              className="btn-secondary shrink-0"
                              disabled={
                                saving ||
                                Boolean(
                                  getCashPaymentDisabledReason(selectedBooking),
                                )
                              }
                              title={
                                getCashPaymentDisabledReason(selectedBooking) ||
                                "Record Gate-In LOLO cash payment"
                              }
                            >
                              <Banknote size={16} /> Record LOLO cash
                            </button>
                          )}
                        </div>
                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs font-semibold text-slate-400">
                              LOLO gross bill
                            </p>
                            <p className="mt-1 font-bold tabular-nums text-slate-900">
                              {money(selectedBooking.billingTotal)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs font-semibold text-slate-400">
                              Balance due
                            </p>
                            <p className="mt-1 font-bold tabular-nums text-slate-900">
                              {money(
                                selectedBooking.paymentBalanceDue ??
                                  selectedBooking.paymentAmount ??
                                  0,
                              )}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white p-3">
                            <p className="text-xs font-semibold text-slate-400">
                              Payment status
                            </p>
                            <div className="mt-1">
                              <StatusBadge
                                status={selectedBooking.billingStatus}
                                label={
                                  billingLabels[selectedBooking.billingStatus]
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Actual container number">
                        <input
                          className="input uppercase"
                          value={gateIn.actualContainerNumber}
                          onChange={(event) =>
                            setGateIn((current) => ({
                              ...current,
                              actualContainerNumber: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Seal number">
                        <input
                          className="input"
                          value={gateIn.sealNumber}
                          onChange={(event) =>
                            setGateIn((current) => ({
                              ...current,
                              sealNumber: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Seal intact">
                        <select
                          className="input"
                          value={gateIn.sealIntact}
                          onChange={(event) =>
                            setGateIn((current) => ({
                              ...current,
                              sealIntact: event.target.value,
                            }))
                          }
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </Field>
                      <Field
                        label="Physical condition summary"
                        hint="Automatically generated from the selected condition checklist below."
                      >
                        <input
                          className="input bg-slate-50"
                          value={formatConditionSummary(
                            gateIn.gateInConditions,
                            gateIn.gateInConditionOther,
                          )}
                          readOnly
                        />
                      </Field>
                    </div>
                    <Field
                      label="Container condition upon entry"
                      hint="You can select multiple conditions, including Other with a custom note."
                    >
                      <ConditionChecklist
                        value={gateIn.gateInConditions}
                        otherValue={gateIn.gateInConditionOther}
                        onToggle={(option) =>
                          setGateIn((current) => ({
                            ...current,
                            gateInConditions: toggleConditionSelection(
                              current.gateInConditions,
                              option,
                            ),
                          }))
                        }
                        onOtherChange={(value) =>
                          setGateIn((current) => ({
                            ...current,
                            gateInConditionOther: value,
                          }))
                        }
                      />
                    </Field>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Truck plate">
                        <input
                          className="input uppercase"
                          value={gateIn.truckPlateNumber}
                          onChange={(event) =>
                            setGateIn((current) => ({
                              ...current,
                              truckPlateNumber:
                                event.target.value.toUpperCase(),
                            }))
                          }
                        />
                      </Field>
                      <Field label="Driver name">
                        <input
                          className="input"
                          value={gateIn.driverName}
                          onChange={(event) =>
                            setGateIn((current) => ({
                              ...current,
                              driverName: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Driver license">
                        <input
                          className="input"
                          value={gateIn.driverLicenseNumber}
                          onChange={(event) =>
                            setGateIn((current) => ({
                              ...current,
                              driverLicenseNumber: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Hauler">
                        <input
                          className="input"
                          value={
                            selectedBooking.hauler || gateInDetails.hauler || ""
                          }
                          readOnly
                        />
                      </Field>
                    </div>
                    <Field label="Inspection remarks">
                      <textarea
                        className="input mt-4 min-h-[82px]"
                        value={gateIn.inspectionRemarks}
                        onChange={(event) =>
                          setGateIn((current) => ({
                            ...current,
                            inspectionRemarks: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </WorkflowDecisionPanel>
                )}

              {selectedModalMode === "edit" &&
                config.primarySection === "billing" && (
                  <div className="card p-5">
                    <div className="flex items-center gap-2">
                      <CreditCard
                        size={18}
                        className="text-emerald-700"
                        aria-hidden="true"
                      />
                      <h3 className="text-lg font-bold text-slate-950">
                        Payment verification
                      </h3>
                    </div>
                    <div className="mt-4 space-y-1.5 rounded-3xl bg-slate-50 p-4 text-sm">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-500">
                          Applied rate classification:
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${selectedBooking.rateType === "international" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}
                        >
                          {selectedBooking.rateType === "international"
                            ? "International"
                            : "Local"}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          Automatically taken from this container booking
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Container:
                        </span>{" "}
                        {selectedBooking.containerNumber} •{" "}
                        {selectedBooking.containerSize}ft •{" "}
                        {selectedBooking.containerLoadStatus || "-"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Subtotal:
                        </span>{" "}
                        {money(selectedBooking.billingSubtotal)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          VAT ({Number(selectedBooking.vatRate ?? 0.12) * 100}
                          %):
                        </span>{" "}
                        {money(selectedBooking.vatAmount)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Total billing amount:
                        </span>{" "}
                        <strong>
                          {money(
                            selectedBooking.billingTotal ||
                              selectedBooking.paymentAmount ||
                              0,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Payment submitted:
                        </span>{" "}
                        {money(selectedBooking.paymentAmount)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Payment reference:
                        </span>{" "}
                        {selectedBooking.paymentReferenceNumber ||
                          "Auto-generated on submit"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Computed:
                        </span>{" "}
                        {formatDate(selectedBooking.billingComputedAt)} •{" "}
                        {selectedBooking.billingDays || 0} calendar billing
                        day(s)
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Submitted:
                        </span>{" "}
                        {formatDate(selectedBooking.paymentSubmittedAt)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Payment type:
                        </span>{" "}
                        {selectedBooking.paymentTypeSnapshot?.name ||
                          "Not selected"}
                      </div>
                      {selectedBooking.paymentTypeSnapshot?.accountNumber && (
                        <div>
                          <span className="font-semibold text-slate-500">
                            Paid to:
                          </span>{" "}
                          {selectedBooking.paymentTypeSnapshot.bankName ||
                            selectedBooking.paymentTypeSnapshot.name}{" "}
                          • {selectedBooking.paymentTypeSnapshot.accountNumber}{" "}
                          • {selectedBooking.paymentTypeSnapshot.accountName}
                        </div>
                      )}
                      {(selectedBooking.billingLineItems || []).length > 0 && (
                        <div className="mt-3 space-y-2">
                          {(selectedBooking.billingLineItems || []).map(
                            (item, index) => (
                              <div
                                key={`${item.chargeCode}-${index}`}
                                className="flex flex-col justify-between gap-1 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:flex-row"
                              >
                                <span>
                                  {item.description || item.chargeCode} •{" "}
                                  {item.quantity} x {money(item.rateAmount)}{" "}
                                  <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500">
                                    {item.rateType || selectedBooking.rateType}
                                  </span>
                                </span>
                                <span className="tabular-nums">
                                  {money(item.amount)}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(selectedBooking.paymentProofs || []).map(
                          (doc, index) => (
                            <a
                              key={`${doc.url}-${index}`}
                              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 underline"
                              href={resolveFileUrl(doc.secureUrl || doc.url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {doc.label || "Payment Proof"} {index + 1}
                            </a>
                          ),
                        )}
                      </div>
                    </div>

                    {["unpaid", "payment_rejected"].includes(
                      selectedBooking.billingStatus,
                    ) && (
                      <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-emerald-700">
                              Additional billing
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-600">
                              Add one-time charges before payment is submitted.
                            </p>
                          </div>
                          <Plus
                            size={18}
                            className="text-emerald-700"
                            aria-hidden="true"
                          />
                        </div>
                        {(selectedBooking.additionalBillingCharges || [])
                          .length > 0 && (
                          <div className="mt-4 space-y-2">
                            {(
                              selectedBooking.additionalBillingCharges || []
                            ).map((charge) => (
                              <div
                                key={charge.id}
                                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm shadow-sm"
                              >
                                <div>
                                  <p className="font-bold text-slate-900">
                                    {charge.description}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {charge.quantity} x{" "}
                                    {money(charge.rateAmount)} ={" "}
                                    {money(charge.amount)}
                                  </p>
                                </div>
                                {charge.source === "congestion_surcharge" ? (
                                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                    Pre-Advice Applied
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeAdditionalCharge(charge.id)
                                    }
                                    disabled={
                                      saving ||
                                      !["unpaid", "payment_rejected"].includes(
                                        selectedBooking.billingStatus,
                                      )
                                    }
                                    className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-700 disabled:opacity-40"
                                    aria-label={`Remove additional charge ${charge.description}`}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_100px_150px_auto]">
                          <input
                            className="input bg-white"
                            aria-label="Charge description"
                            placeholder="Charge description"
                            value={additionalCharge.description}
                            onChange={(event) =>
                              setAdditionalCharge((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            disabled={
                              !["unpaid", "payment_rejected"].includes(
                                selectedBooking.billingStatus,
                              )
                            }
                          />
                          <input
                            className="input bg-white"
                            aria-label="Quantity"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Qty"
                            value={additionalCharge.quantity}
                            onChange={(event) =>
                              setAdditionalCharge((current) => ({
                                ...current,
                                quantity: event.target.value,
                              }))
                            }
                            disabled={
                              !["unpaid", "payment_rejected"].includes(
                                selectedBooking.billingStatus,
                              )
                            }
                          />
                          <input
                            className="input bg-white"
                            aria-label="Rate"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Rate"
                            value={additionalCharge.rateAmount}
                            onChange={(event) =>
                              setAdditionalCharge((current) => ({
                                ...current,
                                rateAmount: event.target.value,
                              }))
                            }
                            disabled={
                              !["unpaid", "payment_rejected"].includes(
                                selectedBooking.billingStatus,
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={addAdditionalCharge}
                            className="btn-primary"
                            disabled={
                              saving ||
                              !["unpaid", "payment_rejected"].includes(
                                selectedBooking.billingStatus,
                              )
                            }
                          >
                            <Plus size={16} /> Add
                          </button>
                        </div>
                        <input
                          className="input mt-3 bg-white"
                          aria-label="Optional notes for this charge"
                          placeholder="Optional notes for this charge"
                          value={additionalCharge.notes}
                          onChange={(event) =>
                            setAdditionalCharge((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                        />
                      </div>
                    )}

                    <textarea
                      className="input mt-4 min-h-[82px]"
                      aria-label="Billing remarks"
                      placeholder="Billing remarks"
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                    />
                    <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50 p-3 text-xs font-semibold text-sky-700">
                      Payment approval and rejection are available from the View
                      modal after the submitted details are reviewed.
                    </div>
                  </div>
                )}

              {selectedModalMode === "view" &&
                ["gateOut", "release"].includes(config.primarySection) &&
                selectedBooking.status === "gate_out_reversal_requested" && (
                  <WorkflowDecisionPanel
                    icon={RotateCcw}
                    eyebrow="Gate-Out Reversal Review"
                    title="Return Container to Storage"
                    description="Review the client request before cancelling the approved Gate-Out. Approval keeps the container in its current yard slot, resumes storage billing, and preserves the approved payment as booking credit."
                    approveLabel="Approve Return to Storage"
                    approveIcon={RotateCcw}
                    onApprove={approveGateOutReversal}
                    approveDisabled={
                      saving || Boolean(selectedBooking.releasedAt)
                    }
                    rejectLabel="Reject Reversal"
                    rejectReason={reversalRejectReason}
                    onRejectReasonChange={setReversalRejectReason}
                    rejectPlaceholder="Explain why the container must remain ready for release"
                    onReject={rejectGateOutReversal}
                    rejectDisabled={saving || !reversalRejectReason.trim()}
                    note="Do not approve if the container has physically exited the yard. A completed release requires a new Gate-In transaction instead of reversal."
                  >
                    <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                      <div>
                        <span className="font-semibold text-slate-500">
                          Container:
                        </span>{" "}
                        {selectedBooking.containerNumber}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Current slot:
                        </span>{" "}
                        {selectedBooking.assignedSlotNumber || "Not assigned"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Gate-Out approved:
                        </span>{" "}
                        {formatDate(selectedBooking.gateOutApprovedAt)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Reversal requested:
                        </span>{" "}
                        {formatDate(selectedBooking.gateOutReversalRequestedAt)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Approved payment:
                        </span>{" "}
                        {money(
                          selectedBooking.approvedPaymentAmount ||
                            selectedBooking.billingTotal ||
                            0,
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Current gross bill:
                        </span>{" "}
                        {money(selectedBooking.billingTotal)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <p className="font-bold">Client reason</p>
                      <p className="mt-1 font-medium leading-6">
                        {selectedBooking.gateOutReversalRequestReason ||
                          "No reason provided."}
                      </p>
                    </div>

                    <Field
                      label="Admin remarks"
                      hint="Optional remarks are recorded in booking history and shown to the client."
                    >
                      <textarea
                        className="input min-h-[82px]"
                        maxLength={500}
                        placeholder="Add notes about returning this container to storage"
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                      />
                    </Field>
                  </WorkflowDecisionPanel>
                )}

              {selectedModalMode === "view" &&
                ["gateOut", "release"].includes(config.primarySection) &&
                selectedBooking.status !== "gate_out_reversal_requested" && (
                  <WorkflowDecisionPanel
                    icon={Truck}
                    eyebrow={
                      config.primarySection === "release"
                        ? "Release Processing"
                        : "Gate-Out Review"
                    }
                    title={
                      config.primarySection === "release"
                        ? "Container Release"
                        : "Gate-Out Decision"
                    }
                    description={
                      config.primarySection === "release"
                        ? "Confirm the approved Gate-Out details and complete the physical container release."
                        : "Review the request and payment status, then approve or reject Gate-Out from this View modal."
                    }
                    approveLabel={
                      config.primarySection === "release"
                        ? "Complete Release"
                        : "Approve Gate-Out"
                    }
                    approveIcon={Truck}
                    onApprove={
                      config.primarySection === "release"
                        ? completeGateOut
                        : approveGateOut
                    }
                    approveDisabled={saving || !gateOutReady}
                    rejectLabel={
                      config.primarySection === "gateOut"
                        ? "Reject Gate-Out"
                        : undefined
                    }
                    rejectReason={gateOutRejectReason}
                    onRejectReasonChange={setGateOutRejectReason}
                    rejectPlaceholder="Explain why the Gate-Out request is being rejected"
                    rejectFieldDisabled={
                      config.primarySection !== "gateOut" ||
                      selectedBooking.status !== "gate_out_requested"
                    }
                    onReject={
                      config.primarySection === "gateOut"
                        ? rejectGateOut
                        : undefined
                    }
                    rejectDisabled={
                      saving ||
                      !gateOutRejectReason.trim() ||
                      selectedBooking.status !== "gate_out_requested"
                    }
                    note={
                      config.primarySection === "gateOut" &&
                      selectedBooking.billingStatus !== "paid_approved"
                        ? "Gate-Out approval stays disabled until payment is paid and approved. Rejection remains available for a pending request."
                        : undefined
                    }
                  >
                    <ChecklistPanel
                      title={
                        config.primarySection === "release"
                          ? "Before you can release"
                          : "Before you can approve"
                      }
                      items={gateOutChecks}
                    />
                    <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                      <div>
                        <span className="font-semibold text-slate-500">
                          Requested:
                        </span>{" "}
                        {formatDate(selectedBooking.gateOutRequestedAt)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Scheduled Gate-Out:
                        </span>{" "}
                        {formatDate(selectedBooking.outDate)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Approved:
                        </span>{" "}
                        {formatDate(selectedBooking.gateOutApprovedAt)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Released:
                        </span>{" "}
                        {formatDate(selectedBooking.releasedAt)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Billing gate:
                        </span>{" "}
                        {config.primarySection === "release"
                          ? "Cleared at Gate-Out approval"
                          : selectedBooking.billingStatus === "paid_approved"
                            ? "Ready"
                            : "Payment not approved"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Gate-In LOLO payment:
                        </span>{" "}
                        {Number(selectedBooking.gateInPaymentTotal || 0) > 0
                          ? `${money(selectedBooking.gateInPaymentTotal)} (separate transaction)`
                          : "None"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Gate-Out balance due:
                        </span>{" "}
                        {config.primarySection === "release"
                          ? "PHP 0.00 (payment locked)"
                          : money(
                              selectedBooking.paymentBalanceDue ??
                                selectedBooking.paymentAmount ??
                                selectedBooking.billingTotal ??
                                0,
                            )}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          Release window:
                        </span>{" "}
                        {selectedBooking.isOverstaying
                          ? "Overstaying"
                          : "Awaiting release"}
                      </div>
                    </div>

                    {config.primarySection === "gateOut" &&
                      user?.role === "super_admin" &&
                      [
                        "gate_out_requested",
                        "gate_out_approved",
                        "gate_out_reversal_requested",
                      ].includes(selectedBooking.status) && (
                        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold text-violet-700">
                                Super admin • date correction
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-600">
                                Correct Gate-In and Gate-Out date/time when
                                operations were recorded late. Billing is
                                recalculated after saving.
                              </p>
                            </div>
                            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                              Whole-hour intervals
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <Field label="Corrected Gate-In">
                              <input
                                type="datetime-local"
                                step="3600"
                                className="input bg-white"
                                value={gateOutDates.inDate}
                                onChange={(event) =>
                                  setGateOutDates((current) => ({
                                    ...current,
                                    inDate: event.target.value,
                                  }))
                                }
                                disabled={saving}
                              />
                            </Field>
                            <Field label="Corrected Gate-Out">
                              <input
                                type="datetime-local"
                                step="3600"
                                className="input bg-white"
                                value={gateOutDates.outDate}
                                onChange={(event) =>
                                  setGateOutDates((current) => ({
                                    ...current,
                                    outDate: event.target.value,
                                  }))
                                }
                                disabled={saving}
                              />
                            </Field>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={saveGateOutDates}
                              className="btn-primary"
                              disabled={
                                saving ||
                                !gateOutDates.inDate ||
                                !gateOutDates.outDate
                              }
                            >
                              <Clock3 size={16} /> Save corrected dates
                            </button>
                          </div>
                        </div>
                      )}

                    {config.primarySection === "release" && (
                      <div
                        className={`rounded-3xl border p-4 text-sm ${selectedBooking.isOverstaying ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
                      >
                        <p className="font-bold">Gate-Out payment locked</p>
                        <p className="mt-1 font-medium leading-6">
                          The Gate-Out payment was already paid and approved
                          before this container reached Release Container.
                          Completing the physical release will use that approved
                          payment and will not recalculate or request an
                          additional payment.
                        </p>
                        {selectedBooking.isOverstaying && (
                          <p className="mt-2 text-xs font-semibold">
                            The container is past its scheduled release window,
                            but this release step does not generate supplemental
                            Gate-Out charges.
                          </p>
                        )}
                      </div>
                    )}

                    {selectedBooking.gateOutRejectionReason && (
                      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
                        <span className="font-bold">
                          Previous Gate-Out rejection:
                        </span>{" "}
                        {selectedBooking.gateOutRejectionReason}
                      </div>
                    )}

                    {config.primarySection === "release" && (
                      <Field
                        label="Container condition upon release"
                        hint="Select all observed release conditions. The Gate-Out pass will use these values."
                      >
                        <ConditionChecklist
                          value={releaseConditions.gateOutConditions}
                          otherValue={releaseConditions.gateOutConditionOther}
                          onToggle={(option) =>
                            setReleaseConditions((current) => ({
                              ...current,
                              gateOutConditions: toggleConditionSelection(
                                current.gateOutConditions,
                                option,
                              ),
                            }))
                          }
                          onOtherChange={(value) =>
                            setReleaseConditions((current) => ({
                              ...current,
                              gateOutConditionOther: value,
                            }))
                          }
                        />
                      </Field>
                    )}

                    <Field
                      label={
                        config.primarySection === "release"
                          ? "Release remarks"
                          : "Gate-Out remarks"
                      }
                      hint="Optional remarks are included in the workflow history."
                    >
                      <textarea
                        className="input min-h-[82px]"
                        placeholder={
                          config.primarySection === "release"
                            ? "Add release remarks"
                            : "Add Gate-Out approval remarks"
                        }
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                      />
                    </Field>
                  </WorkflowDecisionPanel>
                )}
            </>
          </div>
        </Modal>
      )}

      {showPaymentAdjustmentModal && selectedBooking && (
        <Modal
          eyebrow="Super admin • editable payment"
          title={`Edit ${paymentAdjustment.paymentStage === "gate_in" ? "Gate-In" : "Gate-Out"} payment`}
          subtitle={`${selectedBooking.bookingReference} • ${selectedBooking.containerNumber}`}
          onClose={closePaymentAdjustment}
          size="max-w-lg"
          zIndex="z-[95]"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closePaymentAdjustment}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePaymentAdjustment}
                className="btn-primary"
                disabled={
                  saving ||
                  paymentAdjustment.amount === "" ||
                  Number(paymentAdjustment.amount) < 0
                }
              >
                <Pencil size={16} />{" "}
                {saving ? "Saving..." : "Save payment amount"}
              </button>
            </div>
          }
        >
          <div className="space-y-5 p-5">
            {modalAlert}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400">
                  Current payment
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {money(paymentAdjustment.previousAmount)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400">
                  Reference
                </p>
                <p className="mt-1 break-all text-sm font-bold text-slate-900">
                  {paymentAdjustment.referenceNumber || "No reference"}
                </p>
              </div>
            </div>

            <Field
              label="New payment amount"
              hint="This changes the approved payment amount only. Billing charges and rates are not changed."
            >
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={paymentAdjustment.amount}
                onChange={(event) =>
                  setPaymentAdjustment((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                placeholder="0.00"
                autoFocus
              />
            </Field>
            <Field
              label="Adjustment note"
              hint="Optional. This will be recorded in the booking history and admin audit log."
            >
              <textarea
                className="input min-h-[90px]"
                value={paymentAdjustment.reason}
                onChange={(event) =>
                  setPaymentAdjustment((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder="Why is the payment amount being corrected?"
                maxLength={500}
              />
            </Field>

            <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p>
                If the new payment is lower than the{" "}
                {paymentAdjustment.paymentStage === "gate_in"
                  ? "Gate-In"
                  : "Gate-Out"}{" "}
                bill, the remaining balance will become payable again. If the
                container has already been released, Revenue and the Release
                Report are updated to the corrected paid amount.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {showCashModal && cashBooking && (
        <Modal
          eyebrow={
            cashPaymentStage === "gate_in"
              ? "Gate-In LOLO cash payment"
              : "Gate-Out cash payment"
          }
          title={cashBooking.bookingReference}
          subtitle={`${cashBooking.clientName} • ${cashBooking.containerNumber}`}
          badges={
            <ContainerClassificationBadges
              loadStatus={cashBooking.containerLoadStatus}
              rateType={cashBooking.rateType}
            />
          }
          onClose={closeCashModal}
          size="max-w-2xl"
          zIndex="z-[90]"
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Total balance to pay
                </p>
                <p className="text-xl font-bold tabular-nums text-slate-950">
                  {money(cashTotal)}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCashModal}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={recordCashPayment}
                  className="btn-primary"
                  disabled={saving || cashReceivedValue < cashTotal}
                  title={
                    cashReceivedValue < cashTotal
                      ? `Enter at least ${money(cashTotal)} cash received`
                      : undefined
                  }
                >
                  <Banknote size={16} />{" "}
                  {saving ? "Processing..." : "Record cash payment"}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 p-5">
            {modalAlert}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">
                Transaction breakdown
              </p>
              <div className="mt-3 space-y-2">
                {(cashBooking.billingLineItems || []).map((item, index) => (
                  <div
                    key={`${item.chargeCode}-${index}`}
                    className="flex justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-700">
                      {item.description || item.chargeCode}{" "}
                      <span className="text-xs text-slate-400">
                        ({item.quantity} × {money(item.rateAmount)})
                      </span>
                    </span>
                    <strong className="tabular-nums">
                      {money(item.amount)}
                    </strong>
                  </div>
                ))}
                {cashAdditionalItems.map((item, index) => {
                  const amount =
                    Math.round(
                      Math.max(Number(item.quantity) || 0, 0) *
                        Math.max(Number(item.rateAmount) || 0, 0) *
                        100,
                    ) / 100;
                  return (
                    <div
                      key={`pending-cash-item-${index}`}
                      className="flex justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-amber-900">
                        {item.description.trim() ||
                          `Additional item ${index + 1}`}{" "}
                        <span className="text-xs text-amber-600">
                          ({Number(item.quantity) || 0} ×{" "}
                          {money(item.rateAmount)}) • New
                        </span>
                      </span>
                      <strong className="tabular-nums text-amber-950">
                        {money(amount)}
                      </strong>
                    </div>
                  );
                })}
                {(cashBooking.billingLineItems || []).length === 0 &&
                  cashAdditionalItems.length === 0 && (
                    <p className="rounded-xl bg-white px-3 py-4 text-center text-sm font-medium text-slate-500">
                      No billing items available.
                    </p>
                  )}
              </div>
            </div>

            {cashPaymentStage === "gate_out" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-amber-700">
                      Additional items
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      Add walk-in charges before completing this cash payment.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCashAdditionalItem}
                    className="btn-secondary"
                    disabled={saving || cashAdditionalItems.length >= 20}
                  >
                    <Plus size={16} /> Add item
                  </button>
                </div>

                {cashAdditionalItems.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {cashAdditionalItems.map((item, index) => {
                      const amount =
                        Math.round(
                          Math.max(Number(item.quantity) || 0, 0) *
                            Math.max(Number(item.rateAmount) || 0, 0) *
                            100,
                        ) / 100;
                      return (
                        <div
                          key={`cash-additional-form-${index}`}
                          className="rounded-2xl border border-amber-200 bg-white p-3 shadow-sm"
                        >
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_130px_44px]">
                            <Field label="Item description">
                              <input
                                className="input"
                                value={item.description}
                                onChange={(event) =>
                                  updateCashAdditionalItem(
                                    index,
                                    "description",
                                    event.target.value,
                                  )
                                }
                                placeholder="e.g. Documentation fee"
                                disabled={saving}
                              />
                            </Field>
                            <Field label="Quantity">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="input"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateCashAdditionalItem(
                                    index,
                                    "quantity",
                                    event.target.value,
                                  )
                                }
                                disabled={saving}
                              />
                            </Field>
                            <Field label="Rate">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="input"
                                value={item.rateAmount}
                                onChange={(event) =>
                                  updateCashAdditionalItem(
                                    index,
                                    "rateAmount",
                                    event.target.value,
                                  )
                                }
                                placeholder="0.00"
                                disabled={saving}
                              />
                            </Field>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => removeCashAdditionalItem(index)}
                                className="grid h-[46px] w-11 place-items-center rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100"
                                aria-label={`Remove additional item ${index + 1}`}
                                disabled={saving}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                            <Field label="Notes (optional)">
                              <input
                                className="input"
                                value={item.notes}
                                onChange={(event) =>
                                  updateCashAdditionalItem(
                                    index,
                                    "notes",
                                    event.target.value,
                                  )
                                }
                                placeholder="Internal note for this charge"
                                disabled={saving}
                              />
                            </Field>
                            <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
                              <p className="text-[11px] font-semibold text-slate-400">
                                Item amount
                              </p>
                              <p className="mt-1 text-lg font-bold tabular-nums">
                                {money(amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-medium text-sky-800">
                Gate-In cash payment contains Lift On / Lift Off charges only.
                Storage and other charges are added during Gate-Out.
              </div>
            )}

            {cashPaymentStage === "gate_out" && cashGateInPayment > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-700">
                  Gate-In payment details
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-900">
                  LOLO payment was collected during Gate-In and remains a
                  separate Gate-In transaction.
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-emerald-200 pt-3 text-sm">
                  <span className="font-semibold text-emerald-800">
                    Gate-In LOLO payment
                  </span>
                  <strong className="tabular-nums text-emerald-900">
                    {money(cashGateInPayment)}
                  </strong>
                </div>
              </div>
            )}

            <fieldset>
              <legend className="sr-only">Receipt type</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className={`cursor-pointer rounded-2xl border p-4 ${cashPayment.isVatApplicable ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}
                >
                  <input
                    type="radio"
                    name="cashVat"
                    className="mr-2"
                    checked={cashPayment.isVatApplicable}
                    onChange={() =>
                      setCashPayment((current) => ({
                        ...current,
                        isVatApplicable: true,
                      }))
                    }
                  />
                  <strong>VAT</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    Generate Official Receipt
                  </p>
                </label>
                <label
                  className={`cursor-pointer rounded-2xl border p-4 ${!cashPayment.isVatApplicable ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
                >
                  <input
                    type="radio"
                    name="cashVat"
                    className="mr-2"
                    checked={!cashPayment.isVatApplicable}
                    onChange={() =>
                      setCashPayment((current) => ({
                        ...current,
                        isVatApplicable: false,
                      }))
                    }
                  />
                  <strong>Non-VAT</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    Generate Acknowledgement Receipt
                  </p>
                </label>
              </div>
            </fieldset>

            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <div className="flex justify-between text-sm">
                <span>Existing billing subtotal</span>
                <strong className="tabular-nums">
                  {money(cashBaseSubtotal)}
                </strong>
              </div>
              {cashAdditionalSubtotal > 0 && (
                <div className="mt-2 flex justify-between text-sm text-amber-300">
                  <span>New additional items</span>
                  <strong className="tabular-nums">
                    {money(cashAdditionalSubtotal)}
                  </strong>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-sm">
                <span>Subtotal</span>
                <strong className="tabular-nums">{money(cashSubtotal)}</strong>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span>
                  VAT{" "}
                  {cashPayment.isVatApplicable
                    ? `(${Math.round(cashVatRate * 100)}%)`
                    : "(Non-VAT)"}
                </span>
                <strong className="tabular-nums">{money(cashVatAmount)}</strong>
              </div>
              <div className="mt-3 flex justify-between border-t border-white/20 pt-3 text-sm">
                <span>Gross total</span>
                <strong className="tabular-nums">
                  {money(cashGrossTotal)}
                </strong>
              </div>
              {cashPaymentStage === "gate_in" && cashApprovedCredit > 0 && (
                <div className="mt-2 flex justify-between text-sm text-emerald-200">
                  <span>Approved Gate-In payment</span>
                  <strong className="tabular-nums">
                    {money(cashApprovedCredit)}
                  </strong>
                </div>
              )}
              {cashPaymentStage === "gate_out" && cashGateOutPayment > 0 && (
                <div className="mt-2 flex justify-between text-sm text-amber-200">
                  <span>Approved Gate-Out payment</span>
                  <strong className="tabular-nums">
                    - {money(cashGateOutPayment)}
                  </strong>
                </div>
              )}
              {cashPaymentStage === "gate_out" && cashGateInPayment > 0 && (
                <>
                  <div className="mt-2 flex justify-between text-sm text-emerald-200">
                    <span>Gate-In LOLO payment (already paid)</span>
                    <strong className="tabular-nums">
                      {money(cashGateInPayment)}
                    </strong>
                  </div>
                  <div className="mt-2 text-xs text-emerald-200">
                    This Gate-In payment is shown for payment history only. It
                    is not deducted from the Gate-Out transaction.
                  </div>
                </>
              )}
              <div className="mt-3 flex justify-between border-t border-white/20 pt-3 text-xl">
                <span>Total balance to pay</span>
                <strong className="tabular-nums">{money(cashTotal)}</strong>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="Cash received">
                  <input
                    type="number"
                    min={cashTotal}
                    step="0.01"
                    className="input"
                    value={cashPayment.cashReceived}
                    onChange={(event) =>
                      setCashPayment((current) => ({
                        ...current,
                        cashReceived: event.target.value,
                      }))
                    }
                    placeholder={`Minimum ${cashTotal}`}
                  />
                </Field>
                {quickCashAmounts.length > 0 && (
                  <div
                    className="mt-2 flex flex-wrap gap-2"
                    role="group"
                    aria-label="Quick cash amounts"
                  >
                    {quickCashAmounts.map((amount, index) => (
                      <button
                        key={amount}
                        type="button"
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-emerald-100 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        onClick={() =>
                          setCashPayment((current) => ({
                            ...current,
                            cashReceived: String(amount),
                          }))
                        }
                      >
                        {index === 0
                          ? "Exact amount"
                          : `PHP ${amount.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-700">Change</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                  {money(cashChange)}
                </p>
              </div>
              <Field label="Payment reference (optional)">
                <input
                  className="input"
                  value={cashPayment.paymentReferenceNumber}
                  onChange={(event) =>
                    setCashPayment((current) => ({
                      ...current,
                      paymentReferenceNumber: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Remarks">
                <input
                  className="input"
                  value={cashPayment.paymentRemarks}
                  onChange={(event) =>
                    setCashPayment((current) => ({
                      ...current,
                      paymentRemarks: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold text-sky-700">
              {cashPaymentStage === "gate_in"
                ? "Submitting records and approves the LOLO payment, generates the receipt, and unlocks Gate-In approval."
                : "Submitting records the cash payment, approves it, and generates the receipt. Gate-Out approval remains available only in the View modal."}
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          eyebrow="Delete booking"
          title="Delete this booking?"
          subtitle={`${deleteTarget.bookingReference} • ${deleteTarget.containerNumber || ""}`}
          onClose={() => {
            if (!deletingId) cancelDeleteBooking();
          }}
          size="max-w-md"
          zIndex="z-[100]"
          closeOnBackdrop
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDeleteBooking}
                className="btn-secondary"
                disabled={Boolean(deletingId)}
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={confirmDeleteBooking}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(deletingId)}
              >
                <Trash2 size={16} />
                {deletingId ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          }
        >
          <div className="flex gap-3 p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle size={20} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium leading-6 text-slate-600">
              This permanently removes the booking and its uploaded documents.
              This action cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};

const BookingModuleViewSummary = ({ booking, section }) => {
  const lineItems = booking.billingLineItems || [];

  return (
    <details open className="card group p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <span className="flex items-center gap-2">
          <Eye size={18} className="text-emerald-700" aria-hidden="true" />
          <span className="text-lg font-bold text-slate-950">
            Read-only details
          </span>
        </span>
        <span className="text-xs font-semibold text-slate-400 group-open:hidden">
          Show
        </span>
        <span className="hidden text-xs font-semibold text-slate-400 group-open:inline">
          Hide
        </span>
      </summary>
      <p className="mt-1 text-sm font-medium text-slate-500">
        {section === "billing"
          ? "Review the submitted billing details and use the payment decision panel below."
          : "Review these details and use the workflow decision panel below. All approval and rejection actions are available only in the View modal."}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail
          label="Booking status"
          value={statusLabels[booking.status] || booking.status}
        />
        <Detail
          label="Billing status"
          value={billingLabels[booking.billingStatus] || booking.billingStatus}
        />
        <Detail
          label="LOLO collection"
          value={
            booking.loloPaymentStage === "gate_out" ? "Gate-Out" : "Gate-In"
          }
        />
        <Detail
          label="Booking number"
          value={booking.bookingNumber || booking.bookingReference}
        />
        <Detail
          label="Load status"
          value={
            booking.containerLoadStatus === "laden"
              ? "Laden"
              : booking.containerLoadStatus === "empty"
                ? "Empty"
                : "Unknown"
          }
        />
        <Detail
          label="Rate classification"
          value={
            booking.rateType === "international" ? "International" : "Local"
          }
        />
        <Detail label="Yard area" value={booking.assignedAreaName} />
        <Detail
          label="Block / slot"
          value={[
            booking.assignedBlockName || booking.assignedBlockCode,
            booking.assignedSlotNumber,
          ]
            .filter(Boolean)
            .join(" • ")}
        />
        <Detail label="Date in" value={formatDate(getBookingInDate(booking))} />
        <Detail
          label="Date / time out"
          value={formatDate(getBookingOutDate(booking))}
        />
        <Detail
          label="Gate-In condition"
          value={formatConditionSummary(
            booking.gateInConditions,
            booking.gateInConditionOther,
          )}
        />
        <Detail
          label="Gate-Out condition"
          value={formatConditionSummary(
            booking.gateOutConditions,
            booking.gateOutConditionOther,
          )}
        />
        <Detail label="Seal number" value={booking.sealNumber} />
      </div>

      {section === "gateIn" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail
            label="Actual container number"
            value={booking.actualContainerNumber || booking.containerNumber}
          />
          <Detail label="Truck plate" value={booking.truckPlateNumber} />
          <Detail label="Driver" value={booking.driverName} />
          <Detail label="Driver license" value={booking.driverLicenseNumber} />
          <Detail label="Hauler" value={booking.hauler} />
          <Detail
            label="Seal intact"
            value={booking.sealIntact ? booking.sealIntact.toUpperCase() : "-"}
          />
          <Detail
            label="Gate-In approved"
            value={formatDate(booking.gateInApprovedAt)}
          />
          <Detail label="Processed by" value={booking.gateInApprovedByName} />
          <Detail
            label="Inspection remarks"
            value={booking.inspectionRemarks}
          />
        </div>
      )}

      {section === "billing" && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Subtotal" value={money(booking.billingSubtotal)} />
            <Detail label="VAT" value={money(booking.vatAmount)} />
            <Detail
              label="Total"
              value={money(booking.billingTotal || booking.paymentAmount || 0)}
            />
            <Detail
              label="Payment type"
              value={booking.paymentTypeSnapshot?.name}
            />
            <Detail
              label="Payment reference"
              value={booking.paymentReferenceNumber}
            />
            <Detail
              label="Payment submitted"
              value={formatDate(booking.paymentSubmittedAt)}
            />
          </div>
          {lineItems.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-400">
                Billing breakdown
              </div>
              <div className="mt-3 space-y-2">
                {lineItems.map((item, index) => (
                  <div
                    key={`${item.chargeCode || item.description}-${index}`}
                    className="flex items-start justify-between gap-4 rounded-xl bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-slate-700">
                      {item.description || item.chargeCode}
                    </span>
                    <span className="font-bold tabular-nums text-slate-950">
                      {money(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <PaymentHistoryBreakdown booking={booking} className="mt-4" />

          {(booking.paymentProofs || []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {(booking.paymentProofs || []).map((document, index) => (
                <a
                  key={`${document.url}-${index}`}
                  href={resolveFileUrl(document.secureUrl || document.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 underline"
                >
                  {document.label || `Payment Proof ${index + 1}`}
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {["gateOut", "release"].includes(section) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail
            label="Gate-Out requested"
            value={formatDate(booking.gateOutRequestedAt)}
          />
          <Detail
            label="Gate-Out approved"
            value={formatDate(booking.gateOutApprovedAt)}
          />
          <Detail
            label="Reversal requested"
            value={formatDate(booking.gateOutReversalRequestedAt)}
          />
          <Detail
            label="Reversal reason"
            value={booking.gateOutReversalRequestReason}
          />
          <Detail
            label="Reversal decision"
            value={booking.gateOutReversalDecision}
          />
          <Detail
            label="Gate-In LOLO payment (separate)"
            value={
              Number(booking.gateInPaymentTotal || 0) > 0
                ? money(booking.gateInPaymentTotal)
                : "None"
            }
          />
          <Detail
            label="Gate-Out billing"
            value={money(
              booking.gateOutBillingTotal ?? booking.billingTotal ?? 0,
            )}
          />
          <Detail
            label="Total billing (Gate-In + Gate-Out)"
            value={money(
              booking.totalBillingAmount ??
                (Number(booking.gateInPaymentTotal) || 0) +
                  (Number(
                    booking.gateOutBillingTotal ?? booking.billingTotal,
                  ) || 0),
            )}
          />
          <Detail
            label="Balance due"
            value={money(
              booking.paymentBalanceDue ?? booking.paymentAmount ?? 0,
            )}
          />
          <Detail label="Released" value={formatDate(booking.releasedAt)} />
          <Detail label="Receipt number" value={booking.receiptNumber} />
          <Detail
            label="Payment type"
            value={booking.paymentTypeSnapshot?.name}
          />
          <Detail
            label="Release remarks"
            value={booking.gateOutRemarks || booking.remarks}
          />
        </div>
      )}
    </details>
  );
};

const Detail = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="text-xs font-semibold text-slate-400">{label}</div>
    <div className="mt-1 break-words text-sm font-semibold text-slate-800">
      {value || "N/A"}
    </div>
  </div>
);

export default AdminBookingModule;
