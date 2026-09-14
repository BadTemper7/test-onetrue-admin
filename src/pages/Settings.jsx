import { useState } from "react";
import { FiCheckCircle, FiLock, FiSave, FiShield } from "react-icons/fi";
import Button from "../components/ui/Button";
import InputText from "../components/ui/InputText";
import { api, getApiError } from "../lib/api";

const Settings = () => {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setMessage({ type: "", text: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.patch("/auth/change-password", form);
      setMessage({ type: "success", text: data.message || "Password changed successfully." });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      setMessage({ type: "error", text: getApiError(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="text-3xl font-bold text-slate-800">Account settings</h1><p className="mt-1 text-sm text-slate-500">Manage your account password and security.</p></div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><FiShield className="h-6 w-6" /></div>
          <div><h2 className="text-lg font-semibold text-slate-800">Change password</h2><p className="text-sm text-slate-500">Use a strong password that you do not use on another account.</p></div>
        </div>

        {message.text && (
          <div className={`mt-5 flex items-center gap-2 rounded-lg border p-3 text-sm ${message.type === "success" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {message.type === "success" && <FiCheckCircle />} {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <InputText label="Current Password" name="currentPassword" type={show.current ? "text" : "password"} value={form.currentPassword} onChange={handleChange} required icon={<FiLock />} showPasswordToggle onTogglePassword={() => setShow((value) => ({ ...value, current: !value.current }))} />
          <InputText label="New Password" name="newPassword" type={show.next ? "text" : "password"} value={form.newPassword} onChange={handleChange} required helperText="Minimum of 8 characters" icon={<FiLock />} showPasswordToggle onTogglePassword={() => setShow((value) => ({ ...value, next: !value.next }))} />
          <InputText label="Confirm New Password" name="confirmPassword" type={show.confirm ? "text" : "password"} value={form.confirmPassword} onChange={handleChange} required icon={<FiLock />} showPasswordToggle onTogglePassword={() => setShow((value) => ({ ...value, confirm: !value.confirm }))} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={loading} disabled={loading} icon={<FiSave className="h-4 w-4" />}>Save Password</Button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Settings;
