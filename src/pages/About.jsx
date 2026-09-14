import {
  FiAward,
  FiCheckCircle,
  FiCompass,
  FiEye,
  FiHeart,
  FiMapPin,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from "react-icons/fi"
import { companyOverview, coreValues, services, whyChooseUs } from "../constants/companyProfile"

const valueIcons = [FiShield, FiCheckCircle, FiHeart, FiAward, FiZap, FiUsers]
const strengthIcons = [FiMapPin, FiShield, FiZap, FiUsers, FiTrendingUp, FiHeart, FiCheckCircle, FiAward]

const About = () => (
  <div className="mx-auto max-w-7xl space-y-8">
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-7 sm:p-10 lg:p-14">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">About One True Logistics Inc.</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Your trusted container depot and logistics partner</h1>
          <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">{companyOverview.summary}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {services.slice(0, 6).map((service) => (
              <div key={service} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <FiCheckCircle className="mt-0.5 shrink-0 text-emerald-600" />
                {service}
              </div>
            ))}
          </div>
        </div>
        <div className="relative min-h-[420px] bg-emerald-950 lg:min-h-full">
          <img src="/images/company/container-handler.webp" alt="One True Logistics container handling operation" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-9">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] backdrop-blur-sm"><FiMapPin /> Port Area, Manila</div>
            <p className="mt-3 max-w-md text-sm leading-6 text-emerald-50">A secured, process-driven facility supporting efficient container handling and dependable logistics operations.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="overflow-hidden rounded-[2rem] border border-amber-200 bg-amber-50 shadow-sm">
      <div className="p-7 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Client service acknowledgment</p>
        <h2 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">Yard Services and Client Responsibility</h2>
        <p className="mt-4 text-sm leading-7 text-slate-700 sm:text-base">
          The Client hereby engages and requests the services of One True Logistics Inc. in connection with, but not limited to, the receiving, storage, stripping, stuffing, loading, unloading, lifting, shifting, transferring, hauling, container handling, and all other activities and services provided by One True Logistics Inc. involving the Client&apos;s cargo, containers, equipment, and other properties within the One True Logistics Inc. Yard. The Client acknowledges and agrees that all such activities and services are undertaken at the Client&apos;s own risk and responsibility. One True Logistics Inc. shall not be held liable or responsible for any loss, damage, deterioration, shortage, delay, or any other loss or consequence arising from or in connection with such activities or services, except in cases of proven gross negligence or willful misconduct by One True Logistics Inc.
        </p>
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-3">
      <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-white"><FiCompass className="h-6 w-6" /></span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Our purpose</p>
        <p className="mt-2 leading-7 text-slate-700">{companyOverview.purpose}</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white"><FiEye className="h-6 w-6" /></span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Our vision</p>
        <p className="mt-2 leading-7 text-slate-700">{companyOverview.vision}</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-white"><FiTarget className="h-6 w-6" /></span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Our mission</p>
        <p className="mt-2 leading-7 text-slate-700">{companyOverview.mission}</p>
      </article>
    </section>

    <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
      <img src="/images/company/values-yard.webp" alt="Container handler operating in the One True Logistics yard" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/55" />
      <div className="relative p-7 sm:p-10 lg:p-12">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Vision, mission and core values</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Driven by our purpose, guided by our values</h2>
          <p className="mt-3 leading-7 text-slate-300">Our values shape how we work, how we serve clients, and how we make decisions throughout every logistics operation.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coreValues.map((value, index) => {
            const Icon = valueIcons[index] || FiCheckCircle
            return (
              <article key={value.title} className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-lg font-black">{value.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{value.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>

    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <img src="/images/company/why-choose.webp" alt="Container handling equipment and stacked containers" className="h-full min-h-[360px] w-full object-cover" />
        <div className="p-7 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Why choose One True Logistics?</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">More than a depot. A dependable supply-chain partner.</h2>
          <p className="mt-3 leading-7 text-slate-600">We combine strategic location, capable people, modern equipment, and structured systems to deliver reliable service and build long-term partnerships.</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {whyChooseUs.map((item, index) => {
              const Icon = strengthIcons[index] || FiCheckCircle
              return (
                <article key={item.title} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  </div>
)

export default About
