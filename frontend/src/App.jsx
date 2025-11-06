// App.jsx
import { useState, useEffect } from "react";
import { ConfigProvider, theme, App as AntApp } from "antd";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import axios from "axios";
import AuthPage from "./pages/AuthPage/AuthPage";
import MainLayout from "./pages/layout/main/MainLayout";
import useStore from "./store";
import SessionExpiredPage from "./pages/global/SessionExpiredPage";

// Theme wrapper to ensure Ant Design theme and CSS are connected
const { useToken } = theme;
const ThemeWrapper = ({ children }) => {
  const { token } = useToken();

  return (
    <div
      style={{
        "--primary": token.colorPrimary,
        "--primary-hover": token.colorPrimaryHover,
        "--primary-active": token.colorPrimaryActive,
        "--primary-highlight": token.colorPrimaryHighlight,
        "--primary-highlight-hover": token.colorPrimaryHighlightHover,
        "--primary-bg": token.colorPrimaryBg,
        "--bg-base": token.colorBgBase,
        "--bg-container": token.colorBgContainer,
        "--bg-elevated": token.colorBgElevated,
        "--text": token.colorText,
        "--text-secondary": token.colorTextSecondary,
      }}
    >
      {children}
    </div>
  );
};

// Inner component that can use App.useApp() hook
const AppContent = ({ isDarkMode: isDarkModeOn, setIsDarkMode }) => {
  const { notification } = AntApp.useApp();
  const { isAuthenticated, logout, setUser } = useStore();

  const [loginError, setLoginError] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const validateTokenAndFetchUser = async () => {
      const storedState = JSON.parse(
        localStorage.getItem("notescribe") || "{}"
      );
      const storedToken = storedState.token;

      if (!storedToken) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        // Try to validate token and fetch user data
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/auth/users/me`,
          {
            headers: { Authorization: `Bearer ${storedToken}` },
            timeout: 10000, // 10 second timeout
          }
        );
        setUser(response.data);
      } catch (error) {
        // Only logout on specific auth failures, not network errors
        if (error.response) {
          // Server responded with an error status
          if (error.response.status === 401 || error.response.status === 403) {
            logout();
            window.location.pathname = `${
              import.meta.env.VITE_PUBLIC_URL
            }/session-expired`;
          } else {
            // Other server error - keep user logged in but show warning
            console.warn(
              "Server error during token validation:",
              error.response.status
            );
            notification.warning({
              message: "Connection Issue",
              description:
                "Could not verify your session, but you remain logged in.",
              duration: 3,
            });
          }
        } else {
          // Network error or timeout - keep user logged in
          console.warn("Network error during token validation:", error.message);
          notification.warning({
            message: "Connection Issue",
            description:
              "Could not verify your session due to network issues, but you remain logged in.",
            duration: 3,
          });
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    validateTokenAndFetchUser();
  }, [logout, setUser, notification]);

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
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

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Log the failing endpoint and status for diagnostics
        if (error.response) {
          const status = error.response.status;
          const failingUrl = error?.response?.config?.url || error?.config?.url;
          console.warn("API error intercepted", { status, url: failingUrl });

          // Only treat 401 as a definitive auth failure that should force logout.
          // A 403 (forbidden) usually means the user lacks permission for a specific
          // endpoint (e.g., admin-only) and should not automatically clear the session.
          if (status === 401) {
            const currentlyAuthenticated = useStore.getState().isAuthenticated;
            useStore.getState().logout();

            if (currentlyAuthenticated)
              window.location.pathname = `${
                import.meta.env.VITE_PUBLIC_URL
              }/session-expired`;
          }
          // For 403 we don't logout; let the caller handle permission errors.
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const handleLogin = async (credentials) => {
    try {
      const params = new URLSearchParams();
      params.append("grant_type", "password");
      params.append("username", credentials.username);
      params.append("password", credentials.password);
      params.append("scope", "");
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/auth/token`,
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const accessToken = response.data.access_token;

      // Fetch user profile after getting token
      const userResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/auth/users/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      setLoginError(null);
      return { token: accessToken, user: userResponse.data };
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("Invalid username or password");
    }
  };

  const handleLogout = () => {
    logout();

    notification.info({
      message: "Logged Out",
      description: "You have been logged out successfully.",
      duration: 2,
    });
  };

  if (isCheckingAuth) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <Router basename={import.meta.env.VITE_PUBLIC_URL}>
      <Routes>
        <Route path="/session-expired" element={<SessionExpiredPage />} />

        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <AuthPage
                onLogin={handleLogin}
                loginError={loginError}
                isDarkMode={isDarkModeOn}
              />
            )
          }
        />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <MainLayout
                onLogout={handleLogout}
                isDarkMode={isDarkModeOn}
                setIsDarkMode={setIsDarkMode}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
};

// Main App component with theme and App wrapper
const App = () => {
  const [isDarkModeOn, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    return savedMode !== null
      ? savedMode === "true"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDarkModeOn) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("darkMode", isDarkModeOn);
  }, [isDarkModeOn]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkModeOn ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          // Primary stays the same
          colorPrimary: "hsl(260, 100%, 55%)",

          // Hover: lighten + tiny desat (light mode) / brighten (dark mode)
          colorPrimaryHover: isDarkModeOn
            ? "hsl(260, 100%, 70%)" // brighter pop on dark
            : "hsl(260, 95%, 63%)", // softer light tint

          // Active: darker for press feedback
          colorPrimaryActive: isDarkModeOn
            ? "hsl(260, 100%, 50%)"
            : "hsl(260, 100%, 47%)",

          // Subtle background usage (tags, filled backgrounds, etc.)
          colorPrimaryBg: isDarkModeOn
            ? "hsl(260, 60%, 22%)" // muted dark tint
            : "hsl(260, 90%, 94%)", // very light wash

          colorPrimaryHighlight: isDarkModeOn
            ? "hsla(260, 100%, 75%, 0.22)"
            : "hsla(260, 100%, 55%, 0.16)",

          colorPrimaryHighlightHover: isDarkModeOn
            ? "hsla(260, 100%, 80%, 0.32)"
            : "hsla(260, 100%, 55%, 0.24)",

          // Backgrounds
          colorBgBase: isDarkModeOn ? "hsl(0,0%,0%)" : "hsl(0,0%,90%)",
          colorBgContainer: isDarkModeOn ? "hsl(0,0%,10%)" : "hsl(0,0%,100%)",
          colorBgElevated: isDarkModeOn ? "hsl(0,0%,15%)" : "hsl(0,0%,100%)",

          // Text
          colorText: isDarkModeOn ? "hsl(0,0%,95%)" : "hsl(0,0%,5%)",
          colorTextSecondary: isDarkModeOn ? "hsl(0,0%,70%)" : "hsl(0,0%,30%)",
        },
        components: {
          Modal: {
            contentBg: isDarkModeOn ? "hsl(0,0%,10%)" : "hsl(0,0%,100%)",
            headerBg: isDarkModeOn ? "hsl(0,0%,10%)" : "hsl(0,0%,100%)",
          },
          Button: {
            borderRadius: 32,
            styles: {
              button: {
                transition:
                  "color 0.3s ease-in-out, background-color 0.3s ease-in-out, border-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out",
              },
            },
          },
          Card: {
            styles: {
              body: {
                transition: "all 0.3s ease-in-out",
              },
            },
            hoverable: {
              boxShadow:
                "0 10px 15px -3px hsla(260, 100%, 55%, 0.18), 0 4px 6px -2px hsla(260, 100%, 55%, 0.1)",
            },
          },
        },
      }}
    >
      <ThemeWrapper>
        <AntApp>
          <AppContent isDarkMode={isDarkModeOn} setIsDarkMode={setIsDarkMode} />
        </AntApp>
      </ThemeWrapper>
    </ConfigProvider>
  );
};

export default App;
