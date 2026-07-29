export const adminFlowModules = [
  {
    group: "Control Center",
    items: [
      {
        key: "dashboard",
        title: "Admin Dashboard",
        path: "/dashboard",
        description: "Monitor pending bookings, Gate-Out requests, current inventory, available yard capacity, occupancy, revenue, and pending account verification.",
        status: "Active",
      },
      {
        key: "auditTrail",
        title: "Audit Trail",
        path: "/reports/audit-logs",
        description: "Track booking approval, yard assignment, Gate-In inspection, storage, billing, payment verification, Gate-Out release, and user access changes.",
        status: "CMS placeholder",
      },
    ],
  },
  {
    group: "Account Flow",
    items: [
      {
        key: "clientVerification",
        title: "Client Verification",
        path: "/accounts/client-verification",
        description: "Review pending registrations, verify clients, reject with a reason, and check resubmitted applications.",
        status: "Active",
      },
      {
        key: "userManagement",
        title: "User Management",
        path: "/accounts/user-management",
        description: "Create admin users, assign module access, activate or deactivate users, and manage role permissions.",
        status: "Active",
      },
    ],
  },
  {
    group: "Booking and Gate Operations",
    items: [
      {
        key: "bookings",
        title: "Booking Management",
        path: "/operations/tracking",
        description: "Review booking requests, check yard capacity, assign areas and blocks, approve Gate-In, mark storage, verify payment, approve Gate-Out, and complete release.",
        status: "Active",
      },
      {
        key: "gateAppointment",
        title: "Gate Appointment Setup",
        path: "/operations/pre-advice",
        description: "Set gate slots, truck capacity per schedule, blocked dates, and appointment calendar rules.",
        status: "CMS placeholder",
      },
      {
        key: "gateIn",
        title: "Gate-In Management",
        path: "/operations/gate-in",
        description: "Search approved bookings, verify container details, inspect condition, encode truck and driver details, and approve Gate-In.",
        status: "Active",
      },
    ],
  },
  {
    group: "Yard and Inventory CMS",
    items: [
      {
        key: "yardSetup",
        title: "Yard Area Setup",
        path: "/yard/area-setup",
        description: "Create yard areas using area name, lines, rows, high, container size, capacity TEU, status, and color.",
        status: "Active",
      },
      {
        key: "inventory",
        title: "Inventory Board",
        path: "/yard/inventory",
        description: "Select a yard area, create container blocks, drag/drop blocks for the CMS layout, and view containers that came from Gate-In approved bookings.",
        status: "Active",
      },
      {
        key: "storageMonitoring",
        title: "Storage Monitoring",
        path: "/yard/storage-monitoring",
        description: "Track free days, chargeable days, overstaying containers, aging, occupancy, and storage status.",
        status: "Active",
      },
    ],
  },
  {
    group: "Billing and Release",
    items: [
      {
        key: "rateSetup",
        title: "Rate Setup",
        path: "/billing/rate-setup",
        description: "Manage billing rates by description, unit, container size, container type, rate, effective date, and status.",
        status: "Active",
      },
      {
        key: "paymentVerification",
        title: "Payment Verification",
        path: "/billing/payment-verification",
        description: "Review proof of payment, match payment reference numbers and amounts, approve or reject payments, and unlock client Gate-Out requests.",
        status: "Active",
      },
      {
        key: "gateOut",
        title: "Gate-Out Management",
        path: "/billing/gate-out",
        description: "Validate release requests, confirm payment clearance, perform final inspection, and mark the booking as Completed / Gate-Out Done.",
        status: "Active",
      },
    ],
  },
  {
    group: "Controls and Reports",
    items: [
      {
        key: "blacklist",
        title: "Blacklist Management",
        path: "/settings/security",
        description: "Manage blacklisted containers, clients, trucks, and drivers to block invalid transactions.",
        status: "CMS placeholder",
      },
      {
        key: "chargeHold",
        title: "Charge Hold Management",
        path: "/operations/tracking",
        description: "Place containers on hold, remove holds, add hold reasons, and review hold history.",
        status: "CMS placeholder",
      },
      {
        key: "reports",
        title: "Reports Module",
        path: "/reports/analytics",
        description: "Generate booking, Gate-In, Gate-Out, inventory, storage aging, billing, payment, revenue, customer, and yard occupancy reports.",
        status: "CMS placeholder",
      },
    ],
  },
]

export const flattenedAdminFlowModules = adminFlowModules.flatMap((group) => group.items)

export const statusGroups = [
  {
    title: "Client Profile",
    items: ["Pending Verification", "Rejected", "Resubmitted", "Verified", "Suspended"],
  },
  {
    title: "Booking Status",
    items: ["Pending Admin Approval", "Approved / Area Assigned", "Gate-In Approved", "Stored in Assigned Area", "Gate-Out Requested", "Gate-Out Approved", "Completed / Gate-Out Done"],
  },
  {
    title: "Billing Status",
    items: ["Unpaid", "Payment Submitted", "Payment Under Review", "Paid / Approved"],
  },
  {
    title: "Yard Status",
    items: ["Available", "Reserved", "Occupied", "Blocked", "Maintenance"],
  },
]
