/**
 * Shared mobile footer for a pending booking. These buttons open the existing
 * review flow; neither action mutates the booking directly.
 *
 * Keep the full action labels visible even on narrow phones. The grid allocates
 * more space to the longer approval label without overflowing the card.
 */
const BookingCardDecisionActions = ({
  onReject,
  onApprove,
  rejectTitle = "Open booking review to enter a rejection reason",
  approveTitle = "Open booking review to assign a yard slot and confirm approval",
}) => (
  <div className="grid w-full min-w-0 grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] gap-2">
    <button
      type="button"
      onClick={onReject}
      title={rejectTitle}
      aria-label="Open booking review to reject"
      className="flex min-h-11 w-full min-w-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-2 py-2.5 text-center text-xs font-semibold leading-4 text-slate-800 shadow-sm transition hover:bg-slate-50 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
    >
      Reject
    </button>
    <button
      type="button"
      onClick={onApprove}
      title={approveTitle}
      aria-label="Open booking review to approve"
      className="flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl bg-emerald-700 px-2 py-2.5 text-center text-xs font-semibold leading-4 text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
    >
      Approve booking
    </button>
  </div>
);

export default BookingCardDecisionActions;
