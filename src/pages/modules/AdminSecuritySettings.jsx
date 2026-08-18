import { useState } from "react"
import { KeyRound, Save, ShieldCheck } from "lucide-react"
import Alert from "../../components/Alert"
import { api, getApiError } from "../../lib/api"

const AdminSecuritySettings = () => {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ type: "", message: "" })

  const submit = async (event) => {
    event.preventDefault()
    if (form.newPassword.length < 8) return setAlert({ type: "error", message: "New password must be at least 8 characters." })
    if (form.newPassword !== form.confirmPassword) return setAlert({ type: "error", message: "New password and confirmation do not match." })
    try {
      setSaving(true)
      setAlert({ type: "", message: "" })
      const { data } = await api.patch("/auth/change-password", form)
      setAlert({ type: "success", message: data.message || "Password changed successfully." })
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (error) {
      setAlert({ type: "error", message: getApiError(error) })
    } finally {
      setSaving(false)
    }
  }

  return <div className="mx-auto max-w-3xl space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><ShieldCheck /></div><div><h1 className="text-2xl font-black text-slate-950">Security Settings</h1><p className="text-sm font-semibold text-slate-500">Super Admin password management.</p></div></div></section>{alert.message && <Alert type={alert.type} message={alert.message} />}<form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-5"><label><span className="mb-1.5 block text-sm font-bold text-slate-700">Current Password</span><div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input type="password" className="input pl-10" value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} required /></div></label><label><span className="mb-1.5 block text-sm font-bold text-slate-700">New Password</span><input type="password" className="input" value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} minLength={8} required /></label><label><span className="mb-1.5 block text-sm font-bold text-slate-700">Confirm New Password</span><input type="password" className="input" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={8} required /></label><div className="flex justify-end"><button type="submit" className="btn-primary" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Change Password"}</button></div></div></form></div>
}

export default AdminSecuritySettings
