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
import Goals from "./pages/Goals";
import Bottlenecks from "./pages/Bottlenecks";
import Pillars from "./pages/Pillars";
import WarRoom from "./pages/WarRoom";
import MentorArea from "./pages/MentorArea";
import StrategistArea from "./pages/StrategistArea";
import University from "./pages/University";
import SocioIA from "./pages/SocioIA";
import Reports from "./pages/Reports";
import Certificates from "./pages/Certificates";
import Notifications from "./pages/Notifications";
import AdminUsers from "./pages/AdminUsers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/jornada" element={<Journey />} />
                <Route path="/metas" element={<Goals />} />
                <Route path="/gargalos" element={<Bottlenecks />} />
                <Route path="/pilares" element={<Pillars />} />
                <Route path="/sala-guerra" element={<WarRoom />} />
                <Route path="/universidade" element={<University />} />
                <Route path="/socio-ia" element={<SocioIA />} />
                <Route path="/relatorios" element={<Reports />} />
                <Route path="/certificados" element={<Certificates />} />
                <Route path="/notificacoes" element={<Notifications />} />
                <Route path="/mentor" element={<ProtectedRoute allow={["super_admin","mentor"]}><MentorArea /></ProtectedRoute>} />
                <Route path="/estrategista" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><StrategistArea /></ProtectedRoute>} />
                <Route path="/admin/usuarios" element={<ProtectedRoute allow={["super_admin","mentor","estrategista"]}><AdminUsers /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
