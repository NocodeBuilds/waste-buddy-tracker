import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteProvider } from "@/contexts/SiteContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineBanner from "@/components/OfflineBanner";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Persist query cache to localStorage so data survives page reloads.
// Only data is persisted — loading/error/gc states are excluded by default.
const localStoragePersister = createAsyncStoragePersister({
  storage: window.localStorage,
  key: "WASTEBUDDY_QUERY_CACHE",
});

const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: localStoragePersister }}>
    <TooltipProvider>
      <Sonner />
      <InstallPrompt />
      <OfflineBanner />
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <SiteProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin" element={<AdminAuth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SiteProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
