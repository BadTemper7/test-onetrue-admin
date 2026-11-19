// Pure, presentation-only progress mapping; no API or workflow mutations.
const INBOUND = ["Booked", "Approval", "Yard slot", "Gate in"];
const OUTBOUND = ["Gate in", "Stored", "Gate out", "Released"];

const gateInCompletedStatuses = new Set([
  "gate_in_approved",
  "stored_in_assigned_area",
  "gate_out_requested",
  "gate_out_approved",
  "gate_out_reversal_requested",
  "completed_gate_out_done",
]);
const storedStatuses = new Set([
  "stored_in_assigned_area",
  "gate_out_requested",
  "gate_out_approved",
  "gate_out_reversal_requested",
  "completed_gate_out_done",
]);
const gateOutCompletedStatuses = new Set([
  "gate_out_approved",
  "completed_gate_out_done",
]);
const stoppedStatuses = new Set(["rejected", "cancelled"]);
export const isStoppedBookingStatus = (status) => stoppedStatuses.has(status);

const isOutboundStatus = (status) =>
  storedStatuses.has(status) || status === "gate_in_approved";

/** Display progress only. The server remains the source of workflow decisions. */
export const getBookingCardProgress = (booking = {}, context = "auto") => {
  const status = booking.status || "pending_admin_approval";
  const outbound = context === "outbound" || (context === "auto" && isOutboundStatus(status));
  const completed = outbound
    ? [
        gateInCompletedStatuses.has(status),
        storedStatuses.has(status),
        gateOutCompletedStatuses.has(status),
        status === "completed_gate_out_done",
      ]
    : [
        true,
        !["pending_admin_approval", "rejected", "cancelled"].includes(status),
        !["pending_admin_approval", "rejected", "cancelled"].includes(status),
        gateInCompletedStatuses.has(status),
      ];
  const activeIndex = completed.findIndex((done) => !done);
  return {
    steps: (outbound ? OUTBOUND : INBOUND).map((label, index) => ({
      label,
      state: completed[index]
        ? "done"
        : index === activeIndex
          ? stoppedStatuses.has(status) ? "stopped" : "active"
          : "upcoming",
    })),
    outbound,
  };
};

