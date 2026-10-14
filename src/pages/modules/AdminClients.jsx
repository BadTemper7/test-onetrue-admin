import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "../../components/Alert"
import ModalCloseButton from "../../components/ui/ModalCloseButton";
import { api, getApiError, resolveFileUrl } from "../../lib/api";
import Pagination from "../../components/ui/Pagination";
import TableCrudActions from "../../components/ui/TableCrudActions";
import WorkflowDecisionPanel from "../../components/ui/WorkflowDecisionPanel";
import { useClickOutside } from "../../hooks/useClickOutside";
import TableLoadingRow from "../../components/ui/TableLoadingRow"

const statusClass = (status) => {
  if (status === "verified" || status === "active") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "pending" || status === "resubmitted") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
};

const isVerifiedStatus = (status) =>
  status === "verified" || status === "active";
const isPendingStatus = (status) =>
  status === "pending" || status === "resubmitted";
const isRejectedStatus = (status) => status === "rejected";

const filterOptions = [
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
];

const AdminClients = () => {
  const [clients, setClients] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef(null);
  const [selectedFilters, setSelectedFilters] = useState([
    "pending",
    "verified",
    "rejected",
  ]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [clientMeta, setClientMeta] = useState({ total: 0, totalPages: 1 });
  const clientRequestRef = useRef(null);


  useClickOutside(filterRef, () => setShowFilters(false), showFilters);
  const totals = useMemo(() => {
    return {
      verified: clients.filter((client) => isVerifiedStatus(client.status))
        .length,
      pending: clients.filter((client) => isPendingStatus(client.status))
        .length,
      rejected: clients.filter((client) => isRejectedStatus(client.status))
        .length,
    };
  }, [clients]);

  const filteredClients = clients;
  const clientPagination = {
    page: clientPage,
    setPage: setClientPage,
    pageSize: clientPageSize,
    setPageSize: (value) => { setClientPageSize(Number(value)); setClientPage(1); },
    totalItems: clientMeta.total,
    totalPages: Math.max(clientMeta.totalPages || 1, 1),
    startItem: clientMeta.total ? ((clientPage - 1) * clientPageSize) + 1 : 0,
    endItem: Math.min(clientPage * clientPageSize, clientMeta.total || 0),
    pageSizeOptions: [10, 25, 50, 100],
    paginatedItems: clients,
  };

  const loadClients = async () => {
    clientRequestRef.current?.abort();
    const controller = new AbortController();
    clientRequestRef.current = controller;
    try {
      setListLoading(true);
      const statuses = [];
      if (selectedFilters.includes("pending")) statuses.push("pending", "resubmitted");
      if (selectedFilters.includes("verified")) statuses.push("verified", "active");
      if (selectedFilters.includes("rejected")) statuses.push("rejected");
      const { data } = await api.get("/admin/client-registrations", {
        params: { page: clientPage, limit: clientPageSize, search: searchTerm.trim(), status: statuses.length ? statuses.join(",") : "__none__" },
        signal: controller.signal,
      });
      setClients(data.users || []);
      setClientMeta(data.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      if (err?.code !== "ERR_CANCELED") setError(getApiError(err));
    } finally {
      if (clientRequestRef.current === controller) setListLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadClients, 250);
    return () => clearTimeout(timer);
  }, [clientPage, clientPageSize, searchTerm, selectedFilters]);

  useEffect(() => { setClientPage(1); }, [searchTerm, selectedFilters]);

  const toggleFilter = (value) => {
    setSelectedFilters((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const verifyClient = async (id) => {
    setError("");
    setMessage("");
    setActionLoading(true);

    try {
      const { data } = await api.patch(`/admin/clients/${id}/approve`);
      setMessage(data.message);
      setSelectedClient(null);
      await loadClients();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const rejectClient = async (id) => {
    setError("");
    setMessage("");

    const reason = rejectReasons[id] || "";

    if (!reason.trim()) {
      setError("Please add a rejection reason before rejecting the client.");
      return;
    }

    try {
      setActionLoading(true);
      const { data } = await api.patch(`/admin/clients/${id}/reject`, {
        reason,
      });
      setMessage(data.message);
      setRejectReasons((prev) => ({ ...prev, [id]: "" }));
      setSelectedClient(null);
      await loadClients();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };


  const openClientDetails = (client) => {
    setSelectedClient(client);
    setIsEditingClient(false);
    setClientForm({
      name: client.name || "",
      email: client.email || "",
      companyName: client.companyName || "",
      companyAddress: client.companyAddress || "",
      companyType: client.companyType || "",
      companyTypeOther: client.companyTypeOther || "",
      phoneNumber: client.phoneNumber || "",
      representativeFirstName: client.representativeFirstName || "",
      representativeMiddleName: client.representativeMiddleName || "",
      representativeLastName: client.representativeLastName || "",
      representativePosition: client.representativePosition || "",
    });
  };

  const openClientEdit = (client) => {
    openClientDetails(client);
    setIsEditingClient(true);
  };

  const saveClient = async () => {
    if (!selectedClient || !clientForm) return;
    setActionLoading(true);
    setError("");
    try {
      const editableClientFields = { ...clientForm };
      delete editableClientFields.status;
      const { data } = await api.patch(`/admin/clients/${selectedClient.id}`, editableClientFields);
      setSelectedClient(data.user);
      setClientForm((current) => ({ ...current, ...data.user }));
      setIsEditingClient(false);
      setMessage(data.message || "Client updated successfully.");
      await loadClients();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const deleteClient = async (clientOverride = selectedClient) => {
    const clientToDelete = clientOverride;
    if (!clientToDelete || !window.confirm(`Delete ${clientToDelete.companyName || clientToDelete.name}? This action cannot be undone.`)) return;
    setActionLoading(true);
    setError("");
    try {
      const { data } = await api.delete(`/admin/clients/${clientToDelete.id}`);
      if (selectedClient?.id === clientToDelete.id) {
        setSelectedClient(null);
        setClientForm(null);
      }
      setMessage(data.message || "Client deleted successfully.");
      await loadClients();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-emerald-700">
              Account Flow
            </div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Client Verification
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              After email OTP registration, client accounts stay pending
              verification until admin reviews the company information and
              uploaded documents.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="text-xs font-black uppercase tracking-wide text-blue-600">
              Total Verified
            </div>
            <div className="mt-2 text-3xl font-black text-blue-700">
              {totals.verified}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <div className="text-xs font-black uppercase tracking-wide text-amber-600">
              Total Pending
            </div>
            <div className="mt-2 text-3xl font-black text-amber-700">
              {totals.pending}
            </div>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <div className="text-xs font-black uppercase tracking-wide text-red-600">
              Total Rejected
            </div>
            <div className="mt-2 text-3xl font-black text-red-700">
              {totals.rejected}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Alert type="success">{message}</Alert>
          <Alert type="error">{error}</Alert>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              Client Registrations
            </h3>
            <p className="text-sm font-semibold text-slate-500">
              Search and filter client accounts before opening the account
              details.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                type="text"
                className="input w-full !rounded-2xl !py-3 !pl-10 !pr-4 text-sm sm:w-[320px]"
                placeholder="Search company, email, name..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />

              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m21 21-4.35-4.35" />
                <circle cx="11" cy="11" r="8" />
              </svg>
            </div>

            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 5h18" />
                  <path d="M6 12h12" />
                  <path d="M10 19h4" />
                </svg>
                Filter
                <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs text-white">
                  {selectedFilters.length}
                </span>
              </button>

              {showFilters && (
                <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Status Filter
                    </div>

                    <button
                      type="button"
                      className="text-xs font-black text-emerald-700"
                      onClick={() =>
                        setSelectedFilters(["pending", "verified", "rejected"])
                      }
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-3">
                    {filterOptions.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFilters.includes(option.value)}
                          onChange={() => toggleFilter(option.value)}
                          className="h-4 w-4 accent-slate-950"
                        />
                        <span className="text-sm font-bold text-slate-700">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
          Showing {clientPagination.startItem}-{clientPagination.endItem} of {clientPagination.totalItems} client
          registrations
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Representative</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {listLoading && clients.length === 0 && <TableLoadingRow colSpan={6} rows={6} actionColumn label="Loading client registrations" />}
              {clientPagination.paginatedItems.map((client) => (
                <tr key={client.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="font-black text-slate-950">
                      {client.companyName}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {client.companyAddress}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {client.companyType}
                      {client.companyTypeOther
                        ? `, ${client.companyTypeOther}`
                        : ""}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-700">
                      {client.name}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {client.representativePosition}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-600">
                      {client.email}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {client.phoneNumber}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex max-w-[240px] flex-wrap gap-2">
                      {(client.documents || []).length > 0 ? (
                        client.documents.map((doc) => (
                          <a
                            key={doc.publicId}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                            href={resolveFileUrl(doc.secureUrl || doc.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {doc.label}
                          </a>
                        ))
                      ) : (
                        <span className="text-xs font-bold text-slate-400">
                          No documents
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusClass(
                        client.status,
                      )}`}
                    >
                      {client.status}
                    </span>

                    {client.rejectionReason && (
                      <div className="mt-2 max-w-[220px] text-xs font-semibold leading-5 text-red-600">
                        Reason: {client.rejectionReason}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4 text-right">
                    <TableCrudActions
                      recordLabel={client.companyName || client.name || client.email || "client"}
                      onView={() => openClientDetails(client)}
                      onEdit={() => openClientEdit(client)}
                      onDelete={() => deleteClient(client)}
                      deleting={actionLoading && selectedClient?.id === client.id}
                    />
                  </td>
                </tr>
              ))}

              {!listLoading && filteredClients.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-10 text-center font-bold text-slate-500"
                  >
                    No client registrations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination {...clientPagination} />
      </div>

      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-emerald-700">
                  Account Review
                </div>
                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  {selectedClient.companyName}
                </h3>
                <div className="mt-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusClass(
                      selectedClient.status,
                    )}`}
                  >
                    {selectedClient.status}
                  </span>
                </div>
              </div>

              <ModalCloseButton onClick={() => setSelectedClient(null)} label="Close client details" />
            </div>

            {isEditingClient && clientForm && (
              <div className="border-b border-slate-200 bg-blue-50/50 p-5">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Company Name", "companyName"], ["Company Address", "companyAddress"], ["Company Type", "companyType"],
                    ["Other Company Type", "companyTypeOther"], ["Representative First Name", "representativeFirstName"],
                    ["Representative Middle Name", "representativeMiddleName"], ["Representative Last Name", "representativeLastName"],
                    ["Representative Position", "representativePosition"], ["Phone Number", "phoneNumber"], ["Email", "email"],
                  ].map(([label, field]) => (
                    <label key={field} className={field === "companyAddress" ? "lg:col-span-2" : ""}>
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
                      <input className="input bg-white" type={field === "email" ? "email" : "text"} value={clientForm[field] || ""} onChange={(event) => setClientForm((current) => ({ ...current, [field]: event.target.value, ...(field === "representativeFirstName" || field === "representativeMiddleName" || field === "representativeLastName" ? { name: [field === "representativeFirstName" ? event.target.value : current.representativeFirstName, field === "representativeMiddleName" ? event.target.value : current.representativeMiddleName, field === "representativeLastName" ? event.target.value : current.representativeLastName].filter(Boolean).join(" ") } : {}) }))} />
                    </label>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
                  Account approval and rejection are intentionally managed only from the View modal. Editing updates profile information without changing verification status.
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button type="button" className="btn-secondary" onClick={() => setIsEditingClient(false)} disabled={actionLoading}>Cancel</button>
                  <button type="button" className="btn-primary" onClick={saveClient} disabled={actionLoading}>{actionLoading ? "Saving..." : "Save Client Changes"}</button>
                </div>
              </div>
            )}

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-black uppercase tracking-wide text-slate-500">
                  Company Information
                </h4>

                <div className="mt-4 space-y-3">
                  <Detail
                    label="Company Name"
                    value={selectedClient.companyName}
                  />
                  <Detail
                    label="Company Address"
                    value={selectedClient.companyAddress}
                  />
                  <Detail
                    label="Company Type"
                    value={`${selectedClient.companyType || ""}${
                      selectedClient.companyTypeOther
                        ? `, ${selectedClient.companyTypeOther}`
                        : ""
                    }`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <h4 className="text-sm font-black uppercase tracking-wide text-slate-500">
                  Representative Information
                </h4>

                <div className="mt-4 space-y-3">
                  <Detail
                    label="Representative Name"
                    value={selectedClient.name}
                  />
                  <Detail
                    label="Position"
                    value={selectedClient.representativePosition}
                  />
                  <Detail label="Email" value={selectedClient.email} />
                  <Detail
                    label="Phone Number"
                    value={selectedClient.phoneNumber}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 lg:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wide text-slate-500">
                      Legal Consent Record
                    </h4>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Registration consent is recorded by the backend and cannot be replaced by the admin review action.
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${selectedClient.legalConsent?.termsAccepted && selectedClient.legalConsent?.privacyAccepted && selectedClient.legalConsent?.representativeAuthorityConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {selectedClient.legalConsent?.termsAccepted && selectedClient.legalConsent?.privacyAccepted && selectedClient.legalConsent?.representativeAuthorityConfirmed ? "Complete" : "Legacy / Incomplete"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="Terms Accepted" value={selectedClient.legalConsent?.termsAccepted ? "Yes" : "No"} />
                  <Detail label="Privacy Accepted" value={selectedClient.legalConsent?.privacyAccepted ? "Yes" : "No"} />
                  <Detail label="Authority Confirmed" value={selectedClient.legalConsent?.representativeAuthorityConfirmed ? "Yes" : "No"} />
                  <Detail
                    label="Accepted At"
                    value={selectedClient.legalConsent?.acceptedAt ? new Date(selectedClient.legalConsent.acceptedAt).toLocaleString() : "N/A"}
                  />
                  <Detail label="Terms Version" value={selectedClient.legalConsent?.termsVersion} />
                  <Detail label="Privacy Version" value={selectedClient.legalConsent?.privacyPolicyVersion} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 lg:col-span-2">
                <h4 className="text-sm font-black uppercase tracking-wide text-slate-500">
                  Uploaded Documents
                </h4>

                <div className="mt-4 flex flex-wrap gap-3">
                  {(selectedClient.documents || []).length > 0 ? (
                    selectedClient.documents.map((doc) => (
                      <a
                        key={doc.publicId}
                        href={resolveFileUrl(doc.secureUrl || doc.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                      >
                        View {doc.label}
                      </a>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                      No documents uploaded.
                    </div>
                  )}
                </div>
              </div>

              {selectedClient.rejectionReason && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-5 lg:col-span-2">
                  <h4 className="text-sm font-black uppercase tracking-wide text-red-600">
                    Previous Rejection Reason
                  </h4>
                  <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                    {selectedClient.rejectionReason}
                  </p>
                </div>
              )}

              {!isEditingClient && (
                <WorkflowDecisionPanel
                  className="lg:col-span-2"
                  eyebrow="Client Verification"
                  title="Admin Decision"
                  description="Review the company, representative, consent, and uploaded documents before verifying or rejecting this account."
                  approveLabel="Verify Account"
                  onApprove={() => verifyClient(selectedClient.id)}
                  approveDisabled={actionLoading || isVerifiedStatus(selectedClient.status)}
                  rejectLabel="Reject Account"
                  rejectReason={rejectReasons[selectedClient.id] || ""}
                  onRejectReasonChange={(value) => setRejectReasons((prev) => ({ ...prev, [selectedClient.id]: value }))}
                  rejectPlaceholder="Explain why this client account is being rejected"
                  rejectFieldDisabled={isVerifiedStatus(selectedClient.status)}
                  onReject={() => rejectClient(selectedClient.id)}
                  rejectDisabled={actionLoading || isVerifiedStatus(selectedClient.status) || !(rejectReasons[selectedClient.id] || "").trim()}
                  note={isVerifiedStatus(selectedClient.status)
                    ? "This account is already verified or active. Decision actions are disabled."
                    : "Approval and rejection are available only in this View modal. Editing client information does not change the verification decision."}
                >
                  <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                    <div><span className="font-black text-slate-500">Current Status:</span> <span className="capitalize">{selectedClient.status}</span></div>
                    <div><span className="font-black text-slate-500">Documents:</span> {(selectedClient.documents || []).length}</div>
                    <div><span className="font-black text-slate-500">Consent:</span> {selectedClient.legalConsent?.termsAccepted && selectedClient.legalConsent?.privacyAccepted && selectedClient.legalConsent?.representativeAuthorityConfirmed ? "Complete" : "Incomplete"}</div>
                  </div>
                </WorkflowDecisionPanel>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Detail = ({ label, value }) => {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-slate-800">
        {value || "N/A"}
      </div>
    </div>
  );
};

export default AdminClients;
