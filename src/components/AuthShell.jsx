import { CheckCircle2, LockKeyhole, MailCheck, RadioTower, ShieldCheck } from "lucide-react"

const AuthShell = ({ eyebrow, title, subtitle, children, wide = false }) => {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-white lg:grid lg:grid-cols-[minmax(0,1fr)_560px]">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(20,184,166,.38),transparent_32%),radial-gradient(circle_at_84%_30%,rgba(59,130,246,.24),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_55%,#042f2e_100%)]" />
        <div className="surface-grid absolute inset-0 opacity-30" />
        <div className="absolute -right-24 top-28 h-72 w-72 rounded-full border border-emerald-300/20" />
        <div className="absolute -bottom-24 left-16 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div>
            <div className="inline-flex rounded-3xl border border-white/10 bg-white/95 px-4 py-3 shadow-2xl shadow-black/20">
              <img src="/images/otli-logo.webp" alt="OTLI" className="h-12 w-auto object-contain" />
            </div>

            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-100">
              <ShieldCheck size={15} />
              One True Logistics Inc.
            </div>

            <h1 className="mt-6 max-w-2xl text-5xl font-black leading-tight tracking-tight xl:text-6xl">
              Manage bookings, yard movement, and release in one portal.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              A cleaner operational workspace for client registration, account verification, container booking, gate-in, storage, billing, and gate-out.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm text-slate-200">
            {[
              { icon: LockKeyhole, label: "Secured access", text: "Role-based portal" },
              { icon: MailCheck, label: "Email OTP", text: "Client verification" },
              { icon: RadioTower, label: "Live updates", text: "Socket status" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-white/[0.08] p-4 shadow-xl shadow-black/10 backdrop-blur">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400/[0.15] text-emerald-100">
                    <Icon size={18} />
                  </div>
                  <div className="mt-3 font-black text-white">{item.label}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">{item.text}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(20,184,166,.12),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,.10),transparent_32%)]" />
        <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
          <div className="mb-7 text-center lg:text-left">
            <div className="mx-auto mb-5 inline-flex rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-slate-200/70 lg:mx-0">
              <img src="/images/otli-logo.webp" alt="OTLI" className="h-11 w-auto object-contain" />
            </div>
            <div className="soft-chip justify-center lg:justify-start">
              <CheckCircle2 size={14} />
              {eyebrow}
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthShell
