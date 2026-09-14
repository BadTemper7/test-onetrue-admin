import {
  FiExternalLink,
  FiGlobe,
  FiMail,
  FiMapPin,
  FiPhone,
} from "react-icons/fi"
import { companyContact } from "../constants/companyProfile"

const ContactItem = ({ icon: Icon, label, value, href }) => {
  const content = (
    <div className="group flex h-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-700 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
        <span className="mt-1 block break-words text-sm font-bold leading-6 text-slate-800 sm:text-base">{value}</span>
      </span>
      {href && <FiExternalLink className="mt-1 shrink-0 text-slate-300 transition group-hover:text-emerald-600" />}
    </div>
  )

  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="block h-full">
      {content}
    </a>
  ) : content
}

const Contact = () => (
  <div className="mx-auto max-w-7xl">
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative min-h-[280px] overflow-hidden bg-emerald-950 sm:min-h-[360px] lg:min-h-full">
          <img
            src="/images/company/yard-overview.webp"
            alt="One True Logistics container yard"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-emerald-950/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8 lg:p-10">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">One True Logistics</p>
            <p className="mt-2 max-w-md text-lg font-black leading-7 sm:text-xl">Container depot and logistics support in the Port Area of Manila.</p>
          </div>
        </div>

        <div>
          <div className="border-b border-emerald-100 bg-emerald-50/70 px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">We are here to serve you</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Contact Information</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Contact One True Logistics for container bookings, depot operations, billing concerns, release coordination, and general assistance.
            </p>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-10 lg:p-12">
            <ContactItem icon={FiMail} label="Office email" value={companyContact.email} href={`mailto:${companyContact.email}`} />
            <ContactItem icon={FiPhone} label="Mobile number" value={companyContact.mobile} href={`tel:${companyContact.mobile}`} />
            <ContactItem icon={FiGlobe} label="Website" value={companyContact.website} href={`https://${companyContact.website}`} />
            <ContactItem icon={FiMapPin} label="Office address" value={companyContact.address} />
          </div>
        </div>
      </div>
    </section>
  </div>
)

export default Contact
