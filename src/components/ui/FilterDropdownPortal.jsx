import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

const VIEWPORT_GAP = 12
const OFFSET = 8

/** Portalled, viewport-aware filter panel for tables inside clipped cards. */
const FilterDropdownPortal = ({ open, anchorRef, onClose, children, className = "" }) => {
  const panelRef = useRef(null)
  const [position, setPosition] = useState(null)

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const rect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const panelWidth = Math.min(panelRect.width, window.innerWidth - VIEWPORT_GAP * 2)
    const panelHeight = Math.min(panel.scrollHeight, window.innerHeight - VIEWPORT_GAP * 2)
    const left = Math.max(VIEWPORT_GAP, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - VIEWPORT_GAP))
    const below = window.innerHeight - rect.bottom - VIEWPORT_GAP - OFFSET
    const above = rect.top - VIEWPORT_GAP - OFFSET
    const displayAbove = below < panelHeight && above > below
    const maxHeight = Math.max(60, Math.min(panelHeight, displayAbove ? above : below))
    const top = displayAbove
      ? Math.max(VIEWPORT_GAP, rect.top - maxHeight - OFFSET)
      : Math.max(VIEWPORT_GAP, Math.min(rect.bottom + OFFSET, window.innerHeight - maxHeight - VIEWPORT_GAP))
    setPosition((previous) => previous?.left === left && previous?.top === top && previous?.maxHeight === maxHeight
      ? previous : { left, top, maxHeight })
  }, [anchorRef])

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return undefined
    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePosition) : null
    if (panelRef.current) observer?.observe(panelRef.current)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      observer?.disconnect()
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined
    const handlePointerDown = (event) => {
      if (!anchorRef?.current?.contains(event.target) && !panelRef.current?.contains(event.target)) onClose()
    }
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      onClose()
      anchorRef?.current?.querySelector("button")?.focus()
    }
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, anchorRef, onClose])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Table filters"
      className={`fixed z-[9990] overflow-y-auto overscroll-contain ${className}`}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        maxWidth: `calc(100vw - ${VIEWPORT_GAP * 2}px)`,
        maxHeight: position?.maxHeight ?? "calc(100vh - 24px)",
        visibility: position ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

export default FilterDropdownPortal
