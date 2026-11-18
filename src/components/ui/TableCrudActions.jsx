import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Eye, LoaderCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import TableActionButton from "./TableActionButton"

const MENU_WIDTH = 204
const VIEWPORT_GAP = 8

// Keep contextual names for assistive technology, but show only the verb in the menu.
// Different operations (e.g. Deactivate or Cancel) must remain distinguishable.
const destructiveMenuLabel = (description) => {
  const verb = String(description || "").match(/^(delete|deactivate|cancel|remove|archive|revoke)\b/i)?.[1]
  return verb ? verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase() : "Delete"
}

// Common row actions. Keep the two frequent actions discoverable and put
// destructive/secondary actions in a portal so scrollable tables never clip them.
const TableCrudActions = ({
  recordLabel = "record",
  onView,
  onEdit,
  onDelete,
  viewDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
  viewLabel,
  editLabel,
  deleteLabel,
  deleting = false,
  children,
  className = "",
  compact = false,
}) => {
  const [mobileView, setMobileView] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches)
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const update = () => setMobileView(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  const compactMode = compact || mobileView
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()
  const safeLabel = String(recordLabel || "record")

  const menuActions = Children.toArray(children)
    .filter(isValidElement)
    .filter((child) => typeof child.props.onClick === "function")
    .map((child, index) => ({
      id: `extra-${index}`,
      label: child.props.menuLabel || child.props.label || "Action",
      description: child.props.label || `Additional action for ${safeLabel}`,
      icon: child.props.children,
      onClick: child.props.onClick,
      disabled: Boolean(child.props.disabled || child.props.loading),
      loading: Boolean(child.props.loading),
      tone: child.props.variant === "danger" ? "danger" : "normal",
    }))

  // Client-verification-style compact actions use the same accessible portal
  // as other table actions. This is presentation-only: handlers are unchanged.
  if (compactMode) {
    if (typeof onEdit === "function" && !editDisabled) {
      menuActions.unshift({ id: "edit", label: "Edit", description: editLabel || `Edit ${safeLabel}`,
        icon: <Pencil size={16} aria-hidden="true" />, onClick: onEdit,
        disabled: editDisabled, loading: false, tone: "normal" })
    }
    if (typeof onView === "function") {
      menuActions.unshift({ id: "view", label: "View details", description: viewLabel || `View ${safeLabel}`,
        icon: <Eye size={16} aria-hidden="true" />, onClick: onView,
        disabled: viewDisabled, loading: false, tone: "normal" })
    }
  }

  if (typeof onDelete === "function" && (!deleteDisabled || deleting)) {
    menuActions.push({
      id: "delete",
      label: destructiveMenuLabel(deleteLabel),
      description: deleteLabel || `Delete ${safeLabel}`,
      icon: <Trash2 size={16} aria-hidden="true" />,
      onClick: onDelete,
      disabled: deleteDisabled || deleting,
      loading: deleting,
      tone: "danger",
    })
  }

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current || !menuRef.current) return
    const anchor = triggerRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current.getBoundingClientRect().height
    const menuWidth = Math.min(MENU_WIDTH, window.innerWidth - VIEWPORT_GAP * 2)
    const left = Math.max(VIEWPORT_GAP, Math.min(anchor.right - menuWidth, window.innerWidth - menuWidth - VIEWPORT_GAP))
    const enoughBelow = window.innerHeight - anchor.bottom >= menuHeight + VIEWPORT_GAP
    const top = enoughBelow
      ? anchor.bottom + 6
      : Math.max(VIEWPORT_GAP, anchor.top - menuHeight - 6)
    setMenuPosition({ top, left, width: menuWidth })
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return undefined
    const dismissIfOutside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    const dismissOnEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    const dismissOnScroll = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const dismissOnResize = () => setMenuOpen(false)
    document.addEventListener("pointerdown", dismissIfOutside)
    document.addEventListener("keydown", dismissOnEscape)
    window.addEventListener("scroll", dismissOnScroll, true)
    window.addEventListener("resize", dismissOnResize)
    return () => {
      document.removeEventListener("pointerdown", dismissIfOutside)
      document.removeEventListener("keydown", dismissOnEscape)
      window.removeEventListener("scroll", dismissOnScroll, true)
      window.removeEventListener("resize", dismissOnResize)
    }
  }, [menuOpen])

  // Move focus into the portal when opened; keyboard navigation is kept
  // inside the menu until the user selects an action or dismisses it.
  useEffect(() => {
    if (menuOpen && menuPosition) {
      menuRef.current?.querySelector('button:not(:disabled)')?.focus()
    }
  }, [menuOpen, menuPosition])

  const handleMenuKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
    const buttons = [...(menuRef.current?.querySelectorAll('button:not(:disabled)') || [])]
    if (buttons.length === 0) return
    event.preventDefault()
    const index = buttons.indexOf(document.activeElement)
    if (event.key === "Home") buttons[0].focus()
    else if (event.key === "End") buttons[buttons.length - 1].focus()
    else if (event.key === "ArrowDown") buttons[(index + 1) % buttons.length].focus()
    else buttons[(index < 0 ? 0 : index + buttons.length - 1) % buttons.length].focus()
  }

  const selectMenuAction = (action) => {
    if (action.disabled) return
    setMenuOpen(false)
    action.onClick()
  }

  return (
    <div className={`table-row-actions flex items-center justify-end gap-2 ${className}`}>
      {!compactMode && typeof onView === "function" && (
        <TableActionButton
          label={viewLabel || `View ${safeLabel}`}
          variant="neutral"
          disabled={viewDisabled}
          onClick={onView}
        >
          <Eye size={17} aria-hidden="true" />
        </TableActionButton>
      )}
      {!compactMode && typeof onEdit === "function" && !editDisabled && (
        <TableActionButton
          label={editLabel || `Edit ${safeLabel}`}
          variant="info"
          onClick={onEdit}
        >
          <Pencil size={17} aria-hidden="true" />
        </TableActionButton>
      )}
      {menuActions.length > 0 && (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label={`More actions for ${safeLabel}`}
            title="More actions"
            aria-haspopup="menu"
            aria-controls={menuOpen ? menuId : undefined}
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuPosition(null)
              setMenuOpen((previous) => !previous)
            }}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${menuOpen ? "border-emerald-300 bg-emerald-50" : ""}`}
          >
            <MoreHorizontal size={19} aria-hidden="true" />
          </button>
          {menuOpen && typeof document !== "undefined" && createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              onKeyDown={handleMenuKeyDown}
              aria-label={`More actions for ${safeLabel}`}
              className="fixed z-[9999] max-h-[min(70vh,340px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-950/15"
              style={{
                left: menuPosition?.left ?? 0,
                top: menuPosition?.top ?? 0,
                width: menuPosition?.width ?? MENU_WIDTH,
                visibility: menuPosition ? "visible" : "hidden",
              }}
            >
              {menuActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  aria-label={action.description}
                  disabled={action.disabled}
                  onClick={() => selectMenuAction(action)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-45 ${action.tone === "danger" ? "text-red-700 hover:bg-red-50" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {action.loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : action.icon}
                  </span>
                  <span className="min-w-0 break-words">{action.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  )
}

export default TableCrudActions
