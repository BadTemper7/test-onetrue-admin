import { CheckCircle2, ClipboardCheck, ShieldX } from "lucide-react"

const WorkflowDecisionPanel = ({
  icon: Icon = ClipboardCheck,
  eyebrow = "Workflow Review",
  title,
  description,
  children,
  note,
  approveLabel = "Approve",
  approveIcon: ApproveIcon = CheckCircle2,
  onApprove,
  approveDisabled = false,
  rejectLabel,
  rejectIcon: RejectIcon = ShieldX,
  rejectReason = "",
  onRejectReasonChange,
  rejectPlaceholder = "Enter the reason before rejecting",
  rejectFieldDisabled = false,
  onReject,
  rejectDisabled = false,
  secondaryActions = null,
  className = "",
}) => {
  const canReject = Boolean(rejectLabel && typeof onReject === "function")
  const canApprove = Boolean(approveLabel && typeof onApprove === "function")

  return (
    <section className={`overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-start gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{title}</h3>
          {description && <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {children}

        {canReject && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Rejection Reason</span>
            <textarea
              className="input min-h-[96px] resize-y"
              placeholder={rejectPlaceholder}
              value={rejectReason}
              onChange={(event) => onRejectReasonChange?.(event.target.value)}
              maxLength={500}
              disabled={rejectFieldDisabled}
            />
          </label>
        )}

        {note && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
            {note}
          </div>
        )}
      </div>

      {(canApprove || canReject || secondaryActions) && (
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {canReject && (
              <button
                type="button"
                onClick={onReject}
                className="btn-secondary !border-red-200 !text-red-700 hover:!border-red-300 hover:!bg-red-50"
                disabled={rejectDisabled}
              >
                <RejectIcon size={16} aria-hidden="true" /> {rejectLabel}
              </button>
            )}
            {secondaryActions}
          </div>

          {canApprove && (
            <button type="button" onClick={onApprove} className="btn-primary" disabled={approveDisabled}>
              <ApproveIcon size={16} aria-hidden="true" /> {approveLabel}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default WorkflowDecisionPanel
