import { useEffect } from "react"

export const useClickOutside = (refs, onOutside, enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined

    const refList = Array.isArray(refs) ? refs : [refs]

    const handlePointerDown = (event) => {
      const clickedInside = refList.some((ref) => ref?.current?.contains(event.target))
      if (!clickedInside) onOutside(event)
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onOutside(event)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown, { passive: true })
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [enabled, onOutside, refs])
}

export default useClickOutside
