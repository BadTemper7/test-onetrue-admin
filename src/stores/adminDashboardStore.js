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
  occupancyRate: 0,
  averageOccupancyRate: 0,
  currentOccupancyRate: 0,
  revenue: 0,
  revenueSubtotal: 0,
  revenueVat: 0,
  overstayingContainers: 0,
  topCustomer: null,
};

export const useAdminDashboardStore = create((set, get) => ({
  period: "daily",
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
    set({ period });
    return get().fetchDashboard(period);
  },

  fetchDashboard: async (periodOverride) => {
    const period = periodOverride || get().period || "daily";
    set({ loading: true, error: "", period });

    try {
      const { data } = await api.get("/admin/dashboard", { params: { period } });
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
