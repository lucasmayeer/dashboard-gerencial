import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ReportsHub from "./pages/ReportsHub";
import DirectSalesIndex from "./pages/DirectSalesIndex";
import BSAIndex from "./pages/BSAIndex";
import TvModeIndex from "./pages/TvModeIndex";
import PublicHub from "./pages/PublicHub";

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/welcome"                        element={<PublicHub />} />
    <Route path="/login"                          element={<Navigate to="/welcome" replace />} />
    <Route path="/reports"                        element={<ReportsHub />} />
    <Route path="/"                               element={<Navigate to="/welcome" replace />} />
    <Route path="/facilities"                     element={<Index />} />
    <Route path="/facilities-visao-geral"         element={<Index page="overview" />} />
    <Route path="/facilities-temporal"            element={<Index page="temporal" />} />
    <Route path="/facilities-detalhamento"        element={<Index page="detail" />} />
    <Route path="/facilities-estoque"             element={<Index page="estoque" />} />
    <Route path="/direct-sales-desempenho-mensal" element={<DirectSalesIndex page="desempenho" />} />
    <Route path="/direct-sales"                   element={<Navigate to="/direct-sales-desempenho-mensal" replace />} />
    <Route path="/direct-sales/ranking"           element={<DirectSalesIndex page="ranking" />} />
    <Route path="/direct-sales/ranking-historico" element={<DirectSalesIndex page="ranking-historico" />} />
    <Route path="/direct-sales/temporal"          element={<DirectSalesIndex page="temporal" />} />
    <Route path="/bsa"                            element={<BSAIndex page="resumo-horas" />} />
    <Route path="/bsa/ranking"                    element={<BSAIndex page="ranking" />} />
    <Route path="/bsa/departamento"               element={<BSAIndex page="departamento" />} />
    <Route path="/tv-mode"                        element={<TvModeIndex />} />
    <Route path="*"                               element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
