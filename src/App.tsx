import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ContractProvider } from "./hooks/useContract";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Journey = lazy(() => import("./pages/Journey"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Diagnostic = lazy(() => import("./pages/Diagnostic"));
const Goals = lazy(() => import("./pages/Goals"));
const Bottlenecks = lazy(() => import("./pages/Bottlenecks"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Playbooks = lazy(() => import("./pages/Playbooks"));
const Pillars = lazy(() => import("./pages/Pillars"));
const WarRoom = lazy(() => import("./pages/WarRoom"));
const MentorArea = lazy(() => import("./pages/MentorArea"));
const StrategistArea = lazy(() => import("./pages/StrategistArea"));
const University = lazy(() => import("./pages/University"));
const SocioIA = lazy(() => import("./pages/SocioIA"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportSee4X = lazy(() => import("./pages/ReportSee4X"));
const Certificates = lazy(() => import("./pages/Certificates"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminCompanies = lazy(() => import("./pages/AdminCompanies"));
const AdminUniversity = lazy(() => import("./pages/AdminUniversity"));
const AdminProducts = lazy(() => import("./pages/AdminProducts"));
const CRM = lazy(() => import("./pages/CRM"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const Verify = lazy(() => import("./pages/Verify"));
const DiagnosticRespond = lazy(() => import("./pages/DiagnosticRespond"));
const LeadDiagnostic = lazy(() => import("./pages/LeadDiagnostic"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-muted-foreground" role="status" aria-live="polite">
      Carregando…
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <ContractProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                  <Route path="/diagnostico-lead" element={<LeadDiagnostic />} />
                  <Route path="/diagnostico-lead/:token" element={<LeadDiagnostic />} />
                  <Route path="/responder/:token" element={<DiagnosticRespond />} />
                  <Route path="/validar" element={<Verify />} />
                  <Route path="/validar/:code" element={<Verify />} />
                  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/diagnostico" element={<Diagnostic />} />
                    <Route path="/jornada" element={<Journey />} />
                    <Route path="/onboarding" element={<Onboarding />} />
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
                    <Route path="/crm" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><CRM /></ProtectedRoute>} />
                    <Route path="/mentor" element={<ProtectedRoute allow={["super_admin","mentor"]}><MentorArea /></ProtectedRoute>} />
                    <Route path="/estrategista" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><StrategistArea /></ProtectedRoute>} />
                    <Route path="/admin/usuarios" element={<ProtectedRoute allow={["super_admin"]}><AdminUsers /></ProtectedRoute>} />
                    <Route path="/admin/produtos" element={<ProtectedRoute allow={["super_admin"]}><AdminProducts /></ProtectedRoute>} />
                    <Route path="/empresas" element={<ProtectedRoute allow={["super_admin","mentor"]}><AdminCompanies /></ProtectedRoute>} />
                    <Route path="/admin/universidade" element={<ProtectedRoute allow={["super_admin"]}><AdminUniversity /></ProtectedRoute>} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ContractProvider>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
