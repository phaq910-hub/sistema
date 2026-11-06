import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Tech from "@/pages/Tech";
import PublicQuote from "@/pages/PublicQuote";
import Tracking from "@/pages/Tracking";
import Receipt from "@/pages/Receipt";
import AdminLayout from "@/components/AdminLayout";
import { DashboardPage, ReviewsPage, TeamMapPage } from "@/pages/admin/Overview";
import { DayRoutePage, TicketsPage } from "@/pages/admin/Tickets";
import { OrdersPage, QuotesPage } from "@/pages/admin/Orders";
import { CatalogPage, ClientsPage, FinancePage, ProductsPage, StaffPage, SuppliersPage, TechniciansPage } from "@/pages/admin/Registers";
import { CompanyPage, PixPage, PlanPage } from "@/pages/admin/Company";
import { WhatsAppPage } from "@/pages/admin/WhatsApp";

// One <Route> per page; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="chamados" element={<TicketsPage />} />
          <Route path="roteiro" element={<DayRoutePage />} />
          <Route path="ordens" element={<OrdersPage />} />
          <Route path="mapa" element={<TeamMapPage />} />
          <Route path="orcamentos" element={<QuotesPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="estoque" element={<ProductsPage />} />
          <Route path="fornecedores" element={<SuppliersPage />} />
          <Route path="financeiro" element={<FinancePage />} />
          <Route path="tecnicos" element={<TechniciansPage />} />
          <Route path="catalogo" element={<CatalogPage />} />
          <Route path="empresa" element={<CompanyPage />} />
          <Route path="plano" element={<PlanPage />} />
          <Route path="funcionarios" element={<StaffPage />} />
          <Route path="pix" element={<PixPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="avaliacoes" element={<ReviewsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
        <Route path="/tecnico" element={<Tech />} />
        <Route path="/orcamento/:id" element={<PublicQuote />} />
        <Route path="/rastreamento/:id" element={<Tracking />} />
        <Route path="/recibo/:id" element={<Receipt />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster richColors />
    </>
  );
}
