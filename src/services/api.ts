import axios from "axios";

// Create the configured Axios instance
export const api = axios.create({
  baseURL: "", // empty base URL relative to current running dev server proxy on Port 3000
  timeout: 60000, // 60 seconds timeout
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Authentication Interceptor: injects Bearer Token from localStorage before each request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("crunch_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Automatically extract CSRF token from cookie and inject header
    const match = document.cookie.match(/(^|;)\s*_csrf\s*=\s*([^;]+)/);
    const csrfToken = match ? match[2] : null;
    if (csrfToken && config.headers) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Error Interceptor: intercepts 401 Unauthorized errors and can handle global logging/redirects
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Look for authentication / token expiration errors
    if (error.response) {
      const { status } = error.response;
      
      if (status === 401) {
        console.warn("⚠️ API Client unauthorized: token may be expired or invalid.");
        // Clear local storage and let Zustand store catch up or redirect if needed
        localStorage.removeItem("crunch_token");
        localStorage.removeItem("crunch_user");
      } else if (status === 403) {
        console.error("🚫 Access Forbidden.");
      } else if (status >= 500) {
        console.error("🔥 Internal server error from backend API.");
      }
    } else if (error.request) {
      console.error("📡 Network issue. Unable to connect to the server.");
    } else {
      console.error("💥 Error setting up request:", error.message);
    }
    
    return Promise.reject(error);
  }
);
export default api;
