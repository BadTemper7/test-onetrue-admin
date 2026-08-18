import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiMenu,
  FiBell,
  FiUser,
  FiLogOut,
  FiSettings,
  FiSearch,
  FiChevronDown,
  FiCheck,
  FiInbox,
} from "react-icons/fi";
import { useAuthStore } from "../../stores/authStore";
import { useClickOutside } from "../../hooks/useClickOutside";

const notificationLabels = {
  "client:registered": "New client registration",
  "client:resubmitted": "Client account resubmitted",
  "client:approved": "Client account approved",
  "client:rejected": "Client account rejected",
  "preAdvice:submitted": "New pre-advice submitted",
  "preAdvice:confirmed": "Pre-advice confirmed",
  "preAdvice:rejected": "Pre-advice rejected",
  "booking:submitted": "New booking submitted",
  "booking:resubmitted": "Booking resubmitted for review",
  "booking:approved": "Booking approved",
  "booking:rejected": "Booking rejected",
  "booking:gate_in_approved": "Gate-In approved",
  "booking:gate_in_rejected": "Gate-In rejected",
  "booking:stored": "Container stored in yard",
  "booking:relocated": "Container relocated",
  "booking:billing_operation_updated": "Billing operation updated",
  "booking:payment_submitted": "Payment proof submitted",
  "booking:payment_approved": "Payment approved",
  "booking:payment_rejected": "Payment rejected",
  "booking:cash_payment_recorded": "Cash payment recorded",
  "booking:gate_out_requested": "Gate-out request submitted",
  "booking:gate_out_rejected": "Gate-out request rejected",
  "booking:gate_out_approved": "Gate-out approved",
  "booking:overstay_billing_recomputed": "Overstay billing recomputed",
  "booking:completed": "Container released",
};

const notificationRoute = (type) => {
  if (type.startsWith("client:")) return "/accounts/client-verification";
  if (type.startsWith("preAdvice:")) return "/operations/pre-advice";
  if (["booking:submitted", "booking:resubmitted", "booking:approved", "booking:rejected"].includes(type)) {
    return "/operations/pre-advice";
  }
  if (type.startsWith("booking:gate_in")) return "/operations/gate-in";
  if (type.includes("payment") || type.includes("billing") || type.includes("charge")) {
    return "/billing/payment-verification";
  }
  if (type === "booking:completed") return "/billing/release-container";
  if (type.includes("gate_out")) return "/billing/gate-out";
  if (type.includes("stored") || type.includes("relocated")) return "/yard/inventory";
  return "/dashboard";
};

const getEventReference = (payload = {}) =>
  payload.bookingReference ||
  payload.preAdviceNumber ||
  payload.containerNumber ||
  payload.companyName ||
  payload.clientName ||
  payload.name ||
  "";

const Header = ({ toggleSidebar, toggleMobileSidebar, connected = false, realtimeEvents = [] }) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [openMenu, setOpenMenu] = useState(null);
  const [readIds, setReadIds] = useState([]);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  useClickOutside(
    [notificationRef, profileRef],
    () => setOpenMenu(null),
    Boolean(openMenu),
  );

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const notifications = useMemo(
    () =>
      realtimeEvents
        .filter((event) => notificationLabels[event.type])
        .slice(0, 12)
        .map((event) => {
          const id = `${event.type}-${event.time}`;
          const reference = getEventReference(event.payload);
          return {
            id,
            title: notificationLabels[event.type],
            detail: reference ? String(reference) : "Open the related module to review.",
            time: new Date(event.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            read: readIds.includes(id),
            route: notificationRoute(event.type),
          };
        }),
    [readIds, realtimeEvents],
  );

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const toggleMenu = (menuName) => {
    setOpenMenu((current) => (current === menuName ? null : menuName));
  };

  const markAllRead = () => {
    setReadIds((current) => [
      ...new Set([...current, ...notifications.map((notification) => notification.id)]),
    ]);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="px-4 py-3 md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleMobileSidebar}
              className="rounded-md p-2 transition-colors hover:bg-yard-fog focus:outline-none focus:ring-2 focus:ring-yard-navy/30 lg:hidden"
              aria-label="Toggle mobile menu"
            >
              <FiMenu className="h-6 w-6 text-slate-700" />
            </button>

            <button
              onClick={toggleSidebar}
              className="hidden rounded-md p-2 transition-colors hover:bg-yard-fog focus:outline-none focus:ring-2 focus:ring-yard-navy/30 lg:block"
              aria-label="Toggle sidebar"
            >
              <FiMenu className="h-5 w-5 text-slate-600" />
            </button>

            <div className="hidden items-center rounded-md border border-transparent bg-yard-fog px-3 py-2 transition-colors focus-within:border-yard-navy/30 focus-within:bg-white md:flex">
              <FiSearch className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="ml-2 w-48 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 lg:w-64"
              />
            </div>
          </div>

          <div className="flex items-center space-x-1.5 md:space-x-2">
            <button className="rounded-md p-2 transition-colors hover:bg-yard-fog md:hidden" aria-label="Search">
              <FiSearch className="h-5 w-5 text-slate-600" />
            </button>

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => toggleMenu("notifications")}
                className="relative rounded-md p-2 transition-colors hover:bg-yard-fog"
                aria-expanded={openMenu === "notifications"}
                aria-label="Notifications"
              >
                <FiBell className="h-5 w-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {openMenu === "notifications" && (
                <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-200 p-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-950">Notifications</h3>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">Only items that require admin attention are shown.</p>
                    </div>
                    {notifications.length > 0 && unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800"
                      >
                        <FiCheck className="h-3.5 w-3.5" /> Mark read
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <FiInbox className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-3 text-sm font-black text-slate-700">No action-required notifications</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">Connection logs and setup changes are not displayed here.</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => {
                            setReadIds((current) =>
                              current.includes(notification.id) ? current : [...current, notification.id],
                            );
                            setOpenMenu(null);
                            navigate(notification.route);
                          }}
                          className={`block w-full border-b border-slate-100 p-4 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${
                            notification.read ? "bg-white" : "bg-emerald-50/60"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-1 h-2 w-2 flex-none rounded-full ${notification.read ? "bg-slate-300" : "bg-emerald-600"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-slate-900">{notification.title}</p>
                              <p className="mt-1 truncate text-xs font-semibold text-slate-500">{notification.detail}</p>
                              <p className="mt-1 text-[11px] font-semibold text-slate-400">{notification.time}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => toggleMenu("profile")}
                className="flex items-center space-x-2 rounded-md p-1.5 pr-2 transition-colors hover:bg-yard-fog"
                aria-expanded={openMenu === "profile"}
              >
                <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-yard-blue text-white">
                  <FiUser className="h-4 w-4" />
                  <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${connected ? "bg-emerald-500" : "bg-slate-400"}`} />
                </div>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-display leading-tight text-slate-800">{user?.name || "Admin User"}</p>
                  <p className="text-[11px] font-mono capitalize leading-tight text-slate-400">
                    {user?.role?.replaceAll("_", " ") || "Administrator"}
                  </p>
                </div>
                <FiChevronDown className={`hidden h-4 w-4 text-slate-400 transition-transform md:block ${openMenu === "profile" ? "rotate-180" : ""}`} />
              </button>

              {openMenu === "profile" && (
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-black text-slate-800">{user?.name || "Admin User"}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email || ""}</p>
                  </div>
                  <div className="py-1.5">
                    <button className="flex w-full items-center space-x-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-yard-fog hover:text-yard-navy">
                      <FiUser className="h-4 w-4" />
                      <span>Profile</span>
                    </button>
                    <button className="flex w-full items-center space-x-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-yard-fog hover:text-yard-navy">
                      <FiSettings className="h-4 w-4" />
                      <span>Settings</span>
                    </button>
                    <div className="my-1 border-t border-slate-200" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center space-x-2 px-4 py-2.5 text-left text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
                    >
                      <FiLogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
