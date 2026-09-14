import { create } from "zustand";
import { api, getApiError } from "../lib/api";

export const useBookingStore = create((set, get) => ({
  bookings: [],
  loading: false,
  submitting: false,
  error: "",

  fetchBookings: async () => {
    set({ loading: true, error: "" });
    try {
      const { data } = await api.get("/client/bookings");
      set({ bookings: data.bookings || [], loading: false });
      return data.bookings || [];
    } catch (error) {
      set({ loading: false, error: getApiError(error) });
      throw error;
    }
  },

  createBooking: async (payload) => {
    set({ submitting: true, error: "" });
    try {
      const isMultipart = typeof FormData !== "undefined" && payload instanceof FormData;
      const { data } = await api.post(
        "/client/bookings",
        payload,
        isMultipart ? { headers: { "Content-Type": "multipart/form-data" } } : undefined,
      );
      set({
        bookings: [data.booking, ...get().bookings],
        submitting: false,
      });
      return data;
    } catch (error) {
      set({ submitting: false, error: getApiError(error) });
      throw error;
    }
  },

  requestGateOut: async (bookingId, payload) => {
    set({ submitting: true, error: "" });
    try {
      const { data } = await api.post(
        `/client/bookings/${bookingId}/gate-out-request`,
        payload,
      );
      set({
        bookings: get().bookings.map((item) =>
          item.id === bookingId ? data.booking : item,
        ),
        submitting: false,
      });
      return data;
    } catch (error) {
      set({ submitting: false, error: getApiError(error) });
      throw error;
    }
  },

  requestGateOutReversal: async (bookingId, payload) => {
    set({ submitting: true, error: "" });
    try {
      const { data } = await api.post(
        `/client/bookings/${bookingId}/gate-out-reversal-request`,
        payload,
      );
      set({
        bookings: get().bookings.map((item) =>
          item.id === bookingId ? data.booking : item,
        ),
        submitting: false,
      });
      return data;
    } catch (error) {
      set({ submitting: false, error: getApiError(error) });
      throw error;
    }
  },

  submitPayment: async (bookingId, payload) => {
    set({ submitting: true, error: "" });
    try {
      const formData = new FormData();
      if (payload.paymentTypeId) formData.append("paymentTypeId", payload.paymentTypeId);
      if (payload.paymentReferenceNumber) formData.append("paymentReferenceNumber", payload.paymentReferenceNumber);
      if (payload.paymentRemarks) formData.append("paymentRemarks", payload.paymentRemarks);
      formData.append("isVatApplicable", String(payload.isVatApplicable !== false));
      if (payload.paymentProof) formData.append("paymentProof", payload.paymentProof);

      const { data } = await api.post(
        `/client/bookings/${bookingId}/payment`,
        formData,
      );
      set({
        bookings: get().bookings.map((item) =>
          item.id === bookingId ? data.booking : item,
        ),
        submitting: false,
      });
      return data;
    } catch (error) {
      set({ submitting: false, error: getApiError(error) });
      throw error;
    }
  },

  clearError: () => set({ error: "" }),
}));
