import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Journey from "./pages/Journey";
import Onboarding from "./pages/Onboarding";
import Diagnostic from "./pages/Diagnostic";
import Goals from "./pages/Goals";
import Bottlenecks from "./pages/Bottlenecks";
import Tasks from "./pages/Tasks";
import Playbooks from "./pages/Playbooks";
import Pillars from "./pages/Pillars";
import WarRoom from "./pages/WarRoom";
import MentorArea from "./pages/MentorArea";
import StrategistArea from "./pages/StrategistArea";
import University from "./pages/University";
import SocioIA from "./pages/SocioIA";
import Reports from "./pages/Reports";
import ReportSee4X from "./pages/ReportSee4X";
import Certificates from "./pages/Certificates";
import Notifications from "./pages/Notifications";
import AdminUsers from "./pages/AdminUsers";
import AdminCompanies from "./pages/AdminCompanies";
import AdminUniversity from "./pages/AdminUniversity";
import AdminProducts from "./pages/AdminProducts";
import OAuthConsent from "./pages/OAuthConsent";
import Verify from "./pages/Verify";
import NotFound from "./pages/NotFound";
import { ContractProvider } from "./hooks/useContract";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <ContractProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="/validar" element={<Verify />} />
                <Route path="/validar/:code" element={<Verify />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/diagnostico" element={<Diagnostic />} />
                  <Route path="/jornada" element={<Journey />} />
                  <Route path="/metas" element={<Goals />} />
                  <Route path="/gargalos" element={<Bottlenecks />} />
                  <Route path="/plano-acao" element={<Tasks />} />
                  <Route path="/playbooks" element={<Playbooks />} />
                  <Route path="/pilares" element={<Pillars />} />
                  <Route path="/sala-guerra" element={<WarRoom />} />
                  <Route path="/universidade" element={<University />} />
                  <Route path="/socio-ia" element={<SocioIA />} />
                  <Route path="/relatorios" element={<Reports />} />
                  <Route path="/relatorio-see4x" element={<ReportSee4X />} />
                  <Route path="/certificados" element={<Certificates />} />
                  <Route path="/notificacoes" element={<Notifications />} />
                  <Route path="/mentor" element={<ProtectedRoute allow={["super_admin","mentor"]}><MentorArea /></ProtectedRoute>} />
                  <Route path="/estrategista" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><StrategistArea /></ProtectedRoute>} />
                  <Route path="/admin/usuarios" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><AdminUsers /></ProtectedRoute>} />
                  <Route path="/admin/produtos" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><AdminProducts /></ProtectedRoute>} />
                  <Route path="/empresas" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><AdminCompanies /></ProtectedRoute>} />
                  <Route path="/admin/universidade" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><AdminUniversity /></ProtectedRoute>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ContractProvider>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
