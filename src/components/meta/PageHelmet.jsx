import { useEffect } from "react"

const BRAND = "One True Logistics Admin"

const PageHelmet = ({ title, description = "One True Logistics administration and container yard management portal." }) => {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title ? `${title} | ${BRAND}` : BRAND

    let meta = document.querySelector('meta[name="description"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement("meta")
      meta.setAttribute("name", "description")
      document.head.appendChild(meta)
    }
    const previousDescription = meta.getAttribute("content") || ""
    meta.setAttribute("content", description)

    return () => {
      document.title = previousTitle
      if (created) meta.remove()
      else meta.setAttribute("content", previousDescription)
    }
  }, [description, title])

  return null
}

export default PageHelmet
