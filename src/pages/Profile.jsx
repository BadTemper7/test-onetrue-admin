import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiFileText,
  FiMail,
  FiMapPin,
  FiPhone,
  FiRefreshCw,
  FiSend,
  FiUser,
} from "react-icons/fi";
import { api, getApiError, resolveFileUrl } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

const statusStyles = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  verified: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  resubmitted: "bg-blue-50 text-blue-700 border-blue-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
};

const Profile = () => {
  const storedUser = useAuthStore((state) => state.user);
  const saveSession = useAuthStore((state) => state.saveSession);
  const token = useAuthStore((state) => state.token);
  const [user, setUser] = useState(storedUser);
  const [loading, setLoading] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({});
  const [files, setFiles] = useState({});

  const syncForm = (nextUser) => setForm({
    companyName: nextUser?.companyName || "",
    companyAddress: nextUser?.companyAddress || "",
    companyType: nextUser?.companyType || "",
    companyTypeOther: nextUser?.companyTypeOther || "",
    phoneNumber: nextUser?.phoneNumber || "",
    representativeFirstName: nextUser?.representativeFirstName || "",
    representativeMiddleName: nextUser?.representativeMiddleName || "",
    representativeLastName: nextUser?.representativeLastName || "",
    representativePosition: nextUser?.representativePosition || "",
  });

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/client/account-status");
      setUser(data.user);
      syncForm(data.user);
      saveSession({ token, user: data.user });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const resubmitAccount = async (event) => {
    event.preventDefault();
    setResubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value || ""));
      Object.entries(files).forEach(([key, file]) => { if (file) payload.append(key, file); });
      const { data } = await api.patch("/client/account/resubmit", payload, { headers: { "Content-Type": "multipart/form-data" } });
      setUser(data.user);
      saveSession({ token, user: data.user });
      setFiles({});
      setMessage(data.message);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setResubmitting(false);
    }
  };

  const details = [
    ["Representative", user?.name, FiUser],
    ["Email", user?.email, FiMail],
    ["Phone", user?.phoneNumber, FiPhone],
    ["Company address", user?.companyAddress, FiMapPin],
  ];

  const textField = (label, name, required = true) => (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}{required && <span className="text-red-500"> *</span>}</span>
      <input className="input" value={form[name] || ""} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} required={required} />
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Company profile</h1>
          <p className="mt-1 text-sm text-slate-500">Review your registration and account approval status.</p>
        </div>
        <button onClick={loadStatus} disabled={loading} className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-950 p-6 text-white md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-emerald-100">Registered company</p>
              <h2 className="mt-1 text-3xl font-bold">{user?.companyName || "Company"}</h2>
              <p className="mt-2 text-emerald-100 capitalize">{user?.companyType?.replaceAll("_", " ") || "Client account"}</p>
            </div>
            <span className={`w-fit rounded-full border px-4 py-2 text-sm font-semibold capitalize ${statusStyles[user?.status] || "border-white/30 bg-white/10 text-white"}`}>
              {user?.status || "pending"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          {details.map(([label, value, Icon]) => (
            <div key={label} className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <div className="rounded-lg bg-white p-2 text-emerald-600 shadow-sm"><Icon /></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-700">{value || "Not provided"}</p></div>
            </div>
          ))}
        </div>
      </section>

      {user?.status === "rejected" && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex gap-3"><FiAlertCircle className="mt-0.5 h-5 w-5 text-red-600" /><div><h3 className="font-semibold text-red-800">Registration needs attention</h3><p className="mt-1 text-sm text-red-700">{user?.rejectionReason || "Update the details below and resubmit your account."}</p></div></div>
          <form onSubmit={resubmitAccount} className="mt-5 space-y-5 rounded-xl bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              {textField("Company Name", "companyName")}
              {textField("Company Address", "companyAddress")}
              {textField("Business Type", "companyType")}
              {textField("Other Business Type", "companyTypeOther", false)}
              {textField("Phone Number", "phoneNumber")}
              {textField("Representative Position", "representativePosition")}
              {textField("Representative First Name", "representativeFirstName")}
              {textField("Representative Middle Name", "representativeMiddleName", false)}
              {textField("Representative Last Name", "representativeLastName")}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Replace documents only when corrections are needed.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {[
                  ["businessPermit", "Business Permit"],
                  ["birCertificate", "BIR Certificate"],
                  ["validId", "Valid ID"],
                  ["authorizationLetter", "Authorization Letter"],
                  ["otherDocument", "Other Document"],
                ].map(([name, label]) => (
                  <label key={name} className="rounded-xl border border-slate-200 p-3">
                    <span className="block text-sm font-semibold text-slate-700">{label}</span>
                    <input type="file" accept=".pdf,.doc,.docx,image/*" className="mt-2 block w-full text-sm" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && file.size > 10 * 1024 * 1024) { event.target.value = ""; window.alert("File size exceeds the 10 MB maximum upload size."); return; } setFiles((current) => ({ ...current, [name]: file })); }} />
                    <span className="mt-1 block text-xs text-slate-500">Maximum file size: 10 MB</span>
                  </label>
                ))}
              </div>
            </div>
            <button className="btn-primary" disabled={resubmitting}><FiSend /> {resubmitting ? "Resubmitting..." : "Resubmit Account"}</button>
          </form>
        </section>
      )}

      {user?.status === "resubmitted" && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-700">Your corrected registration has been resubmitted and is waiting for admin verification.</section>
      )}

      {["active", "verified"].includes(user?.status) && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex gap-3"><FiCheckCircle className="mt-0.5 h-5 w-5 text-blue-600" /><div><h3 className="font-semibold text-blue-800">Account verified</h3><p className="mt-1 text-sm text-blue-700">You can now submit bookings, payments, and gate-out requests.</p></div></div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800"><FiFileText className="text-emerald-600" /> Submitted documents</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(user?.documents || []).map((document) => (
            <a key={`${document.type}-${document.url}`} href={resolveFileUrl(document.secureUrl || document.url)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40">
              <p className="font-medium text-slate-700">{document.label}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{document.fileName}</p>
            </a>
          ))}
          {(user?.documents || []).length === 0 && <p className="text-sm text-slate-500">No documents available.</p>}
        </div>
      </section>
    </div>
  );
};

export default Profile;
