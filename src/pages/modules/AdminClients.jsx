import { TableToolbar, TableSearchField, TableStatusTabs } from "../../components/table/TableToolbar";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  Clock3,
  FileText,
  MoreVertical,
  Paperclip,
  Plus,
  ShieldX,
  UserRoundSearch,
  Building2,
  Mail,
  Phone,
 } from "lucide-react";
import Alert from "../../components/Alert";
import ModalCloseButton from "../../components/ui/ModalCloseButton";
import { api, getApiError, resolveFileUrl } from "../../lib/api";
import Pagination from "../../components/table/Pagination";
import TableLoadingRow from "../../components/table/TableLoadingRow";
import WorkflowDecisionPanel from "../../components/ui/WorkflowDecisionPanel";
import TableCrudActions from "../../components/table/TableCrudActions";
import { useAuthStore } from "../../stores/authStore";
import { hasModulePermission } from "../../lib/permissions";

const card =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-16px_rgba(15,23,42,0.14)]";

const statusStyle = (status) => {
  if (["verified", "active"].includes(status))
    return { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  if (["pending", "resubmitted"].includes(status))
    return { pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" };
  if (status === "rejected")
    return { pill: "bg-red-50 text-red-700", dot: "bg-red-500" };
  return { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
};

const StatusPill = ({ status }) => {
  const style = statusStyle(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
};

const isVerifiedStatus = (status) =>
  status === "verified" || status === "active";
const manualVerificationRequired = (client) =>
  ["admin", "manual_review"].includes(client?.registrationMethod);
const hasCompleteConsent = (client) =>
  Boolean(
    client?.legalConsent?.termsAccepted &&
    client?.legalConsent?.privacyAccepted &&
    client?.legalConsent?.representativeAuthorityConfirmed,
  );

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

// Names saved in ALL CAPS read as shouting on the card; show them in title case.
const displayName = (name = "") =>
  name && name === name.toUpperCase() ? name.toLowerCase() : name;

const ALL_STATUSES = "all";
const filterOptions = [
  { label: "All", value: ALL_STATUSES },
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
];

const emptyNewClient = () => ({
  companyName: "",
  companyAddress: "",
  companyType: "",
  companyTypeOther: "",
  phoneNumber: "",
  representativeFirstName: "",
  representativeMiddleName: "",
  representativeLastName: "",
  representativePosition: "",
  email: "",
  password: "",
  confirmPassword: "",
});

const clientDocumentFields = [
  ["Business Permit", "businessPermit"],
  ["BIR Certificate", "birCertificate"],
  ["Valid ID", "validId"],
  ["Authorization Letter", "authorizationLetter"],
  ["Other Document", "otherDocument"],
];
const requiredDocuments = ["businessPermit", "birCertificate", "validId"];
const optionalFields = ["companyTypeOther", "representativeMiddleName"];

const newClientGroups = [
  {
    title: "Company",
    fields: [
      ["Company name", "companyName"],
      ["Company address", "companyAddress", "md:col-span-2"],
      ["Company type", "companyType"],
      ["Other company type", "companyTypeOther"],
    ],
  },
  {
    title: "Representative",
    fields: [
      ["First name", "representativeFirstName"],
      ["Middle name", "representativeMiddleName"],
      ["Last name", "representativeLastName"],
      ["Position", "representativePosition"],
      ["Phone number", "phoneNumber"],
    ],
  },
  {
    title: "Login account",
    fields: [
      ["Client login email", "email", "md:col-span-2"],
      ["Initial password", "password"],
      ["Confirm initial password", "confirmPassword"],
    ],
  },
];

const editFields = [
  ["Company name", "companyName"],
  ["Company address", "companyAddress", "lg:col-span-2"],
  ["Company type", "companyType"],
  ["Other company type", "companyTypeOther"],
  ["First name", "representativeFirstName"],
  ["Middle name", "representativeMiddleName"],
  ["Last name", "representativeLastName"],
  ["Position", "representativePosition"],
  ["Phone number", "phoneNumber"],
  ["Email", "email"],
];

const Field = ({ label, required, className = "", children }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
      {label}
      {required && <span className="text-red-600"> *</span>}
    </span>
    {children}
  </label>
);

const FileTile = ({ label, required, file, onChange }) => (
  <label className="block cursor-pointer">
    <input
      type="file"
      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
      required={required}
      className="peer sr-only"
      onChange={(event) => onChange(event.target.files?.[0] || null)}
    />
    <div
      className={`flex items-center gap-3 rounded-xl border border-dashed p-3.5 transition peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 ${
        file
          ? "border-emerald-300 bg-emerald-50/60"
          : "border-slate-300 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/40"
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          file
            ? "bg-emerald-100 text-emerald-700"
            : "bg-white text-slate-500 shadow-sm"
        }`}
      >
        {file ? <Check size={17} /> : <Paperclip size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {file ? file.name : "PDF, image or Word file. Click to choose."}
        </span>
      </span>
    </div>
  </label>
);

const Detail = ({ label, value }) => (
  <div>
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">
      {value || "N/A"}
    </dd>
  </div>
);

const InfoCard = ({ title, description, aside, className = "", children }) => (
  <section
    className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold text-yard-navy">{title}</h4>
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {aside}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  loading,
  tone,
  active,
  onClick,
}) => {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${card} group flex w-full flex-col items-center justify-center gap-1 p-3 text-center transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 motion-reduce:hover:translate-y-0 md:flex-row md:items-center md:justify-start md:gap-4 md:p-5 md:text-left ${
        active ? "ring-2 ring-yard-green/40" : ""
      }`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md md:h-12 md:w-12 md:rounded-xl ${tones[tone]}`}
      >
        <Icon size={14} className="md:h-6 md:w-6" />
      </span>
      <span className="flex flex-col items-center md:items-start">
        <span className="block truncate text-[10px] font-medium text-slate-600 sm:text-xs md:text-sm">
          {label}
        </span>
        <span className="block text-sm font-semibold tabular-nums leading-tight tracking-tight text-yard-navy md:text-3xl">
          {loading ? "..." : Number(value || 0).toLocaleString("en-US")}
        </span>
      </span>
    </button>
  );
};

// Keep all row actions available on mobile and desktop, but use one accessible
// portal menu so that a narrow card or scrollable table never clips them.
const ActionMenu = ({ onView, onEdit, onDelete, recordLabel, deleting }) => (
  <TableCrudActions
    compact
    recordLabel={recordLabel}
    onView={onView}
    onEdit={onEdit}
    onDelete={onDelete}
    deleting={deleting}
  />
);

const inputClass = "input w-full bg-white";

const AdminClients = () => {
  const authenticatedUser = useAuthStore((state) => state.user);
  const canAddClients = hasModulePermission(
    authenticatedUser,
    "clientVerification",
    "create",
  );
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState(emptyNewClient);
  const [newClientFiles, setNewClientFiles] = useState({});
  const [newClientError, setNewClientError] = useState("");
  const [clients, setClients] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState(ALL_STATUSES);
  const [selectedClient, setSelectedClient] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [manualVerificationConfirmed, setManualVerificationConfirmed] =
    useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [clientMeta, setClientMeta] = useState({ total: 0, totalPages: 1 });
  const clientRequestRef = useRef(null);

  const [totals, setTotals] = useState({
    verified: 0,
    pending: 0,
    rejected: 0,
  });
  const [totalsLoading, setTotalsLoading] = useState(true);

  const loadClientStats = async () => {
    try {
      const { data } = await api.get("/admin/client-registrations/stats");
      setTotals(data.stats || { verified: 0, pending: 0, rejected: 0 });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setTotalsLoading(false);
    }
  };
  useEffect(() => {
    loadClientStats();
  }, []);

  const clientPagination = {
    page: clientPage,
    setPage: setClientPage,
    pageSize: clientPageSize,
    setPageSize: (value) => {
      setClientPageSize(Number(value));
      setClientPage(1);
    },
    totalItems: clientMeta.total,
    totalPages: Math.max(clientMeta.totalPages || 1, 1),
    startItem: clientMeta.total ? (clientPage - 1) * clientPageSize + 1 : 0,
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

      if (activeFilter === ALL_STATUSES) {
        statuses.push(
          "pending",
          "resubmitted",
          "verified",
          "active",
          "rejected",
        );
      } else if (activeFilter === "pending") {
        statuses.push("pending", "resubmitted");
      } else if (activeFilter === "verified") {
        statuses.push("verified", "active");
      } else if (activeFilter === "rejected") {
        statuses.push("rejected");
      }

      const { data } = await api.get("/admin/client-registrations", {
        params: {
          page: clientPage,
          limit: clientPageSize,
          search: searchTerm.trim(),
          status: statuses.length ? statuses.join(",") : "__none__",
        },
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
  }, [clientPage, clientPageSize, searchTerm, activeFilter]);

  useEffect(() => {
    setClientPage(1);
  }, [searchTerm, activeFilter]);

  useEffect(() => {
    if (!showAddClient && !selectedClient) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || actionLoading) return;
      if (selectedClient) setSelectedClient(null);
      else setShowAddClient(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showAddClient, selectedClient, actionLoading]);

  const focusStatus = (value) => {
    setActiveFilter(value);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setActiveFilter(ALL_STATUSES);
  };

  const submitNewClient = async (event) => {
    event.preventDefault();
    if (!canAddClients || actionLoading) return;
    if (newClient.password !== newClient.confirmPassword) {
      setNewClientError("Initial passwords do not match.");
      return;
    }
    if (newClient.password.length < 8) {
      setNewClientError("Initial password must be at least 8 characters.");
      return;
    }
    for (const field of requiredDocuments) {
      if (!newClientFiles[field]) {
        setNewClientError(
          "Upload the Business Permit, BIR Certificate and Valid ID.",
        );
        return;
      }
    }
    setActionLoading(true);
    setNewClientError("");
    setError("");
    setMessage("");
    try {
      const payload = new FormData();
      for (const [field, value] of Object.entries(newClient)) {
        if (field !== "confirmPassword") payload.append(field, value || "");
      }
      for (const [field, file] of Object.entries(newClientFiles)) {
        if (file) payload.append(field, file);
      }
      const { data } = await api.post("/admin/clients", payload, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setShowAddClient(false);
      setNewClient(emptyNewClient());
      setNewClientFiles({});
      setMessage(data.message || "Client added as pending.");
      setClientPage(1);
      await Promise.all([loadClients(), loadClientStats()]);
    } catch (err) {
      setNewClientError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const verifyClient = async (id) => {
    setError("");
    setMessage("");
    setActionLoading(true);

    try {
      const { data } = await api.patch(
        `/admin/clients/${id}/approve`,
        manualVerificationRequired(selectedClient)
          ? { confirmManualVerification: manualVerificationConfirmed }
          : {},
      );
      setMessage(data.message);
      setSelectedClient(null);
      await Promise.all([loadClients(), loadClientStats()]);
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
      await Promise.all([loadClients(), loadClientStats()]);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const openClientDetails = (client) => {
    setSelectedClient(client);
    setManualVerificationConfirmed(false);
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

  const updateClientField = (field, value) =>
    setClientForm((current) => {
      const next = { ...current, [field]: value };
      if (
        [
          "representativeFirstName",
          "representativeMiddleName",
          "representativeLastName",
        ].includes(field)
      ) {
        next.name = [
          next.representativeFirstName,
          next.representativeMiddleName,
          next.representativeLastName,
        ]
          .filter(Boolean)
          .join(" ");
      }
      return next;
    });

  const saveClient = async () => {
    if (!selectedClient || !clientForm) return;
    setActionLoading(true);
    setError("");
    try {
      const editableClientFields = { ...clientForm };
      delete editableClientFields.status;
      const { data } = await api.patch(
        `/admin/clients/${selectedClient.id}`,
        editableClientFields,
      );
      setSelectedClient(data.user);
      setClientForm((current) => ({ ...current, ...data.user }));
      setIsEditingClient(false);
      setMessage(data.message || "Client updated successfully.");
      await Promise.all([loadClients(), loadClientStats()]);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const deleteClient = async (clientOverride = selectedClient) => {
    const clientToDelete = clientOverride;
    if (
      !clientToDelete ||
      !window.confirm(
        `Delete ${clientToDelete.companyName || clientToDelete.name}? This action cannot be undone.`,
      )
    )
      return;
    setActionLoading(true);
    setError("");
    try {
      const { data } = await api.delete(`/admin/clients/${clientToDelete.id}`);
      if (selectedClient?.id === clientToDelete.id) {
        setSelectedClient(null);
        setClientForm(null);
      }
      setMessage(data.message || "Client deleted successfully.");
      await Promise.all([loadClients(), loadClientStats()]);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const onboardingLabel =
    selectedClient?.registrationMethod === "admin"
      ? "Admin-added"
      : selectedClient?.registrationMethod === "manual_review"
        ? "Manual review (no email OTP)"
        : "Email OTP";

  return (
    <div className="space-y-6 px-4 pb-10 sm:px-6">
      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      {/* Hero + stats */}
      <div>
        <section className="relative overflow-hidden rounded-3xl bg-yard-navy px-6 pb-20 pt-8 text-white md:px-10 md:pt-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Client verification
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-snug text-slate-300 md:text-sm md:leading-relaxed">
                New client accounts stay pending until you review the company
                details and uploaded documents.
              </p>
            </div>
            {canAddClients && (
              <button
                type="button"
                onClick={() => {
                  setNewClient(emptyNewClient());
                  setNewClientFiles({});
                  setNewClientError("");
                  setShowAddClient(true);
                }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-yard-navy shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 lg:mt-0 lg:w-auto lg:py-2.5"
              >
                <Plus size={17} /> Add client
              </button>
            )}
          </div>
        </section>

        <div className="relative z-10 -mt-12 mx-auto grid w-full max-w-7xl grid-cols-3 gap-2 sm:gap-3 md:gap-4 px-4 md:px-8">
          <StatCard
            icon={Clock3}
            tone="amber"
            label="Pending"
            value={totals.pending}
            loading={totalsLoading}
            active={activeFilter === "pending"}
            onClick={() => focusStatus("pending")}
          />
          <StatCard
            icon={BadgeCheck}
            tone="emerald"
            label="Verified"
            value={totals.verified}
            loading={totalsLoading}
            active={activeFilter === "verified"}
            onClick={() => focusStatus("verified")}
          />
          <StatCard
            icon={ShieldX}
            tone="red"
            label="Rejected"
            value={totals.rejected}
            loading={totalsLoading}
            active={activeFilter === "rejected"}
            onClick={() => focusStatus("rejected")}
          />
        </div>
      </div>

      {/* Registrations */}
      <section className={`${card} overflow-hidden`}>
        {/* UPDATED: Made header sticky with solid background and backdrop blur */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100">
          <div className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-yard-navy">
                Client registrations
              </h2>
              <p className="text-sm text-slate-500">
                Showing {clientPagination.startItem}-{clientPagination.endItem}{" "}
                of{" "}
                {Number(clientPagination.totalItems || 0).toLocaleString(
                  "en-US",
                )}
              </p>
            </div>

            <TableToolbar withTabs>
              {/* Search Bar */}
              <TableSearchField
 type="search"
 ariaLabel="Search client registrations"
 placeholder="Search company, email or name"
 value={searchTerm}
 onChange={(event) => setSearchTerm(event.target.value)}
 />

              {/* UPDATED: Horizontal scrolling filter pills with gradient fade mask */}
              <TableStatusTabs
    label="Filter by status"
    value={activeFilter}
    onChange={setActiveFilter}
    options={filterOptions.map((option) => ({
      ...option,
      count: totalsLoading ? "-" : option.value === ALL_STATUSES
        ? (totals.pending || 0) + (totals.verified || 0) + (totals.rejected || 0)
        : (totals[option.value] ?? 0),
    }))}
  />
            </TableToolbar>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* DESKTOP TABLE VIEW */}
          <table
            data-mobile-view="custom"
            className="otli-data-table hidden w-full min-w-[1040px] text-left text-sm md:table"
          >
            <thead className="border-y border-slate-100 bg-slate-50/70 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Representative</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Documents</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">
                  <MoreVertical size={16} className="ml-auto inline-block" />
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {listLoading && clients.length === 0 && (
                <TableLoadingRow
                  colSpan={6}
                  rows={6}
                  actionColumn
                  label="Loading client registrations"
                />
              )}
              {clientPagination.paginatedItems.map((client) => (
                <tr
                  key={client.id}
                  className="align-top transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
                        {initials(client.companyName || client.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {client.companyName}
                        </div>
                        <div className="mt-0.5 max-w-[260px] text-xs text-slate-500">
                          {client.companyAddress}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {client.companyType}
                          {client.companyTypeOther
                            ? `, ${client.companyTypeOther}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-700">
                      {client.name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {client.representativePosition}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="text-slate-600">{client.email}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {client.phoneNumber}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex max-w-[240px] flex-wrap gap-1.5">
                      {(client.documents || []).length > 0 ? (
                        client.documents.map((doc) => (
                          <a
                            key={doc.publicId}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                            href={resolveFileUrl(doc.secureUrl || doc.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FileText size={12} aria-hidden="true" />
                            {doc.label}
                          </a>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">
                          No documents
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <StatusPill status={client.status} />
                    {client.rejectionReason && (
                      <div className="mt-2 max-w-[220px] text-xs leading-5 text-red-600">
                        Reason: {client.rejectionReason}
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <ActionMenu
                      onView={() => openClientDetails(client)}
                      onEdit={() => openClientEdit(client)}
                      onDelete={() => deleteClient(client)}
                      deleting={
                        actionLoading && selectedClient?.id === client.id
                      }
                      recordLabel={
                        client.companyName ||
                        client.name ||
                        client.email ||
                        "client"
                      }
                    />
                  </td>
                </tr>
              ))}

              {!listLoading && clients.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-16 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                      <UserRoundSearch size={22} />
                    </span>
                    <p className="mt-3 font-semibold text-slate-700">
                      No client registrations match
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try a different search or turn on more statuses.
                    </p>
                    <button
                      type="button"
                      className="btn-secondary mt-4"
                      onClick={resetFilters}
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* MOBILE CARD VIEW */}
          <div className="block space-y-4 p-4 md:hidden">
            {listLoading && clients.length === 0 && (
              <div className="p-4 text-center text-slate-500">Loading...</div>
            )}
            {clientPagination.paginatedItems.map((client) => (
              <div
                key={client.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Header: identity + status + actions */}
                <div className="flex items-start gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
                    {initials(client.companyName || client.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="break-words text-[15px] font-semibold leading-5 text-slate-900">
                        {client.companyName}
                      </div>
                      <div className="-my-1.5 -mr-1.5 shrink-0">
                        <ActionMenu
                          onView={() => openClientDetails(client)}
                          onEdit={() => openClientEdit(client)}
                          onDelete={() => deleteClient(client)}
                          deleting={
                            actionLoading && selectedClient?.id === client.id
                          }
                          recordLabel={client.companyName}
                        />
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                        <Building2 size={12} className="shrink-0" />
                        <span className="truncate capitalize">
                          {client.companyType}
                        </span>
                      </div>
                      <StatusPill status={client.status} />
                    </div>
                  </div>
                </div>

                {/* Representative + contact */}
                <div className="border-t border-slate-100 px-4 py-3.5">
                  <div className="text-xs font-medium text-slate-500">
                    Representative
                  </div>
                  <div className="mt-1 break-words text-sm font-semibold capitalize text-slate-900">
                    {displayName(client.name)}
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <Mail
                        size={15}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-slate-400"
                      />
                      <a
                        href={`mailto:${client.email}`}
                        className="min-w-0 break-all hover:text-yard-navy hover:underline"
                      >
                        {client.email}
                      </a>
                    </li>
                    {client.phoneNumber && (
                      <li className="flex items-start gap-2">
                        <Phone
                          size={15}
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-slate-400"
                        />
                        <a
                          href={`tel:${client.phoneNumber}`}
                          className="min-w-0 break-all hover:text-yard-navy hover:underline"
                        >
                          {client.phoneNumber}
                        </a>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Documents */}
                <div className="border-t border-slate-100 px-4 py-3.5">
                  <div className="text-xs font-medium text-slate-500">
                    Documents
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(client.documents || []).length > 0 ? (
                      client.documents.map((doc) => (
                        <a
                          key={doc.publicId}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          href={resolveFileUrl(doc.secureUrl || doc.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText
                            size={12}
                            aria-hidden="true"
                            className="text-slate-400"
                          />
                          {doc.label}
                        </a>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">
                        No documents
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!listLoading && clients.length === 0 && (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <UserRoundSearch size={32} className="mx-auto text-slate-400" />
                <p className="mt-2 font-semibold text-slate-700">
                  No registrations found
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-4"
                  onClick={resetFilters}
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>

        <Pagination {...clientPagination} />
      </section>

      {/* Add client modal */}
      {showAddClient && canAddClients && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Add client account"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
              <div>
                <h3 className="text-xl font-semibold text-yard-navy">
                  Add client account
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Created as pending. No OTP email is sent.
                </p>
              </div>
              <ModalCloseButton
                onClick={() => setShowAddClient(false)}
                label="Close Add Client"
              />
            </div>

            <form onSubmit={submitNewClient} className="space-y-6 p-5 md:p-6">
              {newClientError && <Alert type="error">{newClientError}</Alert>}
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">
                The applicant must be manually verified by an authorized
                administrator before booking access is enabled. Email ownership
                is not confirmed. Obtain legal consent directly from the
                applicant; adding an account does not record consent on their
                behalf.
              </p>

              {newClientGroups.map((group) => (
                <fieldset key={group.title} className="space-y-3">
                  <legend className="text-sm font-semibold text-yard-navy">
                    {group.title}
                  </legend>
                  <div className="grid gap-4 md:grid-cols-2">
                    {group.fields.map(([label, field, span]) => (
                      <Field
                        key={field}
                        label={label}
                        required={!optionalFields.includes(field)}
                        className={span}
                      >
                        <input
                          className={inputClass}
                          type={
                            field.toLowerCase().includes("password")
                              ? "password"
                              : field === "email"
                                ? "email"
                                : "text"
                          }
                          required={!optionalFields.includes(field)}
                          minLength={
                            field === "password" || field === "confirmPassword"
                              ? 8
                              : undefined
                          }
                          autoComplete="off"
                          value={newClient[field]}
                          onChange={(event) =>
                            setNewClient((prev) => ({
                              ...prev,
                              [field]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </fieldset>
              ))}

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-yard-navy">
                  Documents
                </legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {clientDocumentFields.map(([label, field]) => (
                    <FileTile
                      key={field}
                      label={label}
                      required={requiredDocuments.includes(field)}
                      file={newClientFiles[field]}
                      onChange={(file) =>
                        setNewClientFiles((prev) => ({
                          ...prev,
                          [field]: file,
                        }))
                      }
                    />
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddClient(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? "Creating client..."
                    : "Create pending client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review modal */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Account review for ${selectedClient.companyName}`}
        >
          {/* UPDATED: Modal container is now a flex column with a max height */}
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
            {/* Sticky Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-base font-semibold text-emerald-700">
                  {initials(selectedClient.companyName || selectedClient.name)}
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Account review
                  </p>
                  <h3 className="text-xl font-semibold text-yard-navy">
                    {selectedClient.companyName}
                  </h3>
                </div>
                <StatusPill status={selectedClient.status} />
              </div>
              <ModalCloseButton
                onClick={() => setSelectedClient(null)}
                label="Close client details"
              />
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto">
              {isEditingClient && clientForm && (
                <div className="border-b border-slate-200 bg-white p-5">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {editFields.map(([label, field, span]) => (
                      <Field key={field} label={label} className={span}>
                        <input
                          className={inputClass}
                          type={field === "email" ? "email" : "text"}
                          value={clientForm[field] || ""}
                          onChange={(event) =>
                            updateClientField(field, event.target.value)
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                    Approval and rejection are managed only from the review
                    view. Editing updates profile information without changing
                    verification status.
                  </p>
                </div>
              )}

              <div
                className={`grid gap-5 p-5 md:p-6 ${isEditingClient ? "" : "lg:grid-cols-[minmax(0,1fr)_380px]"}`}
              >
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <InfoCard title="Company">
                      <dl className="space-y-3">
                        <Detail
                          label="Company name"
                          value={selectedClient.companyName}
                        />
                        <Detail
                          label="Address"
                          value={selectedClient.companyAddress}
                        />
                        <Detail
                          label="Type"
                          value={`${selectedClient.companyType || ""}${selectedClient.companyTypeOther ? `, ${selectedClient.companyTypeOther}` : ""}`}
                        />
                      </dl>
                    </InfoCard>

                    <InfoCard title="Representative">
                      <dl className="space-y-3">
                        <Detail label="Name" value={selectedClient.name} />
                        <Detail
                          label="Position"
                          value={selectedClient.representativePosition}
                        />
                        <Detail label="Email" value={selectedClient.email} />
                        <Detail
                          label="Phone number"
                          value={selectedClient.phoneNumber}
                        />
                      </dl>
                    </InfoCard>
                  </div>

                  <InfoCard
                    title="Legal consent"
                    description="Recorded by the backend at registration. The review action cannot replace it."
                    aside={
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          hasCompleteConsent(selectedClient)
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {hasCompleteConsent(selectedClient)
                          ? "Complete"
                          : "Legacy or incomplete"}
                      </span>
                    }
                  >
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Detail
                        label="Terms accepted"
                        value={
                          selectedClient.legalConsent?.termsAccepted
                            ? "Yes"
                            : "No"
                        }
                      />
                      <Detail
                        label="Privacy accepted"
                        value={
                          selectedClient.legalConsent?.privacyAccepted
                            ? "Yes"
                            : "No"
                        }
                      />
                      <Detail
                        label="Authority confirmed"
                        value={
                          selectedClient.legalConsent
                            ?.representativeAuthorityConfirmed
                            ? "Yes"
                            : "No"
                        }
                      />
                      <Detail
                        label="Accepted at"
                        value={
                          selectedClient.legalConsent?.acceptedAt
                            ? new Date(
                                selectedClient.legalConsent.acceptedAt,
                              ).toLocaleString()
                            : "N/A"
                        }
                      />
                      <Detail
                        label="Terms version"
                        value={selectedClient.legalConsent?.termsVersion}
                      />
                      <Detail
                        label="Privacy version"
                        value={
                          selectedClient.legalConsent?.privacyPolicyVersion
                        }
                      />
                    </dl>
                  </InfoCard>

                  <InfoCard title="Uploaded documents">
                    {(selectedClient.documents || []).length > 0 ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {selectedClient.documents.map((doc) => (
                          <li key={doc.publicId}>
                            <a
                              href={resolveFileUrl(doc.secureUrl || doc.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                                <FileText size={17} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-800">
                                  {doc.label}
                                </span>
                                <span className="block text-xs text-slate-500">
                                  Opens in a new tab
                                </span>
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        No documents uploaded.
                      </p>
                    )}
                  </InfoCard>

                  {selectedClient.rejectionReason && (
                    <section className="rounded-2xl border border-red-100 bg-red-50 p-5">
                      <h4 className="text-sm font-semibold text-red-700">
                        Previous rejection reason
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-red-700">
                        {selectedClient.rejectionReason}
                      </p>
                    </section>
                  )}
                </div>

                {!isEditingClient && (
                  <WorkflowDecisionPanel
                    className="self-start lg:sticky lg:top-28"
                    eyebrow="Client verification"
                    title="Admin decision"
                    description="Review the company, representative, consent and documents before deciding."
                    approveLabel="Verify account"
                    onApprove={() => verifyClient(selectedClient.id)}
                    approveDisabled={
                      actionLoading ||
                      isVerifiedStatus(selectedClient.status) ||
                      (manualVerificationRequired(selectedClient) &&
                        !manualVerificationConfirmed)
                    }
                    rejectLabel="Reject account"
                    rejectReason={rejectReasons[selectedClient.id] || ""}
                    onRejectReasonChange={(value) =>
                      setRejectReasons((prev) => ({
                        ...prev,
                        [selectedClient.id]: value,
                      }))
                    }
                    rejectPlaceholder="Explain why this client account is being rejected"
                    rejectFieldDisabled={isVerifiedStatus(
                      selectedClient.status,
                    )}
                    onReject={() => rejectClient(selectedClient.id)}
                    rejectDisabled={
                      actionLoading ||
                      isVerifiedStatus(selectedClient.status) ||
                      !(rejectReasons[selectedClient.id] || "").trim()
                    }
                    note={
                      isVerifiedStatus(selectedClient.status)
                        ? "This account is already verified or active. Decision actions are disabled."
                        : "Approval and rejection are available only here. Editing client information does not change the verification decision."
                    }
                  >
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4">
                      <Detail
                        label="Current status"
                        value={
                          <span className="capitalize">
                            {selectedClient.status}
                          </span>
                        }
                      />
                      <Detail
                        label="Documents"
                        value={(selectedClient.documents || []).length}
                      />
                      <Detail label="Onboarding" value={onboardingLabel} />
                      <Detail
                        label="Email verified"
                        value={selectedClient.isEmailVerified ? "Yes" : "No"}
                      />
                      <Detail
                        label="Consent"
                        value={
                          hasCompleteConsent(selectedClient)
                            ? "Complete"
                            : "Incomplete"
                        }
                      />
                    </dl>
                    {manualVerificationRequired(selectedClient) && (
                      <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                        <input
                          type="checkbox"
                          className="mt-1.5 h-4 w-4 shrink-0 accent-amber-600"
                          checked={manualVerificationConfirmed}
                          onChange={(event) =>
                            setManualVerificationConfirmed(event.target.checked)
                          }
                        />
                        I have independently verified the applicant's identity,
                        contact details, documents, and required legal consent.
                        This is a manual verification, not email OTP
                        verification.
                      </label>
                    )}
                  </WorkflowDecisionPanel>
                )}
              </div>
            </div>

            {/* Sticky Footer for actions (Only shows when editing) */}
            {isEditingClient && (
              <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white p-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditingClient(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveClient}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving..." : "Save client changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
