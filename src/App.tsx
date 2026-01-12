import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Import from "./pages/Import";
import Products from "./pages/Products";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import MercadoLivreConnect from "./pages/MercadoLivreConnect";
import MercadoLivreDiagnostics from "./pages/MercadoLivreDiagnostics";
import SecurityLogs from "./pages/SecurityLogs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/mercado-livre" element={<MercadoLivreConnect />} />
            <Route path="/mercado-livre/diagnostics" element={<MercadoLivreDiagnostics />} />
            <Route path="/import" element={<Import />} />
            <Route path="/products" element={<Products />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/security-logs" element={<SecurityLogs />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
