import { Link } from "react-router-dom"
import { ArrowRight, CheckCircle2, ClipboardList } from "lucide-react"

const PlaceholderPage = ({ title, description, moduleName = "CMS Module", checklist = [] }) => {
  const items = checklist.length ? checklist : ["Search and filter", "View details", "Approve or reject", "Add remarks", "Upload or view documents", "Export report"]

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700">
          <ClipboardList size={15} /> {moduleName}
        </div>
        <h1 className="mt-1 text-2xl font-black text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="card p-5 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">Recommended CMS Fields</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Suggested controls for this module screen.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-700" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">Yard CMS Ready</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Yard setup and inventory board are already active. Use Yard Area Setup for capacity configuration, then Inventory Board for drag and drop block layout.
          </p>
          <div className="mt-5 space-y-3">
            <Link to="/yard/area-setup" className="btn-secondary w-full justify-between">
              Open Yard Area Setup <ArrowRight size={16} />
            </Link>
            <Link to="/yard/inventory" className="btn-primary w-full justify-between">
              Open Inventory Board <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlaceholderPage
