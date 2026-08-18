import { X } from "lucide-react"

const ModalCloseButton = ({ onClick, label = "Close modal", disabled = false, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    aria-label={label}
    title={label}
  >
    <X size={19} strokeWidth={2.25} aria-hidden="true" />
  </button>
)

export default ModalCloseButton
