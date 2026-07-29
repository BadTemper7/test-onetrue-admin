import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react"

const toastConfig = {
  info: {
    icon: Info,
    wrapper: "border-blue-200 bg-blue-50 text-blue-900 shadow-blue-950/10",
    iconBox: "bg-blue-100 text-blue-700",
    title: "Notice",
  },
  success: {
    icon: CheckCircle2,
    wrapper: "border-blue-200 bg-blue-50 text-blue-900 shadow-blue-950/10",
    iconBox: "bg-blue-100 text-blue-700",
    title: "Success",
  },
  error: {
    icon: XCircle,
    wrapper: "border-red-200 bg-red-50 text-red-900 shadow-red-950/10",
    iconBox: "bg-red-100 text-red-700",
    title: "Error",
  },
  warning: {
    icon: AlertTriangle,
    wrapper: "border-amber-200 bg-amber-50 text-amber-900 shadow-amber-950/10",
    iconBox: "bg-amber-100 text-amber-700",
    title: "Warning",
  },
}

const Alert = ({ type = "info", children }) => {
  const [visible, setVisible] = useState(Boolean(children))
  const config = toastConfig[type] || toastConfig.info
  const Icon = config.icon

  useEffect(() => {
    if (!children) {
      setVisible(false)
      return undefined
    }

    setVisible(true)

    const timer = window.setTimeout(() => {
      setVisible(false)
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [children, type])

  if (!children || !visible) return null

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] w-[calc(100%-2rem)] max-w-md sm:right-6 sm:top-6">
      <div
        className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${config.wrapper}`}
        role="alert"
      >
        <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${config.iconBox}`}>
          <Icon size={19} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-black leading-5">{config.title}</div>
          <div className="mt-0.5 text-sm font-semibold leading-5">{children}</div>
        </div>

        <button
          type="button"
          onClick={() => setVisible(false)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-current opacity-70 transition hover:opacity-100"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

export default Alert
