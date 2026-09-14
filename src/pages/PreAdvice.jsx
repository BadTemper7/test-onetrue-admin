import { useCallback, useEffect, useRef, useState } from "react"
import { ClipboardList, FileText, RefreshCw, Send } from "lucide-react"
import Alert from "../components/Alert"
import ModernFileInput from "../components/ModernFileInput"
import InputDate from "../components/ui/InputDate"
import { api, getApiError } from "../lib/api"

const toDateOnlyString = (value) => {
  if (!value) return ""
  if (typeof value === "string") return value.slice(0, 10)

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const initialForm = {
  containerNumber: "",
  containerSize: "20",
  containerType: "dry",
  containerStatus: "empty",
  shippingLine: "",
  blNumber: "",
  vesselVoyage: "",
  cargoDescription: "",
  dangerousGoodsClassification: "",
  weight: "",
  arrivalDate: "",
}

const documentFields = [
  { name: "deliveryOrder", label: "Delivery Order", required: true },
  { name: "bookingConfirmation", label: "Booking Confirmation", required: false },
  { name: "packingList", label: "Packing List", required: false },
  { name: "customsClearance", label: "Customs Clearance", required: false },
  { name: "otherDocument", label: "Other Document", required: false },
]

const statusClass = (status) => {
  if (status === "confirmed") return "bg-blue-50 text-blue-700"
  if (status === "used_for_gate_in") return "bg-blue-50 text-blue-700"
  if (status === "rejected") return "bg-red-50 text-red-700"
  return "bg-amber-50 text-amber-700"
}

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
)

const ClientPreAdvice = () => {
  const [form, setForm] = useState(initialForm)
  const [files, setFiles] = useState({})
  const [preAdvices, setPreAdvices] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ type: "", message: "" })

  const preAdviceRequestRef = useRef(null)

  const loadPreAdvices = useCallback(async ({ force = false } = {}) => {
    if (!force && preAdviceRequestRef.current) return preAdviceRequestRef.current

    const request = (async () => {
      try {
        setLoading(true)
        const { data } = await api.get("/client/pre-advices")
        setPreAdvices(data.preAdvices || [])
      } catch (error) {
        setAlert({ type: "error", message: getApiError(error) })
      } finally {
        if (preAdviceRequestRef.current === request) {
          preAdviceRequestRef.current = null
        }
        setLoading(false)
      }
    })()

    preAdviceRequestRef.current = request
    return request
  }, [])

  useEffect(() => {
    loadPreAdvices()
  }, [loadPreAdvices])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleDateChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: toDateOnlyString(value) }))
  }

  const handleFileChange = (event) => {
    const { name, files: fileList } = event.target
    setFiles((current) => ({ ...current, [name]: fileList?.[0] || null }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAlert({ type: "", message: "" })

    try {
      setSubmitting(true)
      const formData = new FormData()

      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value)
      })

      Object.entries(files).forEach(([key, file]) => {
        if (file) formData.append(key, file)
      })

      await api.post("/client/pre-advices", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      setAlert({ type: "success", message: "Pre-advice submitted. Please wait for admin confirmation before Gate-In." })
      setForm(initialForm)
      setFiles({})
      event.target.reset()
      await loadPreAdvices({ force: true })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
          <ClipboardList size={14} />
          Client Pre-Advice
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Submit Pre-Advice</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Submit container details and documents. Admin must confirm the pre-advice before Gate-In. Only after Gate-In will the container appear in the Inventory Board.
        </p>
      </div>

      <Alert type={alert.type}>{alert.message}</Alert>

      <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <form onSubmit={handleSubmit} className="card p-6">
          <h2 className="text-lg font-black text-slate-950">Container Details</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Container Number">
              <input className="input uppercase" name="containerNumber" value={form.containerNumber} onChange={handleChange} placeholder="Enter container number" required />
            </Field>

            <Field label="Container Size">
              <select className="input" name="containerSize" value={form.containerSize} onChange={handleChange} required>
                <option value="20">20 FT</option>
                <option value="40">40 FT</option>
              </select>
            </Field>

            <Field label="Container Type">
              <select className="input" name="containerType" value={form.containerType} onChange={handleChange} required>
                <option value="dry">Dry</option>
                <option value="reefer">Reefer</option>
                <option value="tank">Tank</option>
                <option value="open_top">Open Top</option>
                <option value="flat_rack">Flat Rack</option>
              </select>
            </Field>

            <Field label="Container Status">
              <select className="input" name="containerStatus" value={form.containerStatus} onChange={handleChange} required>
                <option value="empty">Empty</option>
                <option value="laden">Laden</option>
              </select>
            </Field>

            <Field label="Shipping Line">
              <input className="input" name="shippingLine" value={form.shippingLine} onChange={handleChange} placeholder="Shipping line" required />
            </Field>

            <Field label="Arrival Date">
              <InputDate name="arrivalDate" value={form.arrivalDate} onChange={handleDateChange} required />
            </Field>

            <Field label="BL Number">
              <input className="input" name="blNumber" value={form.blNumber} onChange={handleChange} placeholder="Optional" />
            </Field>

            <Field label="Vessel / Voyage">
              <input className="input" name="vesselVoyage" value={form.vesselVoyage} onChange={handleChange} placeholder="Optional" />
            </Field>

            <Field label="Weight">
              <input className="input" name="weight" type="number" min="0" step="0.01" value={form.weight} onChange={handleChange} placeholder="Optional" />
            </Field>

            <div className="md:col-span-2">
              <Field label="Cargo Description">
                <textarea className="input min-h-24 resize-y" name="cargoDescription" value={form.cargoDescription} onChange={handleChange} placeholder="Optional cargo description" />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Dangerous Goods Classification">
                <input className="input" name="dangerousGoodsClassification" value={form.dangerousGoodsClassification} onChange={handleChange} placeholder="Optional DG class" />
              </Field>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Documents</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">Upload clear copies of the required documents for admin review.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">PDF, DOC, JPG, PNG, WEBP</span>
          </div>
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-black">Delivery Order / Supporting Delivery Document</p>
            <p className="mt-1 font-semibold">
              Accepted examples: Equipment Interchange Receipt (EIR), Bill of Lading (B/L), Waybill, Delivery Receipt, Delivery Order, or other supporting delivery documents.
            </p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {documentFields.map((doc) => (
              <ModernFileInput
                key={doc.name}
                name={doc.name}
                label={doc.label}
                required={doc.required}
                file={files[doc.name]}
                onChange={handleFileChange}
              />
            ))}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
            <Send size={18} />
            {submitting ? "Submitting..." : "Submit Pre-Advice"}
          </button>
        </form>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-black text-slate-950">My Pre-Advices</h2>
              <p className="text-sm font-medium text-slate-500">Confirmed records can proceed to Gate-In.</p>
            </div>
            <button type="button" onClick={() => loadPreAdvices({ force: true })} className="btn-secondary !px-3">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="max-h-[760px] divide-y divide-slate-200 overflow-y-auto">
            {loading && <div className="p-5 text-sm font-bold text-slate-500">Loading...</div>}
            {!loading && preAdvices.length === 0 && <div className="p-5 text-sm font-bold text-slate-500">No pre-advice yet.</div>}

            {preAdvices.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-950">{item.containerNumber}</div>
                    <div className="text-xs font-black uppercase text-slate-400">{item.preAdviceNumber}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{item.status.replaceAll("_", " ")}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
                  <div>{item.containerSize} FT / {item.containerType} / {item.containerStatus}</div>
                  <div>{item.shippingLine}</div>
                  <div>Booking No.: {item.bookingNumber || "Generated after approval"}</div>
                  {item.rejectionReason && <div className="rounded-xl bg-red-50 p-3 text-red-700">Reason: {item.rejectionReason}</div>}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <FileText size={14} /> {item.documents?.length || 0} documents uploaded
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientPreAdvice
