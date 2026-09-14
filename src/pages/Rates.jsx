import { useEffect, useMemo, useState } from "react"
import { Calculator, CheckCircle2, Globe2, MapPinned } from "lucide-react"
import { api, getApiError } from "../lib/api"

const scopeLabels = {
  base: "Fixed handling",
  storage: "Storage per day",
  display_only: "Reference only",
}

const unitLabels = {
  per_container: "per container",
  per_teu: "per 20ft equivalent",
  per_day: "per day",
  storage_day: "per container per day",
  fixed: "fixed charge",
}

const rateTypeOptions = [
  {
    value: "local",
    label: "Local Rates",
    title: "Local Container Rates",
    description: "View the handling and storage charges for local container transactions.",
    emptyMessage: "No local rates are currently configured.",
    icon: MapPinned,
  },
  {
    value: "international",
    label: "International Rates",
    title: "International Container Rates",
    description: "View the handling and storage charges for international container transactions.",
    emptyMessage: "No international rates are currently configured.",
    icon: Globe2,
  },
]

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const groupRates = (items) => ({
  handling: items.filter((rate) => ["base", "display_only"].includes(rate.billingScope)),
  storage: items.filter((rate) => rate.billingScope === "storage"),
  total: items.length,
})

const Rates = () => {
  const [rates, setRates] = useState([])
  const [activeRateType, setActiveRateType] = useState("local")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError("")
        const { data } = await api.get("/client/rates")
        setRates(data.rates || [])
      } catch (requestError) {
        setError(getApiError(requestError))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const ratesByType = useMemo(() => {
    const visibleRates = rates.filter((rate) => rate.billingScope !== "optional_stripping_stuffing")

    return {
      local: groupRates(visibleRates.filter((rate) => (rate.rateType || "local") === "local")),
      international: groupRates(visibleRates.filter((rate) => rate.rateType === "international")),
      total: visibleRates.length,
    }
  }, [rates])

  const selectedOption = rateTypeOptions.find((option) => option.value === activeRateType) || rateTypeOptions[0]
  const selectedGroups = ratesByType[activeRateType]

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-7 text-white md:p-9">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
            <Calculator size={14} /> Published Container Rates
          </div>
          <h1 className="mt-4 text-3xl font-black md:text-4xl">Container Yard Rates</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/75 md:text-base">
            Select Local or International to display only the charges that apply to your container transaction.
          </p>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-3xl border border-slate-200 bg-white">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Rate Classification</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Choose which rates to view</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Local rates are selected by default. Select the other card at any time to switch the displayed rate list.</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {rateTypeOptions.map((option) => {
                const Icon = option.icon
                const selected = activeRateType === option.value
                const count = ratesByType[option.value]?.total || 0

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setActiveRateType(option.value)}
                    aria-pressed={selected}
                    className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${selected
                      ? "border-emerald-500 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-4">
                        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition ${selected
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700"}`}
                        >
                          <Icon size={22} />
                        </span>

                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-black text-slate-950">{option.label}</span>
                            {selected && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                                <CheckCircle2 size={12} /> Selected
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-sm font-semibold leading-5 text-slate-500">{option.description}</span>
                        </span>
                      </div>

                      <span className={`shrink-0 rounded-xl px-3 py-2 text-xl font-black ${selected
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "bg-slate-100 text-slate-700"}`}
                      >
                        {count}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {ratesByType.total === 0 ? (
            <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <h2 className="text-xl font-black text-slate-900">No rates configured yet</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">The administrator must add billing rates in Rate Setup before they can be displayed.</p>
            </section>
          ) : (
            <RateTypePanel
              title={selectedOption.title}
              description={selectedOption.description}
              icon={selectedOption.icon}
              groups={selectedGroups}
              emptyMessage={selectedOption.emptyMessage}
            />
          )}

          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="font-black text-emerald-900">How the final bill is computed</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
              Final billing is generated after Date Out is submitted and uses the rate classification assigned to the booking, including Lift In, Lift Out, storage, and admin-added charges.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

const RateTypePanel = ({ title, description, icon: Icon, groups, emptyMessage }) => (
  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 bg-emerald-50/60 px-6 py-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white">
          <Icon size={20} />
        </span>
        <div>
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
        </div>
      </div>
    </div>

    {groups.total === 0 ? (
      <div className="p-10 text-center text-sm font-semibold text-slate-500">{emptyMessage}</div>
    ) : (
      <div className="space-y-6 p-5 md:p-6">
        <RateGroup title="Lift In and Lift Out" description="Fixed handling charges based on container size." items={groups.handling} />
        <RateGroup title="Storage" description="Daily storage charges multiplied by billable days." items={groups.storage} />
      </div>
    )}
  </section>
)

const RateGroup = ({ title, description, items }) => {
  if (!items.length) return null

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900">{title}</h3>
          <p className="text-xs font-semibold text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{items.length}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((rate) => (
          <article key={rate.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{scopeLabels[rate.billingScope] || rate.billingScope}</p>
                <h4 className="mt-1 font-black text-slate-900">
                  {rate.chargeCode?.startsWith("LIFT_ON_")
                    ? "Lift On Charge"
                    : rate.chargeCode?.startsWith("LIFT_OFF_")
                      ? "Lift Off Charge"
                      : rate.description}
                </h4>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {rate.containerSize === "all" ? "All sizes" : `${rate.containerSize}ft`}
              </span>
            </div>

            <p className="mt-4 text-2xl font-black text-slate-950">{formatMoney(rate.rateAmount)}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{rate.unitLabel || unitLabels[rate.unit] || rate.unit}</p>
            {rate.freeDays > 0 && (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                Includes {rate.freeDays} free day{rate.freeDays === 1 ? "" : "s"}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

export default Rates
