import React from "react";
import LegalPageLayout from "../components/legal/LegalPageLayout";
import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from "../constants/legal";

const Section = ({ number, title, children }) => (
  <section className="mb-9 scroll-mt-24">
    <h2 className="text-xl font-bold text-slate-900">{number}. {title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">{children}</div>
  </section>
);

const PrivacyPolicy = () => (
  <LegalPageLayout
    type="privacy"
    title="Privacy Policy"
    intro="This Privacy Policy explains how One True Logistics Inc. collects, uses, stores, shares, protects, and disposes of personal data processed through its client portal and related logistics services."
    effectiveDate={LEGAL_EFFECTIVE_DATE}
  >
    <div className="mb-9 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
      By registering, you acknowledge this Policy and consent to the processing of personal data and uploaded documents for account verification and logistics transactions, without limiting other lawful grounds for processing under Philippine law.
    </div>

    <Section number="1" title="Who controls your data">
      <p>One True Logistics Inc. acts as the personal information controller for personal data collected through the client portal. A registered company is responsible for ensuring that its representative and third-party information is submitted lawfully and with any required authority or notice.</p>
    </Section>

    <Section number="2" title="Personal data we collect">
      <ul className="list-disc space-y-2 pl-5">
        <li>Company and representative information, including names, position, address, email, and phone number.</li>
        <li>Identity, business, tax, authorization, and supporting documents uploaded for verification.</li>
        <li>Account credentials, email verification status, consent records, and security events.</li>
        <li>Booking, shipment, container, vehicle, driver, consignee, shipper, pre-advice, gate, yard, and inventory information.</li>
        <li>Rates, invoices, payment methods, transaction references, and proof of payment.</li>
        <li>Messages, support requests, notices, and other communications.</li>
        <li>Technical information such as IP address, browser or device information, timestamps, access logs, and system activity.</li>
      </ul>
    </Section>

    <Section number="3" title="How we collect data">
      <p>We collect information directly from you or your company, through uploaded documents and portal activity, from authorized personnel, and from logistics, payment, regulatory, or operational partners involved in a transaction.</p>
    </Section>

    <Section number="4" title="Purposes of processing">
      <ul className="list-disc space-y-2 pl-5">
        <li>Register, verify, administer, and secure client accounts.</li>
        <li>Review company documents and representative authority.</li>
        <li>Process bookings, pre-advice, gate activity, yard operations, billing, and payment verification.</li>
        <li>Communicate OTPs, status updates, approvals, rejections, invoices, and service notices.</li>
        <li>Prevent fraud, misuse, security threats, and unlawful activity.</li>
        <li>Maintain records, resolve disputes, enforce agreements, and comply with legal or regulatory obligations.</li>
        <li>Improve reliability, capacity, usability, and support of the portal and services.</li>
      </ul>
    </Section>

    <Section number="5" title="Lawful grounds">
      <p>Depending on the data and activity, processing may be based on consent, steps taken at your request before entering a contract, performance of a contract, compliance with legal obligations, protection of lawful rights and interests, or other grounds allowed by the Data Privacy Act of 2012 and its implementing rules.</p>
      <p>You may withdraw consent where processing relies solely on consent. Withdrawal does not affect prior lawful processing and may prevent account verification or services that require the relevant information.</p>
    </Section>

    <Section number="6" title="Storage of uploaded documents">
      <p>New client documents are stored on the application server in a folder assigned to the client’s unique database ID. The folder name is not the client’s personal or company name. Portal records store the corresponding document location and metadata.</p>
      <p>Documents are not intended to be publicly indexed. Access should be limited through application permissions and server controls. You should not share document links or account credentials with unauthorized persons.</p>
    </Section>

    <Section number="7" title="Sharing and disclosure">
      <p>We may disclose data only as reasonably necessary to authorized employees, contractors, hosting and technology providers, email providers, payment or banking partners, logistics providers, terminals, carriers, depots, truckers, professional advisers, insurers, auditors, regulators, courts, law enforcement, and other parties involved in the requested service or required by law.</p>
      <p>We do not sell personal data. Service providers are expected to process data only for authorized purposes and under appropriate confidentiality and security obligations.</p>
    </Section>

    <Section number="8" title="Cross-border processing">
      <p>Some infrastructure or service providers may process information in another country. Where cross-border processing occurs, One True Logistics Inc. will use reasonable contractual, organizational, and technical safeguards consistent with applicable Philippine requirements.</p>
    </Section>

    <Section number="9" title="Retention and deletion">
      <p>Data is retained only for as long as necessary for account administration, service completion, billing, dispute handling, security, audit, legal, tax, regulatory, and legitimate business requirements. Different record types may have different retention periods.</p>
      <p>After the applicable period, records may be securely deleted, anonymized, archived, or retained when required by law or necessary to establish, exercise, or defend legal claims.</p>
    </Section>

    <Section number="10" title="Security safeguards">
      <p>We use reasonable organizational, physical, and technical measures such as access controls, password hashing, OTP verification, role-based permissions, logging, restricted storage, and secure hosting configurations. No internet or storage system can be guaranteed completely secure.</p>
      <p>You must keep credentials confidential, use a secure device, and promptly report suspected unauthorized access or disclosure.</p>
    </Section>

    <Section number="11" title="Your data privacy rights">
      <p>Subject to applicable conditions and exceptions, you may have the right to be informed, access your data, object to processing, correct inaccurate data, request erasure or blocking, obtain data portability, file a complaint, and claim damages for violations of your rights.</p>
      <p>We may verify your identity and authority before acting on a request. A company representative requesting another person’s data must show proper authority.</p>
    </Section>

    <Section number="12" title="Automated decisions">
      <p>The portal may use programmed rules for validation, status display, permissions, rate selection, and workflow routing. Material account approval, rejection, billing verification, and operational decisions may also involve authorized personnel.</p>
    </Section>

    <Section number="13" title="Cookies and logs">
      <p>The portal may use essential browser storage, tokens, cookies, and logs needed for authentication, security, session continuity, preferences, troubleshooting, and system performance. Disabling essential storage may prevent the portal from functioning correctly.</p>
    </Section>

    <Section number="14" title="Data about other people">
      <p>Before providing personal data about drivers, employees, consignees, shippers, representatives, or other individuals, you must have lawful authority and provide any notice or obtain any consent required by law.</p>
    </Section>

    <Section number="15" title="Children">
      <p>The client portal is intended for authorized adult business representatives and is not directed to children. Do not create an account or submit a child’s personal data unless it is legally necessary for a transaction and properly authorized.</p>
    </Section>

    <Section number="16" title="Privacy incidents">
      <p>Suspected loss, unauthorized disclosure, or compromise of personal data should be reported immediately. We will assess and respond to incidents and provide notifications when required by applicable law.</p>
    </Section>

    <Section number="17" title="Policy updates">
      <p>This Policy may be updated to reflect legal, operational, or technology changes. The revised version and effective date will be posted in the portal. Material changes may require renewed acknowledgment or consent.</p>
    </Section>

    <Section number="18" title="Contact and complaints">
      <p>Privacy questions, requests, or incident reports may be sent to <a className="font-semibold text-emerald-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. You may also raise a complaint with the National Privacy Commission when applicable.</p>
    </Section>
  </LegalPageLayout>
);

export default PrivacyPolicy;
