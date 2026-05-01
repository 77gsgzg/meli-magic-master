import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Import from "./pages/Import";
import Products from "./pages/Products";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import SessionExpired from "./pages/SessionExpired";
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
import AIImageGenerator from "./pages/AIImageGenerator";
import AITextGenerator from "./pages/AITextGenerator";
import TikTokMiner from "./pages/TikTokMiner";
import TikTokFeed from "./pages/TikTokFeed";
import Admin from "./pages/Admin";
import AdminUserDetail from "./pages/AdminUserDetail";
import Support from "./pages/Support";

const queryClient = new QueryClient();

// Helper to wrap a page in the protected-route guard.
const Private = (el: JSX.Element) => <ProtectedRoute>{el}</ProtectedRoute>;
const AdminOnly = (el: JSX.Element) => (
  <ProtectedRoute requireAdmin>{el}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <Routes>
                {/* Public */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/session-expired" element={<SessionExpired />} />

                {/* Index handles ML OAuth callback + Dashboard. Dashboard itself is protected. */}
                <Route path="/" element={<Index />} />

                {/* Protected routes */}
                <Route path="/mercado-livre" element={Private(<MercadoLivreConnect />)} />
                <Route path="/mercado-livre/diagnostics" element={Private(<MercadoLivreDiagnostics />)} />
                <Route path="/publications/diagnostics" element={Private(<PublicationDiagnostics />)} />
                <Route path="/metrics" element={Private(<MetricsDashboard />)} />
                <Route path="/analytics" element={Private(<ProductAnalytics />)} />
                <Route path="/import-statistics" element={Private(<ImportStatistics />)} />
                <Route path="/import" element={Private(<Import />)} />
                <Route path="/products" element={Private(<Products />)} />
                <Route path="/orders" element={Private(<Orders />)} />
                <Route path="/orders/:id" element={Private(<OrderDetails />)} />
                <Route path="/orders/queue" element={Private(<OrdersQueue />)} />
                <Route path="/orders/monitor" element={Private(<OrdersCronMonitor />)} />
                <Route path="/sales" element={Private(<SalesDashboard />)} />
                <Route path="/buyers" element={Private(<BuyerAnalytics />)} />
                <Route path="/demand" element={Private(<DemandForecast />)} />
                <Route path="/campaigns" element={Private(<CampaignHistory />)} />
                <Route path="/supplier" element={Private(<Supplier />)} />
                <Route path="/wallet" element={Private(<Wallet />)} />
                <Route path="/events" element={Private(<OperationLogs />)} />
                <Route path="/history" element={Private(<History />)} />
                <Route path="/settings" element={Private(<Settings />)} />
                <Route path="/security-logs" element={Private(<SecurityLogs />)} />
                <Route path="/reports" element={Private(<Reports />)} />
                <Route path="/webhooks" element={Private(<Webhooks />)} />
                <Route path="/ai/images" element={Private(<AIImageGenerator />)} />
                <Route path="/ai/texts" element={Private(<AITextGenerator />)} />
                <Route path="/tiktok-miner" element={Private(<TikTokMiner />)} />
                <Route path="/tiktok-feed" element={Private(<TikTokFeed />)} />
                <Route path="/support" element={Private(<Support />)} />

                {/* Admin-only */}
                <Route path="/admin" element={AdminOnly(<Admin />)} />
                <Route path="/admin/user/:id" element={AdminOnly(<AdminUserDetail />)} />

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
