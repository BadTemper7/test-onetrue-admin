import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiSettings,
  FiBarChart2,
  FiFileText,
  FiLogOut,
  FiChevronDown,
  FiChevronRight,
  FiDatabase,
  FiUserCheck,
  FiUser,
  FiShield,
  FiTruck,
  FiPackage,
  FiBox,
  FiMapPin,
  FiGrid,
  FiDollarSign,
  FiCreditCard,
  FiCornerDownRight,
  FiActivity,
} from "react-icons/fi";
import logo from "../../assets/logo.png";
import { useAuthStore } from "../../stores/authStore";
import { hasModulePermission } from "../../lib/permissions";

// Design tokens (also add these to tailwind.config.js — see chat for the snippet):
//   yard-navy  #10192B   yard-green #087A55   yard-fog #F4F6F8   yard-slate #475569
// Fonts: font-display = Space Grotesk (nav labels), font-mono = IBM Plex Mono (codes/badges)

const Sidebar = ({ isOpen, isMobileOpen, toggleMobile, onClose }) => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const [expandedMenu, setExpandedMenu] = useState(null);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const menuItems = [
    {
      name: "Dashboard",
      icon: FiHome,
      path: "/dashboard",
      exact: true,
    },
    {
      name: "Accounts",
      code: "AC",
      icon: FiUsers,
      key: "accounts",
      children: [
        {
          name: "Client verification",
          path: "/accounts/client-verification",
          icon: FiUserCheck,
        },
        {
          name: "User management",
          path: "/accounts/user-management",
          icon: FiUsers,
          allowedRoles: ["super_admin"],
        },
      ],
    },
    {
      name: "Operations",
      code: "OP",
      icon: FiTruck,
      key: "operations",
      children: [
        {
          name: "Pre-advice",
          path: "/operations/pre-advice",
          icon: FiFileText,
        },
        {
          name: "Gate-in",
          path: "/operations/gate-in",
          icon: FiCornerDownRight,
        },
        {
          name: "Container tracking",
          path: "/operations/tracking",
          icon: FiPackage,
        },
      ],
    },
    {
      name: "Yard",
      code: "YD",
      icon: FiMapPin,
      key: "yard",
      children: [
        { name: "Yard area setup", path: "/yard/area-setup", icon: FiGrid },
        { name: "Inventory", path: "/yard/inventory", icon: FiBox },
        {
          name: "Storage monitoring",
          path: "/yard/storage-monitoring",
          icon: FiActivity,
        },
      ],
    },
    {
      name: "Billing",
      code: "BL",
      icon: FiDollarSign,
      key: "billing",
      children: [
        { name: "Rate setup", path: "/billing/rate-setup", icon: FiSettings },
        { name: "Payment types", path: "/billing/payment-types", icon: FiCreditCard },
        {
          name: "Payment verification",
          path: "/billing/payment-verification",
          icon: FiCreditCard,
        },
        { name: "Gate-out", path: "/billing/gate-out", icon: FiCornerDownRight },
        { name: "Release Container", path: "/billing/release-container", icon: FiLogOut },
        {
          name: "Payment history",
          path: "/billing/payment-history",
          icon: FiDatabase,
        },
      ],
    },
    {
      name: "Reports",
      code: "RP",
      icon: FiBarChart2,
      key: "reports",
      children: [
        { name: "Analytics", path: "/reports/analytics", icon: FiActivity },
        { name: "Audit logs", path: "/reports/audit-logs", icon: FiFileText },
      ],
    },
    {
      name: "Settings",
      code: "ST",
      icon: FiSettings,
      key: "settings",
      children: [
        { name: "General", path: "/settings/general", icon: FiSettings },
        { name: "Security", path: "/settings/security", icon: FiShield, allowedRoles: ["super_admin"] },
        {
          name: "Notifications",
          path: "/settings/notifications",
          icon: FiActivity,
        },
      ],
    },
  ];

  const pathPermissionMap = {
    "/dashboard": "dashboard",
    "/accounts/client-verification": "accounts",
    "/accounts/user-management": "accounts",
    "/operations/pre-advice": "operations",
    "/operations/gate-in": "operations",
    "/operations/tracking": "operations",
    "/yard/area-setup": "yard",
    "/yard/inventory": "yard",
    "/yard/storage-monitoring": "yard",
    "/billing/rate-setup": "billing",
    "/billing/payment-types": "billing",
    "/billing/payment-verification": "billing",
    "/billing/release-container": "billing",
    "/billing/gate-out": "billing",
    "/billing/payment-history": "billing",
    "/reports/analytics": "reports",
    "/reports/audit-logs": "reports",
    "/settings/general": "settings",
    "/settings/security": "settings",
    "/settings/notifications": "settings",
  };

  const hasModuleAccess = (item) => {
    if (item.allowedRoles && !item.allowedRoles.includes(user?.role)) return false;
    const moduleName = pathPermissionMap[item.path];
    return Boolean(moduleName && hasModulePermission(user, moduleName, "view"));
  };

  const visibleMenuItems = menuItems
    .map((item) => {
      if (!item.children) return hasModuleAccess(item) ? item : null;
      const children = item.children.filter((child) => hasModuleAccess(child));
      return children.length ? { ...item, children } : null;
    })
    .filter(Boolean);

  // Keep the active route visible and use accordion behavior so only one
  // sidebar group can be expanded at a time.
  useEffect(() => {
    const activeParent = visibleMenuItems.find((item) =>
      item.children?.some((child) => location.pathname.startsWith(child.path)),
    );
    setExpandedMenu(activeParent?.key || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleMenu = (menuName) => {
    setExpandedMenu((current) => (current === menuName ? null : menuName));
  };

  const renderMenuItem = (item) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenu === item.key;
    const IconComponent = item.icon;
    const collapsedRail = !isOpen && !isMobileOpen;
    const isGroupActive =
      hasChildren &&
      item.children.some((child) => location.pathname.startsWith(child.path));

    if (!hasChildren) {
      // Leaf item, e.g. Dashboard
      return (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.exact}
          onClick={() => isMobileOpen && onClose()}
          className={({ isActive }) => `
            flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors duration-150
            ${collapsedRail ? "justify-center" : ""}
            ${
              isActive
                ? "bg-white border-l-2 border-yard-green text-yard-navy font-medium"
                : "text-slate-600 hover:bg-white/70 hover:text-yard-navy"
            }
          `}
          title={collapsedRail ? item.name : ""}
        >
          <IconComponent className="h-[17px] w-[17px] flex-shrink-0" />
          {!collapsedRail && (
            <span className="text-[13.5px] font-display truncate">
              {item.name}
            </span>
          )}
        </NavLink>
      );
    }

    return (
      <div key={item.key}>
        <button
          type="button"
          onClick={() => toggleMenu(item.key)}
          aria-expanded={isExpanded}
          title={collapsedRail ? item.name : ""}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors duration-150
            ${collapsedRail ? "justify-center" : ""}
            ${isGroupActive ? "text-yard-navy" : "text-slate-600"}
            hover:bg-white/70 hover:text-yard-navy
          `}
        >
          <IconComponent className="h-[17px] w-[17px] flex-shrink-0" />
          {!collapsedRail && (
            <>
              <span className="flex-1 text-left text-[13.5px] font-display truncate">
                {item.name}
              </span>
              <span className="font-mono text-[10px] tracking-wide text-slate-400">
                {item.code}
              </span>
              <FiChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 flex-shrink-0 ${
                  isExpanded ? "" : "-rotate-90"
                }`}
              />
            </>
          )}
        </button>

        {!collapsedRail && isExpanded && (
          <div className="mt-0.5 mb-1 space-y-0.5">
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                onClick={() => isMobileOpen && onClose()}
                aria-current={
                  location.pathname === child.path ? "page" : undefined
                }
                className={({ isActive }) => `
                  flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-r-md transition-colors duration-150
                  ${
                    isActive
                      ? "bg-white border-l-2 border-yard-green text-yard-navy font-medium"
                      : "text-slate-500 hover:bg-white/70 hover:text-yard-navy border-l-2 border-transparent"
                  }
                `}
              >
                {child.icon && <child.icon className="h-4 w-4 flex-shrink-0" />}
                <span className="text-[13px] truncate">{child.name}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden lg:flex lg:flex-col fixed left-0 top-0 h-full bg-yard-fog border-r border-slate-200
          transition-all duration-300 z-30
          ${isOpen ? "w-64" : "w-20"}
        `}
      >
        {/* Identity block */}
        <div className="border-b border-slate-200 bg-white px-4 py-4 flex flex-col items-center flex-shrink-0">
          <img
            src={logo}
            alt="Logo"
            className={`${isOpen ? "h-48 w-48" : "h-9 w-9"} object-contain transition-all duration-300`}
          />
          {isOpen && (
            <div className="mt-2 text-center">
              <div className="font-mono text-[10px] tracking-[0.15em] text-yard-green">
                OTLI
              </div>
              <div className="text-[11px] font-medium text-slate-500">Yard operations</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-2.5 custom-scrollbar">
          <div className="space-y-0.5">
            {visibleMenuItems.map((item) => renderMenuItem(item))}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-slate-200 p-2.5 flex-shrink-0">
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-2.5 rounded-md transition-colors p-2
              text-red-700 hover:bg-red-50
              ${!isOpen ? "justify-center" : ""}
            `}
            title={!isOpen ? "Log out" : ""}
          >
            <FiLogOut className="h-[17px] w-[17px] flex-shrink-0" />
            {isOpen && (
              <span className="text-[13.5px] font-display">Log out</span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <div
        className={`
          lg:hidden fixed inset-y-0 left-0 w-72 bg-yard-fog shadow-2xl
          flex flex-col
          transform transition-transform duration-300 ease-in-out bg-white z-50
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="border-b border-slate-200 bg-white px-4 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
            <div>
              <div className="font-mono text-[10px] tracking-[0.15em] text-yard-green">
                OTLI
              </div>
              <div className="text-[11px] font-medium text-slate-500">Yard operations</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Close sidebar"
          >
            <FiChevronRight className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-2.5 custom-scrollbar">
          <div className="space-y-0.5">
            {visibleMenuItems.map((item) => renderMenuItem(item))}
          </div>
        </nav>

        <div className="border-t border-slate-200 p-2.5 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 text-red-700 hover:bg-red-50 rounded-md transition-colors p-2"
          >
            <FiLogOut className="h-[17px] w-[17px]" />
            <span className="text-[13.5px] font-display">Log out</span>
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-fadeIn"
          onClick={onClose}
        />
      )}

      {/* Custom Scrollbar & Animation Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-in-out; }
      `}</style>
    </>
  );
};

export default Sidebar;
