import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, KeyRound, Mail } from "lucide-react"
import AuthShell from "../components/AuthShell"
import Alert from "../components/Alert"
import OtpInput from "../components/OtpInput"
import { api, getApiError } from "../lib/api"

const ForgotPasswordPage = ({ type = "admin" }) => {
  const navigate = useNavigate()
  const redirectTimer = useRef(null)
  const [step, setStep] = useState("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)

  const isAdmin = type === "admin"
  const loginPath = isAdmin ? "/admin/login" : "/login"

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [])

  const requestOtp = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const { data } = await api.post("/auth/forgot-password", { email })
      setMessage(data.message)
      setStep("reset")
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      await api.post("/auth/reset-password", {
        email,
        otp,
        password,
        confirmPassword,
      })

      setPasswordChanged(true)
      setMessage("Password has been changed. Redirecting to login in 3 seconds.")
      setOtp("")
      setPassword("")
      setConfirmPassword("")

      redirectTimer.current = setTimeout(() => {
        navigate(loginPath, { replace: true })
      }, 3000)
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow={isAdmin ? "Admin Password" : "Client Password"}
      title="Reset your password"
      subtitle="Enter your email, then use the OTP sent to your inbox to create a new password."
    >
      {passwordChanged && (
        <div className="fixed right-4 top-4 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-800 shadow-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <CheckCircle2 size={18} />
          </span>
          Password has been changed. Redirecting to login in 3 seconds.
        </div>
      )}

      <div className="card space-y-4 p-5">
        <Alert type="success">{message}</Alert>
        <Alert type="error">{error}</Alert>

        {step === "email" ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Email address</label>
              <input className="input" type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              <Mail size={18} />
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : passwordChanged ? (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-center">
            <CheckCircle2 className="mx-auto text-blue-700" size={34} />
            <div className="mt-3 text-lg font-black text-blue-900">Password changed</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">Please wait. You will be redirected to the login page automatically.</p>
          </div>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">OTP code</label>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">New password</label>
              <input className="input" type="password" name="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Confirm password</label>
              <input className="input" type="password" name="confirmPassword" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </div>
            <button className="btn-primary w-full" disabled={loading || otp.length !== 6}>
              <KeyRound size={18} />
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

      </div>
    </AuthShell>
  )
}

export default ForgotPasswordPage
