import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import { ThemeProvider } from "@/hooks/useTheme";
import Index from "./pages/Index";
import Import from "./pages/Import";
import Products from "./pages/Products";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import MercadoLivreConnect from "./pages/MercadoLivreConnect";
import MercadoLivreDiagnostics from "./pages/MercadoLivreDiagnostics";
import PublicationDiagnostics from "./pages/PublicationDiagnostics";
import MetricsDashboard from "./pages/MetricsDashboard";
import SecurityLogs from "./pages/SecurityLogs";
import Reports from "./pages/Reports";
import Webhooks from "./pages/Webhooks";
import ProductAnalytics from "./pages/ProductAnalytics";
import ImportStatistics from "./pages/ImportStatistics";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import OrdersQueue from "./pages/OrdersQueue";
import OrdersCronMonitor from "./pages/OrdersCronMonitor";
import SalesDashboard from "./pages/SalesDashboard";
import OperationLogs from "./pages/OperationLogs";
import BuyerAnalytics from "./pages/BuyerAnalytics";
import DemandForecast from "./pages/DemandForecast";
import CampaignHistory from "./pages/CampaignHistory";
import Supplier from "./pages/Supplier";
import Wallet from "./pages/Wallet";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/mercado-livre" element={<MercadoLivreConnect />} />
                <Route path="/mercado-livre/diagnostics" element={<MercadoLivreDiagnostics />} />
                <Route path="/publications/diagnostics" element={<PublicationDiagnostics />} />
                <Route path="/metrics" element={<MetricsDashboard />} />
                <Route path="/analytics" element={<ProductAnalytics />} />
                <Route path="/import-statistics" element={<ImportStatistics />} />
                <Route path="/import" element={<Import />} />
                <Route path="/products" element={<Products />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/:id" element={<OrderDetails />} />
                <Route path="/orders/queue" element={<OrdersQueue />} />
                <Route path="/orders/monitor" element={<OrdersCronMonitor />} />
                <Route path="/sales" element={<SalesDashboard />} />
                <Route path="/buyers" element={<BuyerAnalytics />} />
                <Route path="/demand" element={<DemandForecast />} />
                <Route path="/campaigns" element={<CampaignHistory />} />
                <Route path="/supplier" element={<Supplier />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/events" element={<OperationLogs />} />
                <Route path="/history" element={<History />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/security-logs" element={<SecurityLogs />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/webhooks" element={<Webhooks />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;