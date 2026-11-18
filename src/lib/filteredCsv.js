import { api } from "./api"

// Exports use the same server-side filters as the table but deliberately
// omit page/limit, so the API streams the complete matching dataset.
export const downloadFilteredCsv = async (url, filters, filenamePrefix) => {
  let response
  try {
    response = await api.get(url, {
      params: filters,
      responseType: "blob",
      timeout: 0,
    })
  } catch (error) {
    // Axios returns API errors as Blobs when responseType is blob.
    if (error?.response?.data instanceof Blob) {
      try {
        const details = JSON.parse(await error.response.data.text())
        if (details?.message) throw new Error(details.message)
      } catch (parseError) {
        if (parseError instanceof SyntaxError) throw error
        throw parseError
      }
    }
    throw error
  }

  const blob = response.data
  const urlObject = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = urlObject
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(urlObject), 1000)
}
