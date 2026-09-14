import { useNavigate } from "react-router-dom"
import {
  FiArrowRight,
  FiBox,
  FiCheckCircle,
  FiClipboard,
  FiFileText,
  FiMapPin,
  FiPackage,
  FiShield,
  FiTruck,
} from "react-icons/fi"
import { operationsProcess, services } from "../constants/companyProfile"

const serviceIcons = [FiPackage, FiMapPin, FiBox, FiTruck, FiClipboard, FiFileText, FiTruck, FiTruck, FiPackage]

const Services = () => {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-emerald-950 text-white shadow-xl">
        <img
          src="/images/company/services-yard.webp"
          alt="One True Logistics container yard operations"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/90 to-emerald-950/35" />
        <div className="relative max-w-3xl px-6 py-14 sm:px-10 lg:px-14 lg:py-20">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Integrated logistics solutions</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Our Services</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
            Seamless container depot and logistics services designed to support shipping lines, freight forwarders, importers, exporters, and transport operators.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate("/booking")} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-emerald-900 shadow-lg transition hover:-translate-y-0.5">
              Create a booking <FiArrowRight />
            </button>
            <button type="button" onClick={() => navigate("/contact")} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/15">
              Contact our team
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">What we do</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Complete container depot support</h2>
          <p className="mt-3 leading-7 text-slate-600">Modern equipment, skilled people, secure facilities, and a digital operating system work together to keep containers moving safely and efficiently.</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => {
            const Icon = serviceIcons[index] || FiCheckCircle
            return (
              <article key={service} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-700 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-black text-slate-900">{service}</h3>
              </article>
            )
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Operational workflow</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">From pre-advice to final gate-out</h2>
            <p className="mt-3 leading-7 text-slate-600">Every stage is recorded in the portal to give clients a clearer view of container movement, billing, and release status.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
            <FiShield /> Safe. Secure. Efficient.
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {operationsProcess.map((item) => (
            <article key={item.step} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <span className="absolute right-4 top-3 text-5xl font-black text-emerald-100">{item.step}</span>
              <div className="relative">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Step {item.step}</p>
                <h3 className="mt-2 text-lg font-black text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Services
