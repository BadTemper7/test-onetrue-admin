import React, { useState, useEffect } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { useAuthStore } from "../../stores/authStore";
import { useSocket } from "../../hooks/useSocket";

// Tailwind's `lg` breakpoint — matches the `lg:hidden` / `lg:flex` classes
// that switch between the mobile drawer and the desktop rail.
const DESKTOP_BREAKPOINT = "(min-width: 1024px)";

const Layout = ({ children }) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const { connected, events } = useSocket({ token, enabled: user?.userType === "admin" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // If the viewport crosses into desktop width while the mobile drawer is
  // open, close it. Without this, mobileSidebarOpen can stay stale at `true`
  // after a resize, which then conflicts with sidebarOpen when the desktop
  // rail is toggled (see Sidebar.jsx render variants for the other half of
  // this fix).
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT);
    const handleChange = (e) => {
      if (e.matches) setMobileSidebarOpen(false);
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-yard-fog">
      <Sidebar
        isOpen={sidebarOpen}
        isMobileOpen={mobileSidebarOpen}
        toggleMobile={toggleMobileSidebar}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? "lg:ml-64" : "lg:ml-20"
        }`}
      >
        <Header
          toggleSidebar={toggleSidebar}
          toggleMobileSidebar={toggleMobileSidebar}
          sidebarOpen={sidebarOpen}
          connected={connected}
          realtimeEvents={events}
        />

        <main className="p-4 md:p-6 min-h-[calc(100vh-8rem)]">{children}</main>

        <Footer />
      </div>

      {/* Mobile overlay is rendered inside Sidebar.jsx — not duplicated here */}
    </div>
  );
};

export default Layout;
