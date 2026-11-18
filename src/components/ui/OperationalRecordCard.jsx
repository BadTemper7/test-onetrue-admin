import React from "react";

/** Presentation-only mobile equivalent of the operational booking table. */
const OperationalRecordCard = ({
  eyebrow,
  title,
  subtitle,
  status,
  actions,
  children,
  onOpen,
  ariaLabel,
}) => (
  <article className="otli-record-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold text-emerald-700">{eyebrow}</p>}
        {onOpen ? (
          <button type="button" className="block max-w-full break-all text-left text-sm font-bold text-slate-900 hover:text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-label={ariaLabel || `View ${String(title)}`} onClick={onOpen}>
            {title}
          </button>
        ) : (
          <h3 className="break-all text-sm font-bold text-slate-900">{title}</h3>
        )}
        {subtitle && <div className="mt-1 break-words text-xs font-medium leading-5 text-slate-600">{subtitle}</div>}
      </div>
      {actions && <div className="otli-record-actions -mr-1 -mt-1 shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{actions}</div>}
    </div>
    {status && <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">{status}</div>}
    {children && <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3">{children}</div>}
  </article>
);

export const RecordCardField = ({ label, children }) => (
  <div className="grid min-w-0 grid-cols-[5.75rem_minmax(0,1fr)] items-start gap-2 text-xs leading-5">
    <span className="font-medium text-slate-500">{label}</span>
    <div className="min-w-0 break-words font-medium text-slate-800">{children ?? "Not available"}</div>
  </div>
);

export default OperationalRecordCard;
