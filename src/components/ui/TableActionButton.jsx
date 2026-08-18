import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { LoaderCircle } from "lucide-react"

const variantClasses = {
  neutral:
    "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
  dark:
    "border-slate-900 bg-slate-950 text-white hover:border-slate-800 hover:bg-slate-800",
  info:
    "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100",
  success:
    "border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100",
  warning:
    "border-amber-100 bg-amber-50 text-amber-700 hover:border-amber-200 hover:bg-amber-100",
  danger:
    "border-red-100 bg-red-50 text-red-700 hover:border-red-200 hover:bg-red-100",
}

const sizeClasses = {
  sm: "h-9 w-9 rounded-lg",
  md: "h-10 w-10 rounded-xl",
}

const VIEWPORT_PADDING = 8
const TOOLTIP_GAP = 8

const TableActionButton = ({
  label,
  children,
  variant = "neutral",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  ...buttonProps
}) => {
  const buttonRef = useRef(null)
  const tooltipRef = useRef(null)
  const tooltipId = useId()
  const [tooltipAnchor, setTooltipAnchor] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState(null)

  const showTooltip = () => {
    const button = buttonRef.current
    if (!button || !label) return

    const rect = button.getBoundingClientRect()
    setTooltipAnchor({
      centerX: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
    })
    setTooltipPosition(null)
  }

  const hideTooltip = () => {
    setTooltipAnchor(null)
    setTooltipPosition(null)
  }

  useLayoutEffect(() => {
    const tooltipElement = tooltipRef.current
    if (!tooltipAnchor || !tooltipElement || typeof window === "undefined") return

    const tooltipRect = tooltipElement.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const halfWidth = tooltipRect.width / 2
    const minimumLeft = VIEWPORT_PADDING + halfWidth
    const maximumLeft = Math.max(minimumLeft, viewportWidth - VIEWPORT_PADDING - halfWidth)
    const left = Math.min(Math.max(tooltipAnchor.centerX, minimumLeft), maximumLeft)

    const requiredHeight = tooltipRect.height + TOOLTIP_GAP
    const availableAbove = tooltipAnchor.top - VIEWPORT_PADDING
    const availableBelow = viewportHeight - tooltipAnchor.bottom - VIEWPORT_PADDING
    const placeAbove = availableAbove >= requiredHeight || availableAbove >= availableBelow
    const top = placeAbove
      ? Math.max(VIEWPORT_PADDING, tooltipAnchor.top - TOOLTIP_GAP - tooltipRect.height)
      : Math.min(
          Math.max(VIEWPORT_PADDING, viewportHeight - VIEWPORT_PADDING - tooltipRect.height),
          tooltipAnchor.bottom + TOOLTIP_GAP,
        )

    setTooltipPosition({ left, top })
  }, [tooltipAnchor, label])

  useEffect(() => {
    if (!tooltipAnchor || typeof window === "undefined") return undefined

    const dismissTooltip = () => {
      setTooltipAnchor(null)
      setTooltipPosition(null)
    }
    window.addEventListener("resize", dismissTooltip)
    window.addEventListener("scroll", dismissTooltip, true)

    return () => {
      window.removeEventListener("resize", dismissTooltip)
      window.removeEventListener("scroll", dismissTooltip, true)
    }
  }, [tooltipAnchor])

  const isDisabled = disabled || loading

  return (
    <>
      <span
        className="inline-flex shrink-0"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      >
        <button
          ref={buttonRef}
          type={type}
          aria-label={label}
          aria-describedby={tooltipAnchor ? tooltipId : undefined}
          disabled={isDisabled}
          onFocus={showTooltip}
          onBlur={hideTooltip}
          className={`inline-flex shrink-0 items-center justify-center border transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.neutral} ${className}`}
          {...buttonProps}
        >
          {loading ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : children}
        </button>
      </span>

      {tooltipAnchor && typeof document !== "undefined" && createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[9999] w-max max-w-[220px] whitespace-normal break-words rounded-lg bg-slate-950 px-2.5 py-1.5 text-center text-xs font-bold leading-4 text-white shadow-xl"
          style={{
            left: tooltipPosition?.left ?? 0,
            top: tooltipPosition?.top ?? 0,
            maxWidth: "min(220px, calc(100vw - 16px))",
            transform: "translateX(-50%)",
            visibility: tooltipPosition ? "visible" : "hidden",
          }}
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  )
}

export default TableActionButton
