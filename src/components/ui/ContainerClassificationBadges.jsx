import { CircleDot, Globe2 } from "lucide-react"

export const normalizeContainerLoadStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "laden") return "laden"
  if (normalized === "empty") return "empty"
  return "unknown"
}

export const normalizeContainerRateType = (value) =>
  String(value || "").trim().toLowerCase() === "international" ? "international" : "local"

const loadConfig = {
  empty: {
    label: "Empty",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  laden: {
    label: "Laden",
    className: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  unknown: {
    label: "Load Unknown",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
  },
}

const rateConfig = {
  local: {
    label: "Local",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  international: {
    label: "International",
    className: "bg-blue-50 text-blue-700 ring-blue-100",
  },
}

const ContainerClassificationBadges = ({
  loadStatus,
  rateType,
  className = "",
  compact = false,
}) => {
  const normalizedLoad = normalizeContainerLoadStatus(loadStatus)
  const normalizedRate = normalizeContainerRateType(rateType)
  const load = loadConfig[normalizedLoad]
  const rate = rateConfig[normalizedRate]
  const badgeClass = compact
    ? "gap-1 px-2 py-1 text-[10px]"
    : "gap-1.5 px-2.5 py-1 text-[11px]"

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      <span className={`inline-flex items-center rounded-full font-black uppercase tracking-wide ring-1 ${badgeClass} ${load.className}`}>
        <CircleDot size={compact ? 10 : 11} aria-hidden="true" />
        {load.label}
      </span>
      <span className={`inline-flex items-center rounded-full font-black uppercase tracking-wide ring-1 ${badgeClass} ${rate.className}`}>
        <Globe2 size={compact ? 10 : 11} aria-hidden="true" />
        {rate.label}
      </span>
    </div>
  )
}

export default ContainerClassificationBadges
