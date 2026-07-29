import { Navigate } from "react-router-dom"
import { useAuthStore } from "../../stores/authStore"
import { hasModulePermission } from "../../lib/permissions"

const PermissionRoute = ({ moduleName, action = "view", allowedRoles, children }) => {
  const user = useAuthStore((state) => state.user)

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (!moduleName || hasModulePermission(user, moduleName, action)) return children

  return <Navigate to="/dashboard" replace />
}

export default PermissionRoute
