import React from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiFileText, FiShield } from "react-icons/fi";
import logo from "../../assets/logo.png";
import Footer from "../layout/Footer";

const LegalPageLayout = ({ type, title, intro, effectiveDate, children }) => {
  const Icon = type === "privacy" ? FiShield : FiFileText;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/login" className="flex items-center gap-3">
            <img src={logo} alt="One True Logistics" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-bold text-slate-900">One True Logistics Inc.</p>
              <p className="text-xs text-slate-500">Client Portal</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <FiArrowLeft className="h-4 w-4" />
              Sign in
            </Link>
            <Link
              to="/register"
              className="hidden rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:inline-flex"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 px-6 py-10 text-white sm:px-10">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Icon className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">{intro}</p>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
              Effective date: {effectiveDate}
            </p>
          </div>

          <article className="legal-document px-6 py-8 sm:px-10 sm:py-10">
            {children}
          </article>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default LegalPageLayout;
