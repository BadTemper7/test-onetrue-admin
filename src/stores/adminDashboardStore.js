import { create } from "zustand";
import { api, getApiError } from "../lib/api";

const emptyMetrics = {
  containersReceived: 0,
  containersReleased: 0,
  currentInventory: 0,
  localContainers: 0,
  availableYardCapacity: 0,
  totalYardCapacity: 0,
  occupiedYardCapacity: 0,
  occupancyRate: null,
  averageOccupancyRate: null,
  currentOccupancyRate: null,
  revenue: 0,
  revenueSubtotal: 0,
  revenueVat: 0,
  overstayingContainers: 0,
  topCustomer: null,
};

// A slower previous-period request must never overwrite the newest selection.
let latestRequest = 0;

export const useAdminDashboardStore = create((set, get) => ({
  period: "daily",
  customRange: { startDate: "", endDate: "" },
  metrics: emptyMetrics,
  bookingSummary: {},
  recentAccounts: [],
  pendingClients: 0,
  range: null,
  trend: { granularity: "hour", series: [] },
  generatedAt: "",
  loading: false,
  error: "",

  setPeriod: (period) => {
    if (period === "custom") return; // Requires validated start and end dates.
    set({ period });
    return get().fetchDashboard(period);
  },

  applyCustomRange: ({ startDate, endDate }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "") || startDate > endDate) {
      set({ error: "Select a valid start and end date." });
      return;
    }
    set({ period: "custom", customRange: { startDate, endDate } });
    return get().fetchDashboard("custom");
  },

  fetchDashboard: async (periodOverride) => {
    const period = periodOverride || get().period || "daily";
    const { customRange } = get();
    const params = period === "custom"
      ? { period, startDate: customRange.startDate, endDate: customRange.endDate }
      : { period };
    const request = ++latestRequest;
    set({ loading: true, error: "", period });

    try {
      const { data } = await api.get("/admin/dashboard", { params });
      if (request !== latestRequest) return;
      set({
        metrics: data.metrics || emptyMetrics,
        bookingSummary: data.bookingSummary || {},
        recentAccounts: data.recentAccounts || [],
        pendingClients: Number(data.pendingClients) || 0,
        range: data.range || null,
        trend: data.trend || { granularity: "hour", series: [] },
        generatedAt: data.generatedAt || "",
        loading: false,
        error: "",
      });
    } catch (error) {
      if (request !== latestRequest) return;
      set({
        metrics: emptyMetrics,
        bookingSummary: {},
        recentAccounts: [],
        pendingClients: 0,
        range: null,
        trend: { granularity: "hour", series: [] },
        loading: false,
        error: getApiError(error),
      });
    }
  },
}));
