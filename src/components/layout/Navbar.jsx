// components/layout/Navbar.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiBell,
  FiBookOpen,
  FiChevronDown,
  FiClock,
  FiDollarSign,
  FiHome,
  FiInfo,
  FiLayers,
  FiPhone,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiUser,
  FiX,
} from "react-icons/fi";

import logo from "../../assets/logo.png";
import { useAuthStore } from "../../stores/authStore";
import { api, getApiError } from "../../lib/api";

const formatNotificationTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let duration = seconds;
  for (const [amount, unit] of ranges) {
    if (Math.abs(duration) < amount) {
      return formatter.format(Math.round(duration), unit);
    }
    duration /= amount;
  }

  return date.toLocaleString();
};

const getNotificationTone = (notification) => {
  const value = `${notification?.type || ""} ${notification?.title || ""}`.toLowerCase();

  if (value.includes("reject") || value.includes("cancel") || value.includes("correction")) {
    return { dot: "bg-rose-500", icon: "bg-rose-50 text-rose-600" };
  }

  if (value.includes("approve") || value.includes("complete") || value.includes("stored") || value.includes("verified")) {
    return { dot: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-700" };
  }

  if (value.includes("payment") || value.includes("billing") || value.includes("charge")) {
    return { dot: "bg-amber-500", icon: "bg-amber-50 text-amber-700" };
  }

  return { dot: "bg-sky-500", icon: "bg-sky-50 text-sky-700" };
};

const Navbar = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isVerified = ["active", "verified"].includes(user?.status);
  const location = useLocation();
  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const notificationIdsRef = useRef(new Set());

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState("");

  const navItems = [
    {
      icon: FiHome,
      label: "Home",
      path: "/",
    },
    {
      icon: FiBookOpen,
      label: "Booking",
      path: "/booking",
    },
    {
      icon: FiDollarSign,
      label: "Rates",
      path: "/rates",
    },
    {
      icon: FiLayers,
      label: "Services",
      path: "/services",
    },
    {
      icon: FiInfo,
      label: "About",
      path: "/about",
    },
    {
      icon: FiPhone,
      label: "Contact",
      path: "/contact",
    },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !["/booking", "/rates"].includes(item.path) || isVerified,
  );

  const profileMenuItems = [
    {
      icon: FiUser,
      label: "Profile",
      path: "/profile",
    },
    {
      icon: FiSettings,
      label: "Settings",
      path: "/settings",
    },
    {
      icon: FiClock,
      label: "Booking History",
      path: "/booking-history",
    },
  ];

  const userInitials = (user?.name || "Client")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }

    return location.pathname.startsWith(path);
  };

  const unreadLabel = useMemo(() => (unreadCount > 99 ? "99+" : String(unreadCount)), [unreadCount]);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!user?.id) return;

    if (!silent) setNotificationLoading(true);
    setNotificationError("");

    try {
      const { data } = await api.get("/client/notifications?limit=40");
      const items = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications((current) => {
        const mergedById = new Map(items.map((item) => [item.id, item]));
        current.forEach((item) => {
          if (!mergedById.has(item.id)) mergedById.set(item.id, item);
        });
        const merged = Array.from(mergedById.values())
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 40);
        notificationIdsRef.current = new Set(merged.map((item) => item.id));
        return merged;
      });
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (error) {
      setNotificationError(getApiError(error));
    } finally {
      if (!silent) setNotificationLoading(false);
    }
  }, [user?.id]);

  const markNotificationRead = async (notification) => {
    if (!notification || notification.isRead) return notification;

    const optimistic = { ...notification, isRead: true, readAt: new Date().toISOString() };
    setNotifications((current) => current.map((item) => item.id === notification.id ? optimistic : item));
    setUnreadCount((current) => Math.max(current - 1, 0));

    try {
      const { data } = await api.patch(`/client/notifications/${notification.id}/read`);
      if (data.notification) {
        setNotifications((current) => current.map((item) => item.id === notification.id ? data.notification : item));
        return data.notification;
      }
    } catch (error) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? notification : item));
      setUnreadCount((current) => current + 1);
      setNotificationError(getApiError(error));
    }

    return optimistic;
  };

  const handleNotificationClick = async (notification) => {
    await markNotificationRead(notification);
    setIsNotificationOpen(false);
    const actionPath = String(notification?.actionPath || "").trim();
    if (actionPath) navigate(actionPath);
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || readAt })));
    setUnreadCount(0);

    try {
      await api.patch("/client/notifications/read-all");
    } catch (error) {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setNotificationError(getApiError(error));
    }
  };

  const handleLogout = () => {
    logout();
    setIsProfileDropdownOpen(false);
    setIsNotificationOpen(false);
    setIsMobileMenuOpen(false);
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileDropdownOpen(false);
    setIsNotificationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    loadNotifications();

    const refreshSilently = () => loadNotifications({ silent: true });
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSilently();
    };
    const intervalId = window.setInterval(refreshSilently, 60000);

    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleRealtimeNotification = (event) => {
      const realtimeEvent = event?.detail;
      if (realtimeEvent?.type !== "notification:created" || !realtimeEvent.payload) return;

      const notification = realtimeEvent.payload;
      if (notificationIdsRef.current.has(notification.id)) return;
      notificationIdsRef.current.add(notification.id);
      setNotifications((current) => [notification, ...current].slice(0, 40));
      if (!notification.isRead) setUnreadCount((current) => current + 1);
      setNotificationError("");
    };

    window.addEventListener("otli:realtime", handleRealtimeNotification);
    return () => window.removeEventListener("otli:realtime", handleRealtimeNotification);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Desktop and mobile navbar */}
        <div className="relative grid h-24 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:h-28 xl:grid-cols-[minmax(240px,1fr)_auto_minmax(240px,1fr)]">
          {/* Left: brand */}
          <div className="flex min-w-0 items-center justify-start gap-2 sm:gap-3">
            <Link
              to="/"
              className="group flex h-16 w-28 shrink-0 items-center sm:h-20 sm:w-40 lg:h-24 lg:w-52"
              aria-label="Go to homepage"
            >
              <img
                src={logo}
                alt="One True Logistics Inc."
                className="h-full w-full object-contain object-left transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </Link>

          </div>

          {/* Center: primary navigation */}
          <nav
            className="hidden items-center justify-self-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1.5 shadow-sm xl:flex"
            aria-label="Main navigation"
          >
            {visibleNavItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={[
                    "group relative flex h-11 items-center gap-2 rounded-xl px-4",
                    "text-sm font-semibold transition-all duration-200",
                    active
                      ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/70"
                      : "text-slate-500 hover:bg-white hover:text-emerald-700",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-[18px] w-[18px] transition-all duration-200",
                      active
                        ? "text-emerald-600"
                        : "text-slate-400 group-hover:scale-110 group-hover:text-emerald-600",
                    ].join(" ")}
                  />

                  <span>{item.label}</span>

                  {active && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-emerald-600" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: notifications and account controls */}
          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            {/* Notifications */}
            <div ref={notificationRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNotificationOpen((current) => !current);
                  setIsProfileDropdownOpen(false);
                  setIsMobileMenuOpen(false);
                  if (!isNotificationOpen) loadNotifications({ silent: notifications.length > 0 });
                }}
                aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"}
                aria-haspopup="dialog"
                aria-expanded={isNotificationOpen}
                className={[
                  "group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm transition-all duration-200",
                  isNotificationOpen
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-50"
                    : "border-slate-200 text-slate-500 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-md",
                ].join(" ")}
              >
                <FiBell className="h-5 w-5 transition-transform duration-200 group-hover:rotate-6" />

                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black leading-none text-white shadow-sm">
                    {unreadLabel}
                  </span>
                )}
              </button>

              {isNotificationOpen && (
                <div
                  role="dialog"
                  aria-label="Notifications"
                  className="fixed inset-x-3 top-[6.75rem] z-[70] flex max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[min(25rem,calc(100vw-2rem))] sm:max-h-[calc(100dvh-8rem)]"
                >
                  <div className="shrink-0 border-b border-slate-100 bg-emerald-950 px-5 py-4 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black">Notifications</p>
                        <p className="mt-1 text-xs font-medium text-emerald-100">
                          {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        disabled={unreadCount === 0}
                        className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-white ring-1 ring-white/15 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark all read
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
                    {notificationLoading && notifications.length === 0 && (
                      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
                        <p className="mt-3 text-sm font-bold text-slate-700">Loading notifications</p>
                      </div>
                    )}

                    {!notificationLoading && notificationError && notifications.length === 0 && (
                      <div className="px-6 py-10 text-center">
                        <p className="text-sm font-bold text-rose-700">Unable to load notifications</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{notificationError}</p>
                        <button
                          type="button"
                          onClick={() => loadNotifications()}
                          className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800"
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {!notificationLoading && !notificationError && notifications.length === 0 && (
                      <div className="px-6 py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <FiBell className="h-6 w-6" />
                        </div>
                        <p className="mt-4 text-sm font-black text-slate-800">No notifications yet</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Booking, billing, Gate-In, and Gate-Out updates will appear here.</p>
                      </div>
                    )}

                    {notifications.map((notification) => {
                      const tone = getNotificationTone(notification);

                      return (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={[
                            "group relative flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition-colors last:border-b-0",
                            notification.isRead ? "bg-white hover:bg-slate-50" : "bg-emerald-50/60 hover:bg-emerald-50",
                          ].join(" ")}
                        >
                          {!notification.isRead && <span className={`absolute left-1.5 top-6 h-2 w-2 rounded-full ${tone.dot}`} />}
                          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                            <FiBell className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-black text-slate-800">{notification.title}</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-600">{notification.message}</span>
                            {(notification.bookingReference || notification.containerNumber) && (
                              <span className="mt-2 flex flex-wrap gap-1.5">
                                {notification.bookingReference && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{notification.bookingReference}</span>}
                                {notification.containerNumber && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{notification.containerNumber}</span>}
                              </span>
                            )}
                            <span className="mt-2 block text-[11px] font-bold text-slate-400">{formatNotificationTime(notification.createdAt)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {notifications.length > 0 && (
                    <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotificationOpen(false);
                          navigate("/booking-history");
                        }}
                        className="w-full rounded-xl bg-white px-4 py-3 text-xs font-black text-emerald-700 ring-1 ring-slate-200 transition hover:bg-emerald-50"
                      >
                        View booking history
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Account */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsProfileDropdownOpen((current) => !current);
                  setIsMobileMenuOpen(false);
                  setIsNotificationOpen(false);
                }}
                className={[
                  "flex h-14 items-center gap-2 rounded-2xl border bg-white p-2",
                  "shadow-sm transition-all duration-200 sm:gap-3 sm:pr-3",
                  isProfileDropdownOpen
                    ? "border-emerald-300 ring-4 ring-emerald-50"
                    : "border-slate-200 hover:border-emerald-300 hover:shadow-md",
                ].join(" ")}
                aria-haspopup="menu"
                aria-expanded={isProfileDropdownOpen}
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-sm font-bold text-white shadow-md shadow-emerald-200">
                  {userInitials}

                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                </div>

                <div className="hidden min-w-0 text-left lg:block">
                  <p className="max-w-32 truncate text-sm font-bold text-slate-800">
                    {user?.name || "Client"}
                  </p>

                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    {user?.companyName || "Client"}
                  </p>
                </div>

                <FiChevronDown
                  className={[
                    "hidden h-4 w-4 text-slate-400 transition-transform duration-200 sm:block",
                    isProfileDropdownOpen ? "rotate-180 text-emerald-600" : "",
                  ].join(" ")}
                />
              </button>

              {/* Account dropdown */}
              {isProfileDropdownOpen && (
                <div
                  role="menu"
                  className="
                    absolute right-0 top-full mt-3
                    w-[min(18rem,calc(100vw-2rem))]
                    origin-top-right overflow-hidden
                    rounded-3xl border border-slate-200
                    bg-white shadow-2xl shadow-slate-300/50
                  "
                >
                  <div className="bg-gradient-to-br from-emerald-700 to-emerald-950 p-5 text-white">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-sm font-bold ring-1 ring-white/25">
                        {userInitials}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {user?.name || "Client"}
                        </p>

                        <p className="mt-1 truncate text-xs text-emerald-100">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/10">
                      <span className="text-xs text-emerald-100">
                        Account type
                      </span>

                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
                        {user?.companyName || "Client"}
                      </span>
                    </div>
                  </div>

                  <div className="p-2">
                    {profileMenuItems.map((item) => {
                      const active = isActive(item.path);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          role="menuitem"
                          className={[
                            "group flex items-center gap-3 rounded-2xl px-3 py-3",
                            "text-sm font-semibold transition-colors duration-200",
                            active
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-slate-600 hover:bg-slate-50 hover:text-emerald-700",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                              active
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600",
                            ].join(" ")}
                          >
                            <Icon className="h-4 w-4" />
                          </span>

                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 p-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-rose-600 transition-colors duration-200 hover:bg-rose-50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 transition-colors group-hover:bg-rose-100">
                        <FiLogOut className="h-4 w-4" />
                      </span>

                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu: kept beside the profile control */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen((current) => !current);
                setIsProfileDropdownOpen(false);
                setIsNotificationOpen(false);
              }}
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm",
                "transition-all duration-200 xl:hidden",
                isMobileMenuOpen
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600",
              ].join(" ")}
              aria-label={
                isMobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              aria-expanded={isMobileMenuOpen}
              aria-controls="client-mobile-navigation"
            >
              {isMobileMenuOpen ? (
                <FiX className="h-5 w-5" />
              ) : (
                <FiMenu className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Mobile navigation dropdown */}
          {isMobileMenuOpen && (
            <div id="client-mobile-navigation" className="absolute left-0 right-0 top-full z-50 pt-3 xl:hidden">
              <div
                className="max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-300/40"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="space-y-1">
                  {visibleNavItems.map((item) => {
                    const active = isActive(item.path);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={[
                          "flex items-center gap-3 rounded-2xl px-3 py-3",
                          "text-sm font-semibold transition-colors duration-200",
                          active
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-emerald-700",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            active
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-slate-100 text-slate-500",
                          ].join(" ")}
                        >
                          <Icon className="h-5 w-5" />
                        </span>

                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                <div className="my-3 border-t border-slate-100" />

                <div className="space-y-1">
                  {profileMenuItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-emerald-700"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                          <Icon className="h-5 w-5" />
                        </span>

                        <span>{item.label}</span>
                      </Link>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-rose-600 transition-colors duration-200 hover:bg-rose-50"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
                      <FiLogOut className="h-5 w-5" />
                    </span>

                    <span>Log out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
