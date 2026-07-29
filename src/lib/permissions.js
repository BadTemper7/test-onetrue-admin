export const permissionModules = [
  { key: "dashboard", label: "Dashboard" },
  { key: "accounts", label: "Accounts" },
  { key: "operations", label: "Operations" },
  { key: "yard", label: "Yard" },
  { key: "billing", label: "Billing" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
]

const permissionAliases = {
  dashboard: ["dashboard"],
  accounts: ["accounts", "clients", "userManagement", "roleAccess", "clientVerification"],
  operations: ["operations", "preAdvice", "bookings", "gateAppointment", "gateIn"],
  yard: ["yard", "yardSetup", "inventory", "yardMap", "storageMonitoring"],
  billing: ["billing", "rateSetup", "paymentTypes", "paymentVerification", "gateOut", "blacklist", "chargeHold"],
  reports: ["reports", "auditTrail"],
  settings: ["settings"],
}

export const resolvePermissionModule = (moduleName = "") =>
  permissionModules.find(({ key }) => permissionAliases[key].includes(moduleName))?.key || moduleName

export const createEmptyPermissions = () =>
  permissionModules.reduce((permissions, { key }) => {
    permissions[key] = { view: false, create: false, edit: false, delete: false }
    return permissions
  }, {})

export const createFullPermissions = () =>
  permissionModules.reduce((permissions, { key }) => {
    permissions[key] = { view: true, create: true, edit: true, delete: true }
    return permissions
  }, {})

export const getPermissionsForRole = (role) =>
  ["super_admin", "admin"].includes(role)
    ? createFullPermissions()
    : createEmptyPermissions()

export const hasModulePermission = (user, moduleName, action = "view") => {
  if (["super_admin", "admin"].includes(user?.role)) return true
  const permissionModule = resolvePermissionModule(moduleName)
  return Boolean(user?.permissions?.[permissionModule]?.[action])
}
