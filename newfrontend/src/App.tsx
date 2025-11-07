import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ReportDashboardPage from "./pages/ReportDashboardPage";
import ReportEditorPage from "./pages/ReportEditorPage";
import InstructionsPage from "./pages/InstructionsPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/MainLayout";
import useStore from "./store";
import "./lib/axios"; // Initialize axios interceptors

const queryClient = new QueryClient();

const App = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Redirect root based on auth status */}
            <Route
              path="/"
              element={
                isAuthenticated ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />
              }
            />

            {/* Public route - redirect if already logged in */}
            <Route
              path="/login"
              element={
                isAuthenticated ? <Navigate to="/home" replace /> : <AuthPage />
              }
            />

            {/* Protected routes wrapped in MainLayout */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <HomePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/dashboard"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ReportDashboardPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/:id"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ReportEditorPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructions"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <InstructionsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
