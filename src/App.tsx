import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteProvider } from "@/contexts/SiteContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import InstallPrompt from "@/components/layout/InstallPrompt";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      networkMode: "offlineFirst",
      refetchOnWindowFocus: true,
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

function EntryRedirect() { const location = useLocation(); return <Navigate to={"/app" + location.search} replace />; }

const App = () => !isSupabaseConfigured ? <main role="alert" className="p-8">Application configuration is missing. Set the Supabase URL and publishable key, then rebuild.</main> : (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <SiteProvider>
              <Routes>
                <Route path="/" element={<EntryRedirect />} />
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
  </QueryClientProvider>
);

export default App;
