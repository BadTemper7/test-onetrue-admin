import React from "react";
import { Link } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";
import AuthShell from "../components/AuthShell";

// Automated password-reset emails are intentionally disabled on the backend.
// Keep this URL useful rather than displaying an OTP form that always fails.
const ForgotPassword = () => (
  <AuthShell
    eyebrow="Account assistance"
    title="Password recovery"
    subtitle="For security, password recovery is handled by the OTLI support team."
  >
    <div className="card space-y-5 p-6">
      <div className="flex items-start gap-3 text-slate-700">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-sm leading-6">Please contact OTLI support to verify account ownership and request a password reset. No automated password-reset email will be sent.</p>
      </div>
      <a className="flex items-center gap-2 text-emerald-700 underline underline-offset-4" href="mailto:otli@onetrue.ph">
        <Mail size={18} /> otli@onetrue.ph
      </a>
      <Link className="btn-primary inline-flex w-full items-center justify-center" to="/login">Back to login</Link>
    </div>
  </AuthShell>
);

export default ForgotPassword;
