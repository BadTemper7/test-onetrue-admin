import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiEye,
  FiFilter,
  FiPackage,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiTruck,
  FiX,
} from "react-icons/fi";
import Button from "../components/ui/Button";
import InputDate from "../components/ui/InputDate";
import InputFile from "../components/ui/InputFile";
import InputText from "../components/ui/InputText";
import InputTime from "../components/ui/InputTime";
import Pagination from "../components/ui/Pagination";
import { api, getApiError, resolveFileUrl } from "../lib/api";
import { useBookingStore } from "../stores/bookingStore";
import { usePagination } from "../hooks/usePagination";
import TableLoadingRow from "../components/ui/TableLoadingRow"

const statusConfig = {
  pending_admin_approval: [
    "Pending approval",
    "bg-amber-100 text-amber-700",
    FiClock,
  ],
  approved_area_assigned: [
    "Area assigned",
    "bg-blue-100 text-blue-700",
    FiCheckCircle,
  ],
  rejected: ["Rejected", "bg-red-100 text-red-700", FiX],
  gate_in_approved: [
    "Gate-in approved",
    "bg-emerald-100 text-emerald-700",
    FiTruck,
  ],
  stored_in_assigned_area: [
    "Stored in yard",
    "bg-blue-100 text-blue-700",
    FiPackage,
  ],
  gate_out_requested: [
    "Gate-out requested",
    "bg-emerald-100 text-emerald-700",
    FiClock,
  ],
  gate_out_approved: [
    "Gate-out approved",
    "bg-blue-100 text-blue-700",
    FiCheckCircle,
  ],
  gate_out_reversal_requested: [
    "Reversal requested",
    "bg-amber-100 text-amber-700",
    FiRotateCcw,
  ],
  completed_gate_out_done: [
    "Completed",
    "bg-slate-100 text-slate-700",
    FiCheckCircle,
  ],
  cancelled: ["Cancelled", "bg-slate-100 text-slate-500", FiX],
};

const toDateOnlyString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const billingLabels = {
  unpaid: "Unpaid",
  payment_submitted: "Payment submitted",
  payment_under_review: "Under review",
  payment_rejected: "Payment rejected",
  additional_payment_required: "Additional payment required",
  paid_approved: "Paid",
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getPaymentPreviewBooking = (booking, isVatApplicable) => {
  if (!booking) return booking;
  const subtotal = roundMoney(booking.billingSubtotal || 0);
  const vatRate = Number(booking.vatRate || 0.12);
  const vatAmount = isVatApplicable ? roundMoney(subtotal * vatRate) : 0;
  const billingTotal = roundMoney(subtotal + vatAmount);
  const isGateInPayment =
    (booking.billingStage === "gate_in" || booking.status === "approved_area_assigned") &&
    booking.loloPaymentStage === "gate_in";
  const approvedCredit = isGateInPayment
    ? Math.max(Number(booking.approvedPaymentAmount || 0), 0)
    : 0;
  const paymentBalanceDue = isGateInPayment
    ? roundMoney(Math.max(billingTotal - approvedCredit, 0))
    : billingTotal;

  return {
    ...booking,
    isVatApplicable,
    vatAmount,
    billingTotal,
    paymentBalanceDue,
    paymentAmount: paymentBalanceDue,
  };
};

const BillingBreakdown = ({ booking, className = "" }) => {
  const lineItems = booking?.billingLineItems || [];
  if (lineItems.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Billing breakdown
      </p>
      <div className="mt-3 space-y-2">
        {lineItems.map((item, index) => (
          <div
            key={`${item.chargeCode || item.description}-${index}`}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <div>
              <p className="font-semibold text-slate-700">
                {String(item.chargeCode || "").startsWith("LIFT_ON")
                  ? "Lift On Charge"
                  : String(item.chargeCode || "").startsWith("LIFT_OFF")
                    ? "Lift Off Charge"
                    : item.description || item.chargeCode}
              </p>
              <p className="text-xs text-slate-500">
                {Number(item.quantity || 0).toLocaleString()} x PHP{" "}
                {Number(item.rateAmount || 0).toLocaleString()}
              </p>
            </div>
            <p className="shrink-0 font-bold text-slate-900">
              PHP {Number(item.amount || 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-sm">
        <div className="flex items-center justify-between font-semibold text-slate-700">
          <span>Subtotal</span>
          <span>
            PHP {Number(booking.billingSubtotal || 0).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between font-semibold text-slate-700">
          <span>
            {booking.isVatApplicable === false
              ? "VAT (Non-VAT)"
              : `VAT (${Math.round(Number(booking.vatRate || 0.12) * 100)}%)`}
          </span>
          <span>PHP {Number(booking.vatAmount || 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between font-black text-slate-900">
          <span>{booking.isVatApplicable === false ? "Non-VAT Grand Total" : "Grand Total"}</span>
          <span>
            PHP {Number(booking.billingTotal || 0).toLocaleString()}
          </span>
        </div>
        {booking.billingStage === "gate_in" && Number(booking.approvedPaymentAmount || 0) > 0 && (
          <div className="flex items-center justify-between font-semibold text-emerald-700">
            <span>Gate-In LOLO payment</span>
            <span>PHP {Number(booking.approvedPaymentAmount || 0).toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 font-black text-slate-900">
          <span>Balance due</span>
          <span>PHP {Number(booking.paymentBalanceDue ?? booking.paymentAmount ?? booking.billingTotal ?? 0).toLocaleString()}</span>
        </div>
        {booking.billingStage === "gate_in" && Number(booking.paymentCreditAmount || 0) > 0 && (
          <div className="flex items-center justify-between font-semibold text-emerald-700">
            <span>Remaining Gate-In credit</span>
            <span>PHP {Number(booking.paymentCreditAmount || 0).toLocaleString()}</span>
          </div>
        )}
        {booking.billingStage === "gate_out" && Number(booking.approvedPaymentAmount || 0) > 0 && (
          <p className="text-xs leading-5 text-slate-500">Gate-In LOLO payment is recorded separately and is not deducted from the Gate-Out transaction.</p>
        )}
      </div>
    </div>
  );
};

const PaymentHistoryBreakdown = ({ booking, className = "" }) => {
  const transactions = Array.isArray(booking?.paymentTransactions) ? booking.paymentTransactions : [];
  const totalPaid = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gateInPaid = transactions
    .filter((item) => item.paymentStage === "gate_in")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gateOutPaid = transactions
    .filter((item) => item.paymentStage === "gate_out")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gateInBilling = Number(booking?.gateInBillingTotal || booking?.gateInPaymentTotal || gateInPaid || 0);
  const gateOutBilling = Number(booking?.gateOutBillingTotal ?? booking?.billingTotal ?? 0);
  const totalBilling = Number(booking?.totalBillingAmount ?? (gateInBilling + gateOutBilling));
  const gateOutBalance = Number(booking?.paymentBalanceDue ?? booking?.paymentAmount ?? 0);

  const summaryCards = [
    { label: "Gate-In Billing", value: gateInBilling, classes: "bg-amber-50 text-amber-700" },
    { label: "Gate-In Payment", value: gateInPaid, classes: "bg-amber-50 text-amber-700" },
    { label: "Gate-Out Billing", value: gateOutBilling, classes: "bg-blue-50 text-blue-700" },
    { label: "Gate-Out Payment", value: gateOutPaid, classes: "bg-blue-50 text-blue-700" },
    { label: "Total Billing", value: totalBilling, classes: "bg-slate-50 text-slate-600" },
    { label: "Current Balance", value: gateOutBalance, classes: "bg-emerald-50 text-emerald-700" },
  ];

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Billing Information</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Complete Payment History</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Gate-In billing/payment and Gate-Out billing/payment are shown as separate fields and transactions.
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-right">
          <p className="text-xs font-black uppercase text-slate-400">Total Paid</p>
          <p className="font-black text-slate-900">PHP {totalPaid.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-xl p-3 ${card.classes}`}>
            <p className="text-xs font-black uppercase">{card.label}</p>
            <p className="mt-1 font-black text-slate-900">PHP {Number(card.value || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {transactions.length === 0 ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">
          No approved payment transactions have been recorded yet.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {transactions.map((payment, index) => (
            <div key={payment.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${payment.paymentStage === "gate_in" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {payment.paymentStage === "gate_in" ? "Gate-In Payment" : "Gate-Out Payment"}
                  </span>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {formatDateTime(payment.paymentDate)}
                    {payment.referenceNumber ? ` • Ref ${payment.referenceNumber}` : ""}
                    {payment.receiptNumber ? ` • Receipt ${payment.receiptNumber}` : ""}
                  </p>
                </div>
                <p className="text-lg font-black text-slate-900">PHP {Number(payment.amount || 0).toLocaleString()}</p>
              </div>
              {Array.isArray(payment.lineItems) && payment.lineItems.length > 0 && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Payment Breakdown</p>
                  <div className="mt-2 space-y-1.5">
                    {payment.lineItems.map((item, itemIndex) => (
                      <div key={`${item.chargeCode || item.description}-${itemIndex}`} className="flex justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">
                          {String(item.chargeCode || "").startsWith("LIFT_ON")
                            ? "Lift On Charge"
                            : String(item.chargeCode || "").startsWith("LIFT_OFF")
                              ? "Lift Off Charge"
                              : item.description || item.chargeCode}
                        </span>
                        <span className="font-black text-slate-900">PHP {Number(item.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm">
                    <span className="font-black">Transaction Total</span>
                    <span className="font-black">PHP {Number(payment.grossTotal || payment.amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BookingHistory = () => {
  const {
    bookings,
    loading,
    submitting,
    error,
    fetchBookings,
    requestGateOut,
    requestGateOutReversal,
    submitPayment,
  } = useBookingStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [paymentTypesLoaded, setPaymentTypesLoaded] = useState(false);
  const [modal, setModal] = useState("");

  const availablePaymentTypes = paymentTypes;
  const [actionError, setActionError] = useState("");
  const [gateOut, setGateOut] = useState({ outDate: "", outTime: null });
  const [reversalReason, setReversalReason] = useState("");
  const [payment, setPayment] = useState({
    paymentTypeId: "",
    paymentReferenceNumber: "",
    paymentRemarks: "",
    paymentProof: null,
    isVatApplicable: true,
  });
  const paymentPreviewBooking = useMemo(
    () => getPaymentPreviewBooking(selectedBooking, payment.isVatApplicable),
    [selectedBooking, payment.isVatApplicable],
  );

  useEffect(() => {
    fetchBookings().catch(() => {});
    api
      .get("/client/payment-types")
      .then(({ data }) =>
        setPaymentTypes(
          (data.paymentTypes || []).filter((item) => item.type === "bank"),
        ),
      )
      .catch(() => setPaymentTypes([]))
      .finally(() => setPaymentTypesLoaded(true));
  }, [fetchBookings]);

  useEffect(() => {
    const refresh = () => fetchBookings().catch(() => {});
    window.addEventListener("otli:realtime", refresh);
    return () => window.removeEventListener("otli:realtime", refresh);
  }, [fetchBookings]);

  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesSearch =
        !term ||
        [
          booking.bookingReference,
          booking.containerNumber,
          booking.driverName,
          booking.shippingLine,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
        );
      const matchesStatus =
        filterStatus === "all" || booking.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, filterStatus, searchTerm]);

  const bookingPagination = usePagination(
    filteredBookings,
    10,
    `${searchTerm}|${filterStatus}`,
  );

  const openModal = (type, booking) => {
    setSelectedBooking(booking);
    setModal(type);
    setActionError("");
    setGateOut({ outDate: "", outTime: null });
    setReversalReason("");
    setPayment({
      paymentTypeId: availablePaymentTypes[0]?.id || "",
      paymentReferenceNumber: "",
      paymentRemarks: "",
      paymentProof: null,
      isVatApplicable: booking.isVatApplicable !== false,
    });
  };

  const closeModal = () => {
    if (submitting) return;
    setModal("");
    setSelectedBooking(null);
    setActionError("");
  };

  const submitGateOutRequest = async () => {
    if (!gateOut.outDate) {
      setActionError("Please select a Date Out.");
      return;
    }
    if (!gateOut.outTime) {
      setActionError("Please select a Time Out.");
      return;
    }

    const selectedTime = gateOut.outTime instanceof Date
      ? gateOut.outTime
      : new Date(gateOut.outTime);
    const combinedOutDate = new Date(`${gateOut.outDate}T00:00:00`);

    if (Number.isNaN(selectedTime.getTime()) || Number.isNaN(combinedOutDate.getTime())) {
      setActionError("Please select a valid Date Out and Time Out.");
      return;
    }

    combinedOutDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

    try {
      await requestGateOut(selectedBooking.id, {
        outDate: combinedOutDate.toISOString(),
      });
      closeModal();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    }
  };

  const submitGateOutReversalRequest = async () => {
    if (!reversalReason.trim()) {
      setActionError("Please provide the reason for reversing the approved Gate-Out.");
      return;
    }
    try {
      await requestGateOutReversal(selectedBooking.id, {
        reason: reversalReason.trim(),
      });
      closeModal();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    }
  };

  const submitPaymentProof = async () => {
    if (!payment.paymentTypeId) {
      setActionError("Please select a payment type.");
      return;
    }
    if (!payment.paymentProof) {
      setActionError("Proof of payment is required for all online payments.");
      return;
    }
    try {
      await submitPayment(selectedBooking.id, payment);
      closeModal();
    } catch (requestError) {
      setActionError(getApiError(requestError));
    }
  };

  const StatusBadge = ({ booking }) => {
    const [label, className, Icon] = statusConfig[booking.status] || [
      booking.status,
      "bg-slate-100 text-slate-700",
      FiClock,
    ];
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
        >
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        {booking.isOverstaying && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
            <FiClock className="h-3.5 w-3.5" /> Overstaying
          </span>
        )}
      </span>
    );
  };

  const renderAction = (booking) => {
    if (
      booking.status === "approved_area_assigned" &&
      booking.loloPaymentStage === "gate_in" &&
      ["unpaid", "payment_rejected", "additional_payment_required"].includes(
        booking.billingStatus,
      ) &&
      Number(booking.paymentBalanceDue ?? booking.paymentAmount ?? 0) > 0 &&
      paymentTypesLoaded &&
      availablePaymentTypes.length > 0
    ) {
      return (
        <button
          onClick={() => openModal("payment", booking)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          Pay Gate-In LOLO
        </button>
      );
    }

    if (
      booking.status === "stored_in_assigned_area" &&
      ["unpaid", "payment_rejected", "paid_approved"].includes(booking.billingStatus)
    ) {
      return (
        <button
          onClick={() => openModal("gateOut", booking)}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Submit Date & Time Out
        </button>
      );
    }

    if (
      ["gate_out_requested", "gate_out_approved"].includes(booking.status) &&
      ["unpaid", "payment_rejected", "additional_payment_required"].includes(booking.billingStatus) &&
      Number(booking.paymentBalanceDue ?? booking.paymentAmount ?? 0) > 0 &&
      paymentTypesLoaded &&
      availablePaymentTypes.length > 0
    ) {
      return (
        <button
          onClick={() => openModal("payment", booking)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          Submit Non-Cash Payment
        </button>
      );
    }

    if (
      booking.status === "gate_out_approved" &&
      !booking.releasedAt
    ) {
      return (
        <button
          onClick={() => openModal("reversal", booking)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
        >
          <FiRotateCcw /> Request Reversal
        </button>
      );
    }

    return null;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Booking history</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track booking approval, yard storage, payment, and release status.
          </p>
        </div>
        <button
          onClick={() => fetchBookings().catch(() => {})}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {(error || actionError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError || error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search booking, container, driver, or shipping line"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="text-slate-400" />
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All statuses</option>
              {Object.entries(statusConfig).map(([value, config]) => (
                <option key={value} value={value}>
                  {config[0]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Container</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Date in</th>
                <th className="px-4 py-3">Date / Time out</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredBookings.length === 0 && <TableLoadingRow colSpan={8} rows={6} actionColumn label="Loading booking history" />}
              {bookingPagination.paginatedItems.map((booking) => (
                <tr key={booking.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-emerald-600">
                      {booking.bookingReference}
                    </p>
                    <p className="text-xs text-slate-400">
                      {booking.shippingLine}
                    </p>
                    {booking.recordSource === "legacy_migration" && <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">Legacy Record</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">
                      {booking.containerNumber}
                    </p>
                    <p className="text-xs capitalize text-slate-500">
                      {booking.containerSize} ft •{" "}
                      {String(booking.containerType || "").replaceAll("_", " ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">
                      {booking.driverName || "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {booking.truckPlateNumber || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(booking.inDate || booking.expectedArrivalDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(booking.outDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge booking={booking} />
                  </td>
                  <td className="px-4 py-3">
                    {booking.status === "approved_area_assigned" && booking.loloPaymentStage === "gate_out" ? (
                      <>
                        <p className="font-semibold text-blue-700">Deferred to Gate-Out</p>
                        <p className="text-xs text-slate-500">No Gate-In payment required</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-700">
                          PHP {Number(booking.billingTotal || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {billingLabels[booking.billingStatus] || booking.billingStatus}
                          {Number(booking.approvedPaymentAmount || 0) > 0
                            ? ` • Balance PHP ${Number(booking.paymentBalanceDue ?? booking.paymentAmount ?? 0).toLocaleString()}`
                            : ""}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal("details", booking)}
                        className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                        aria-label="View booking"
                      >
                        <FiEye />
                      </button>
                      {renderAction(booking)}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredBookings.length === 0 && (
                <tr>
                  <td
                    colSpan="8"
                    className="px-4 py-14 text-center text-slate-500"
                  >
                    No bookings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...bookingPagination} />
      </div>

      {modal && selectedBooking && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {modal === "gateOut"
                    ? "Submit Date & Time Out"
                    : modal === "payment"
                      ? (selectedBooking.billingStage === "gate_in" ||
                        selectedBooking.status === "approved_area_assigned") && selectedBooking.loloPaymentStage === "gate_in"
                        ? "Pay Gate-In LOLO"
                        : "Submit Gate-Out Payment"
                      : modal === "reversal"
                        ? "Request Gate-Out Reversal"
                        : "Booking details"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedBooking.bookingReference} •{" "}
                  {selectedBooking.containerNumber}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>

            {actionError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            {modal === "details" && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  [
                    "Status",
                    (statusConfig[selectedBooking.status] || [
                      selectedBooking.status,
                    ])[0],
                  ],
                  [
                    "Billing",
                    selectedBooking.status === "approved_area_assigned" && selectedBooking.loloPaymentStage === "gate_out"
                      ? "Deferred to Gate-Out"
                      : billingLabels[selectedBooking.billingStatus] || selectedBooking.billingStatus,
                  ],
                  [
                    "LOLO collection",
                    selectedBooking.loloPaymentStage === "gate_out" ? "Gate-Out" : "Gate-In",
                  ],
                  [
                    "Billing stage",
                    selectedBooking.billingStage === "gate_in"
                      ? selectedBooking.loloPaymentStage === "gate_out" ? "Gate-In (no payment due)" : "Gate-In LOLO"
                      : selectedBooking.billingStage === "gate_out"
                        ? "Gate-Out"
                        : "—",
                  ],
                  ["Record source", selectedBooking.recordSource === "legacy_migration" ? "Legacy migration" : "Client booking"],
                  ["Legacy registration", selectedBooking.legacyRegistrationNumber],
                  ["Historical date quality", selectedBooking.historicalGateInDateType],
                  ["Shipping line", selectedBooking.shippingLine],
                  ["Driver", selectedBooking.driverName],
                  ["Truck plate", selectedBooking.truckPlateNumber],
                  [
                    "Assigned area",
                    selectedBooking.assignedArea?.name ||
                      selectedBooking.assignedAreaName,
                  ],
                  ["Assigned slot", selectedBooking.assignedSlotNumber],
                  ["Requested Date / Time Out", formatDateTime(selectedBooking.outDate)],
                  ["Gate-Out schedule", selectedBooking.isOverstaying ? "Overstaying" : selectedBooking.gateOutScheduleStatus],
                  ["Overstay started", formatDateTime(selectedBooking.gateOutOverstayStartedAt)],
                  ["Billing computed as of", formatDateTime(selectedBooking.billingComputedAt)],
                  ["Gate-In LOLO payment (separate)", Number(selectedBooking.approvedPaymentAmount || 0) > 0 ? `PHP ${Number(selectedBooking.approvedPaymentAmount).toLocaleString()}` : "—"],
                  ["Current balance due", `PHP ${Number(selectedBooking.paymentBalanceDue ?? selectedBooking.paymentAmount ?? 0).toLocaleString()}`],
                  ["Reversal reason", selectedBooking.gateOutReversalRequestReason],
                  ["Reversal decision", selectedBooking.gateOutReversalDecision],
                  ["Reversal remarks", selectedBooking.gateOutReversalAdminRemarks],
                  ["Rejection reason", selectedBooking.rejectionReason],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {value || "—"}
                    </p>
                  </div>
                ))}
                <BillingBreakdown
                  booking={selectedBooking}
                  className="sm:col-span-2"
                />
                <PaymentHistoryBreakdown booking={selectedBooking} className="sm:col-span-2" />
              </div>
            )}

            {modal === "gateOut" && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputDate
                    label="Date Out"
                    name="outDate"
                    value={gateOut.outDate}
                    onChange={(event) =>
                      setGateOut((current) => ({
                        ...current,
                        outDate: toDateOnlyString(event.target.value),
                      }))
                    }
                    required
                  />
                  <InputTime
                    label="Time Out"
                    name="outTime"
                    value={gateOut.outTime}
                    onChange={(event) =>
                      setGateOut((current) => ({
                        ...current,
                        outTime: event.target.value,
                      }))
                    }
                    placeholder="Select release time"
                    minuteStep={60}
                    hourlyOnly
                    required
                  />
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                  Pullout / Gate-Out requests should be submitted at least 2 days in advance. Gate-Out booking is limited to 3 containers per hour, so requested time slots are subject to availability.
                </div>
                <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                  The final Gate-Out bill will be computed using the selected Date Out and Time Out. Storage and other charges are payable only at Gate-Out{selectedBooking.loloPaymentStage === "gate_in" ? "; your Gate-In LOLO payment remains a separate transaction and is not deducted from Gate-Out" : ""}.
                </p>
              </div>
            )}

            {modal === "reversal" && (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-bold">Requesting this will temporarily block container release.</p>
                  <p className="mt-1 text-xs leading-5">
                    Admin must approve the reversal. Once approved, the container returns to storage, storage billing resumes, and the approved payment remains as credit for this booking.
                  </p>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Reversal reason <span className="text-red-500">*</span>
                  </span>
                  <textarea
                    className="input min-h-[120px]"
                    value={reversalReason}
                    onChange={(event) => setReversalReason(event.target.value)}
                    placeholder="Example: I selected the wrong container for the Gate-Out request."
                    maxLength={500}
                  />
                  <span className="mt-1 block text-xs text-slate-400">{reversalReason.length}/500</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400">Container</p>
                    <p className="mt-1 font-bold text-slate-800">{selectedBooking.containerNumber}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400">Approved payment</p>
                    <p className="mt-1 font-bold text-emerald-700">PHP {Number(selectedBooking.approvedPaymentAmount || selectedBooking.billingTotal || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {modal === "payment" && (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  {(selectedBooking.billingStage === "gate_in" ||
                  selectedBooking.status === "approved_area_assigned") && selectedBooking.loloPaymentStage === "gate_in" ? (
                    <>
                      <p className="font-bold">Gate-In payment</p>
                      <p className="mt-1 text-xs leading-5">
                        This payment covers only Lift On / Lift Off. Storage and
                        other charges will be billed at Gate-Out.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold">Gate-Out payment</p>
                      <p className="mt-1 text-xs leading-5">
                        {selectedBooking.loloPaymentStage === "gate_out"
                          ? "This is the Gate-Out payment for the applicable remaining charges."
                          : "This is the Gate-Out charges are billed separately from the Gate-In LOLO transaction."}
                      </p>
                    </>
                  )}
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-700">Amount to pay</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    PHP{" "}
                    {Number(paymentPreviewBooking?.paymentBalanceDue ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-800">
                    Billing preference
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label
                      className={`cursor-pointer rounded-lg border p-3 ${payment.isVatApplicable ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}
                    >
                      <input
                        type="radio"
                        className="mr-2"
                        checked={payment.isVatApplicable}
                        onChange={() =>
                          setPayment((current) => ({
                            ...current,
                            isVatApplicable: true,
                          }))
                        }
                      />
                      VAT transaction
                    </label>
                    <label
                      className={`cursor-pointer rounded-lg border p-3 ${!payment.isVatApplicable ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
                    >
                      <input
                        type="radio"
                        className="mr-2"
                        checked={!payment.isVatApplicable}
                        onChange={() =>
                          setPayment((current) => ({
                            ...current,
                            isVatApplicable: false,
                          }))
                        }
                      />
                      Non-VAT transaction
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    VAT transactions receive an Official Receipt. Non-VAT
                    transactions receive an Acknowledgement Receipt.
                  </p>
                </div>
                <BillingBreakdown booking={paymentPreviewBooking} />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Bank Account <span className="text-red-500">*</span>
                  </span>
                  <div className="relative" data-field-control>
                    <FiCreditCard className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      className="input input-with-leading-icon"
                      value={payment.paymentTypeId}
                      onChange={(event) =>
                        setPayment((current) => ({
                          ...current,
                          paymentTypeId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select bank account</option>
                      {availablePaymentTypes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.accountNumber
                            ? `${item.bankName || item.name}`
                            : item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                {payment.paymentTypeId &&
                  (() => {
                    const selected = availablePaymentTypes.find(
                      (item) => item.id === payment.paymentTypeId,
                    );
                    return selected ? (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
                        <p className="font-black text-emerald-900">
                          {selected.name}
                        </p>
                        {selected.accountNumber ? (
                          <>
                            <p className="mt-2 text-emerald-800">
                              {selected.bankName || selected.name}
                            </p>
                            <p className="font-black text-emerald-900">
                              {selected.accountNumber}
                            </p>
                            <p className="text-emerald-800">
                              {selected.accountName}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 font-semibold text-emerald-800">
                            {selected.instructions}
                          </p>
                        )}
                        {selected.qrUrl && (
                          <a
                            href={resolveFileUrl(selected.qrUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-black text-emerald-700"
                          >
                            View QR Code
                          </a>
                        )}
                      </div>
                    ) : null;
                  })()}
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-700">
                  Proof of payment is required for every online payment. The
                  transaction reference remains optional.
                </div>
                <InputText
                  label="Payment Reference Number"
                  name="paymentReferenceNumber"
                  value={payment.paymentReferenceNumber}
                  onChange={(event) =>
                    setPayment((current) => ({
                      ...current,
                      paymentReferenceNumber: event.target.value,
                    }))
                  }
                  placeholder="Enter bank transaction reference"
                />
                <InputFile
                  label="Proof of Payment"
                  name="paymentProof"
                  accept="image/*,.pdf"
                  maxSize={10}
                  required
                  onChange={(event) =>
                    setPayment((current) => ({
                      ...current,
                      paymentProof: event.target.files?.[0] || null,
                    }))
                  }
                />
                <InputText
                  label="Payment Remarks"
                  name="paymentRemarks"
                  value={payment.paymentRemarks}
                  onChange={(event) =>
                    setPayment((current) => ({
                      ...current,
                      paymentRemarks: event.target.value,
                    }))
                  }
                  placeholder="Optional notes"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={closeModal}
                disabled={submitting}
              >
                Close
              </Button>
              {modal === "gateOut" && (
                <Button
                  variant="primary"
                  onClick={submitGateOutRequest}
                  loading={submitting}
                  disabled={submitting}
                >
                  Submit Gate-out
                </Button>
              )}
              {modal === "reversal" && (
                <Button
                  variant="primary"
                  onClick={submitGateOutReversalRequest}
                  loading={submitting}
                  disabled={submitting || !reversalReason.trim()}
                  icon={<FiRotateCcw />}
                >
                  Submit Reversal Request
                </Button>
              )}
              {modal === "payment" && (
                <Button
                  variant="primary"
                  onClick={submitPaymentProof}
                  loading={submitting}
                  disabled={submitting}
                  icon={<FiDollarSign />}
                >
                  Submit Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingHistory;
