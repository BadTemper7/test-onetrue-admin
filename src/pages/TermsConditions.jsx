import React from "react";
import LegalPageLayout from "../components/legal/LegalPageLayout";
import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from "../constants/legal";

const Section = ({ number, title, children }) => (
  <section className="mb-9 scroll-mt-24">
    <h2 className="text-xl font-bold text-slate-900">{number}. {title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">{children}</div>
  </section>
);

const TermsConditions = () => (
  <LegalPageLayout
    type="terms"
    title="Terms and Conditions"
    intro="These Terms govern access to and use of the One True Logistics Inc. client portal, including account registration, document submission, bookings, rates, billing, payments, and related logistics services."
    effectiveDate={LEGAL_EFFECTIVE_DATE}
  >
    <div className="mb-9 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
      By creating an account, selecting the required agreement boxes, or using the portal, you confirm that you have read, understood, and agreed to these Terms and that you are authorized to act for the company you register.
    </div>

    <Section number="1" title="Acceptance and authority">
      <p>You must accept these Terms before registering. If you register for a company, you represent that you are at least 18 years old, have legal capacity, and are authorized to bind that company to these Terms.</p>
      <p>You are responsible for ensuring that all submitted company, representative, shipment, payment, and document information is accurate, complete, current, and lawfully provided.</p>
    </Section>

    <Section number="2" title="Account registration and security">
      <p>You must provide a valid email address, complete email verification, and protect your password and one-time passcodes. You are responsible for activity performed through your account unless you promptly report unauthorized access.</p>
      <p>One True Logistics Inc. may request additional verification, reject incomplete or inconsistent registrations, suspend access, or require documents to be resubmitted.</p>
    </Section>

    <Section number="3" title="Portal services">
      <p>The portal may support client onboarding, booking requests, pre-advice, container and shipment records, document uploads, rate information, billing, payment submission, status tracking, and communications.</p>
      <p>Portal availability or a displayed status does not by itself guarantee acceptance, equipment availability, vessel schedules, gate access, release, delivery time, or completion of a logistics service. A booking is subject to operational confirmation and applicable commercial arrangements.</p>
    </Section>

    <Section number="4" title="Documents and electronic records">
      <p>You authorize the electronic submission, storage, review, and use of documents needed to process your registration and transactions. You must not upload forged, altered, misleading, unlawful, malicious, or third-party documents that you are not authorized to provide.</p>
      <p>Electronic records, timestamps, OTP verification, account activity, and consent logs may be used as evidence of portal transactions, subject to applicable law.</p>
    </Section>

    <Section number="5" title="Rates, charges, taxes, and quotations">
      <p>Local and International rates may differ. Displayed rates may be estimates, standard schedules, or configuration references and may exclude taxes, government charges, demurrage, detention, storage, penalties, extraordinary handling, third-party charges, or services outside the stated scope.</p>
      <p>The final amount due is based on the applicable confirmed rate, actual service, supporting records, approved adjustments, and legally required taxes or charges. In case of a clear portal display error, One True Logistics Inc. may correct the rate before final settlement.</p>
    </Section>

    <Section number="6" title="Payments and verification">
      <p>You must use an approved payment method and submit complete and authentic proof of payment. A submission is not considered paid until the payment is received, matched, and verified.</p>
      <p>You remain responsible for bank fees, failed transfers, duplicate or incorrect payments, chargebacks, and amounts not received by One True Logistics Inc.</p>
    </Section>

    <Section number="7" title="Client responsibilities">
      <ul className="list-disc space-y-2 pl-5">
        <li>Comply with customs, port, transport, safety, environmental, trade, and other applicable requirements.</li>
        <li>Provide correct cargo, container, consignee, shipper, vehicle, driver, and regulatory information.</li>
        <li>Obtain required permits, approvals, authorizations, and consents.</li>
        <li>Review booking details, rates, invoices, and status notices promptly.</li>
        <li>Notify One True Logistics Inc. of errors, security incidents, or unauthorized activity without delay.</li>
      </ul>
    </Section>

    <Section number="8" title="Prohibited activities">
      <p>You may not use the portal to violate law, misrepresent identity or authority, submit false records, interfere with systems, bypass security, introduce malware, scrape or overload services, access another user’s data, or facilitate prohibited cargo or transactions.</p>
    </Section>

    <Section number="9" title="Operational events and third parties">
      <p>Logistics operations may depend on ports, terminals, carriers, truckers, depots, customs authorities, banks, internet providers, hosting providers, and other third parties. Delays or interruptions may result from weather, congestion, equipment failure, government action, labor disruption, force majeure, cyber incidents, or events outside reasonable control.</p>
    </Section>

    <Section number="10" title="Data privacy">
      <p>Personal data is processed in accordance with the Privacy Policy and applicable Philippine data protection requirements. The Privacy Policy forms part of these Terms.</p>
    </Section>

    <Section number="11" title="Intellectual property">
      <p>The portal, software, design, branding, text, and system content are owned by or licensed to One True Logistics Inc. You receive a limited, non-transferable right to use the portal for authorized business transactions only.</p>
    </Section>

    <Section number="12" title="Service disclaimer">
      <p>The portal is provided on an “as available” basis. To the fullest extent permitted by law, One True Logistics Inc. does not warrant uninterrupted availability, error-free operation, permanent preservation of every uploaded file, or that all third-party information is complete or current.</p>
      <p>Nothing in these Terms excludes warranties, duties, or remedies that cannot legally be excluded.</p>
    </Section>

    <Section number="13" title="Limitation of liability">
      <p>To the fullest extent permitted by law, One True Logistics Inc. will not be liable for indirect, incidental, special, exemplary, punitive, or consequential loss, including loss of profit, opportunity, data, goodwill, or business interruption arising from portal use.</p>
      <p>Any liability that cannot be excluded will be limited only to the extent permitted by applicable law and the governing service agreement. This section does not limit liability for fraud, willful misconduct, gross negligence, or any liability that law does not allow to be limited.</p>
    </Section>

    <Section number="14" title="Indemnity">
      <p>To the extent permitted by law, you and the registered company agree to defend, indemnify, and hold One True Logistics Inc. harmless from third-party claims, losses, penalties, and reasonable costs caused by your unlawful use, false information, unauthorized documents, breach of these Terms, or violation of another person’s rights.</p>
    </Section>

    <Section number="15" title="Suspension and termination">
      <p>Access may be restricted or terminated for security reasons, suspected fraud, non-payment, legal or regulatory requirements, prohibited activity, inaccurate registration information, or material breach. Obligations relating to payment, liability, records, confidentiality, and dispute resolution survive termination when applicable.</p>
    </Section>

    <Section number="16" title="Changes to the portal and Terms">
      <p>One True Logistics Inc. may update portal functions and these Terms. Material updates will be posted with a revised effective date and may require renewed acceptance. Continued use after an update takes effect constitutes acceptance where permitted by law.</p>
    </Section>

    <Section number="17" title="Governing law and disputes">
      <p>These Terms are governed by the laws of the Republic of the Philippines. The parties should first attempt to resolve disputes through good-faith written discussion. If unresolved, disputes may be brought before the courts with proper jurisdiction over the principal office of One True Logistics Inc., unless mandatory law requires another venue or process.</p>
    </Section>

    <Section number="18" title="General provisions">
      <p>If a provision is invalid or unenforceable, the remaining provisions remain effective. Failure to enforce a provision is not a waiver. These Terms, the Privacy Policy, confirmed bookings, invoices, and applicable written service agreements form the agreement governing portal use. A specific signed agreement controls if it expressly conflicts with these general Terms.</p>
    </Section>

    <Section number="19" title="Contact">
      <p>Questions about these Terms may be sent to <a className="font-semibold text-emerald-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>
    </Section>
  </LegalPageLayout>
);

export default TermsConditions;
