import { Suspense, lazy } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import Layout from "./components/layout/Layout"
import ProtectedRoute from "./components/auth/ProtectedRoute"
import PermissionRoute from "./components/auth/PermissionRoute"
import FormFieldValidation from "./components/FormFieldValidation"
import AdaptiveTables from "./components/table/AdaptiveTables"
import PageHelmet from "./components/meta/PageHelmet"
import Login from "./pages/Login"
const Dashboard = lazy(() => import("./pages/Dashboard"))
const AdminAccounts = lazy(() => import("./pages/modules/AdminAccounts"))
const AdminClients = lazy(() => import("./pages/modules/AdminClients"))
const AdminBookings = lazy(() => import("./pages/modules/AdminBookings"))
const AdminPreAdvice = lazy(() => import("./pages/modules/AdminPreAdvice"))
const AdminGateIn = lazy(() => import("./pages/modules/AdminGateIn"))
const AdminInventory = lazy(() => import("./pages/modules/AdminInventory"))
const AdminStorageMonitoring = lazy(() => import("./pages/modules/AdminStorageMonitoring"))
const AdminYardAreas = lazy(() => import("./pages/modules/AdminYardAreas"))
const AdminRateSetup = lazy(() => import("./pages/modules/AdminRateSetup"))
const AdminPaymentTypes = lazy(() => import("./pages/modules/AdminPaymentTypes"))
const AdminBilling = lazy(() => import("./pages/modules/AdminBilling"))
const AdminGateOut = lazy(() => import("./pages/modules/AdminGateOut"))
const AdminGateOutCalendar = lazy(() => import("./pages/modules/AdminGateOutCalendar"))
const AdminReleaseContainer = lazy(() => import("./pages/modules/AdminReleaseContainer"))
const AdminReports = lazy(() => import("./pages/modules/AdminReports"))
const AdminPaymentHistory = lazy(() => import("./pages/modules/AdminPaymentHistory"))
const AdminAuditLogs = lazy(() => import("./pages/modules/AdminAuditLogs"))
const AdminEmailMonitoring = lazy(() => import("./pages/modules/AdminEmailMonitoring"))
const AdminSecuritySettings = lazy(() => import("./pages/modules/AdminSecuritySettings"))
const PlaceholderPage = lazy(() => import("./pages/modules/PlaceholderPage"))

const AdminShell = () => <Layout><Outlet /></Layout>
const ProtectedModule = ({ moduleName, action = "view", allowedRoles, children }) => (
  <PermissionRoute moduleName={moduleName} action={action} allowedRoles={allowedRoles}>
    {children}
  </PermissionRoute>
)
const TitledPage = ({ title, children }) => (
  <Suspense fallback={<div role="status" className="card m-4 p-8 text-center font-semibold text-slate-500">Loading {title}...</div>}>
    <PageHelmet title={title} />{children}
  </Suspense>
)

const Placeholder = ({ title, moduleName, description, checklist }) => (
  <TitledPage title={title}>
    <PlaceholderPage title={title} moduleName={moduleName} description={description} checklist={checklist} />
  </TitledPage>
)

function App() {
  return (
    <>
      <AdaptiveTables />
      <FormFieldValidation />
      <Routes>
        <Route path="/login" element={<TitledPage title="Admin Login"><Login /></TitledPage>} />

        <Route element={<ProtectedRoute userType="admin" />}>
          <Route element={<AdminShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<TitledPage title="Dashboard"><ProtectedModule moduleName="dashboard"><Dashboard /></ProtectedModule></TitledPage>} />

            <Route path="accounts/client-verification" element={<TitledPage title="Client Verification"><ProtectedModule moduleName="accounts"><AdminClients /></ProtectedModule></TitledPage>} />
            <Route path="accounts/client-list" element={<Navigate to="/accounts/client-verification" replace />} />
            <Route path="accounts/user-management" element={<TitledPage title="User Management"><ProtectedModule moduleName="accounts" allowedRoles={["super_admin"]}><AdminAccounts /></ProtectedModule></TitledPage>} />
            <Route path="accounts/user-roles" element={<Navigate to="/accounts/user-management" replace />} />

            <Route path="operations/pre-advice" element={<TitledPage title="Pre-Advice"><ProtectedModule moduleName="operations"><AdminPreAdvice /></ProtectedModule></TitledPage>} />
            <Route path="operations/gate-in" element={<TitledPage title="Gate-In"><ProtectedModule moduleName="operations"><AdminGateIn /></ProtectedModule></TitledPage>} />
            <Route path="operations/tracking" element={<TitledPage title="Container Tracking"><ProtectedModule moduleName="operations"><AdminBookings /></ProtectedModule></TitledPage>} />
            <Route path="operations/import-export" element={<Navigate to="/operations/tracking" replace />} />

            <Route path="yard/area-setup" element={<TitledPage title="Yard Area Setup"><ProtectedModule moduleName="yard"><AdminYardAreas /></ProtectedModule></TitledPage>} />
            <Route path="yard/inventory" element={<TitledPage title="Inventory"><ProtectedModule moduleName="yard"><AdminInventory /></ProtectedModule></TitledPage>} />
            <Route path="yard/storage-monitoring" element={<TitledPage title="Storage Monitoring"><ProtectedModule moduleName="yard"><AdminStorageMonitoring /></ProtectedModule></TitledPage>} />

            <Route path="billing/rate-setup" element={<TitledPage title="Rate Setup"><ProtectedModule moduleName="billing"><AdminRateSetup /></ProtectedModule></TitledPage>} />
            <Route path="billing/payment-types" element={<TitledPage title="Payment Types"><ProtectedModule moduleName="billing"><AdminPaymentTypes /></ProtectedModule></TitledPage>} />
            <Route path="billing/payment-verification" element={<TitledPage title="Payment Verification"><ProtectedModule moduleName="billing"><AdminBilling /></ProtectedModule></TitledPage>} />
            <Route path="billing/gate-out" element={<TitledPage title="Gate-Out"><ProtectedModule moduleName="billing"><AdminGateOut /></ProtectedModule></TitledPage>} />
            <Route path="billing/gate-out-calendar" element={<TitledPage title="Gate-Out Calendar"><ProtectedModule moduleName="billing" allowedRoles={["super_admin"]}><AdminGateOutCalendar /></ProtectedModule></TitledPage>} />
            <Route path="billing/release-container" element={<TitledPage title="Release Container"><ProtectedModule moduleName="billing"><AdminReleaseContainer /></ProtectedModule></TitledPage>} />
            <Route path="billing/invoices" element={<Navigate to="/billing/payment-history" replace />} />
            <Route path="billing/payment-history" element={<TitledPage title="Payment History"><ProtectedModule moduleName="billing"><AdminPaymentHistory /></ProtectedModule></TitledPage>} />

            <Route path="reports/analytics" element={<TitledPage title="Reports"><ProtectedModule moduleName="reports"><AdminReports /></ProtectedModule></TitledPage>} />
            <Route path="reports/audit-logs" element={<TitledPage title="Audit Logs"><ProtectedModule moduleName="reports"><AdminAuditLogs /></ProtectedModule></TitledPage>} />
            <Route path="reports/email-monitoring" element={<TitledPage title="Email Monitoring"><ProtectedModule moduleName="reports"><AdminEmailMonitoring /></ProtectedModule></TitledPage>} />

            <Route path="settings/general" element={<ProtectedModule moduleName="settings"><Placeholder title="General Settings" moduleName="Settings" description="Manage global application defaults and operational configuration." checklist={["Application labels", "Default statuses", "File rules", "Notification rules"]} /></ProtectedModule>} />
            <Route path="settings/security" element={<TitledPage title="Security Settings"><ProtectedModule moduleName="settings" allowedRoles={["super_admin"]}><AdminSecuritySettings /></ProtectedModule></TitledPage>} />
            <Route path="settings/notifications" element={<ProtectedModule moduleName="settings"><Placeholder title="Notification Settings" moduleName="Settings" description="Configure email and real-time notification preferences." checklist={["Email events", "Socket events", "Admin alerts", "Client alerts"]} /></ProtectedModule>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}

export default App
