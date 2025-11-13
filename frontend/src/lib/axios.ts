import axios from "axios";
import useStore from "@/store";

// Set base URL
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL;

// Request interceptor - add auth token to all requests
axios.interceptors.request.use(
  (config) => {
    const token = useStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log the failing endpoint and status for diagnostics
    if (error.response) {
      const status = error.response.status;
      const failingUrl = error?.response?.config?.url || error?.config?.url;
      console.warn("API error intercepted", { status, url: failingUrl });

      // Only treat 401 as a definitive auth failure that should force logout
      if (status === 401) {
        const currentlyAuthenticated = useStore.getState().isAuthenticated;
        useStore.getState().logout();

        if (currentlyAuthenticated) {
          window.location.pathname = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axios;
