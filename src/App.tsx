import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import AppLayout from "@/components/AppLayout";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import NewAccount from "./pages/NewAccount";
import AccountDetail from "./pages/AccountDetail";
import Transactions from "./pages/Transactions";
import NewTransaction from "./pages/NewTransaction";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Branches from "./pages/Branches";
import BranchDetail from "./pages/BranchDetail";
import AdminPanel from "./pages/AdminPanel";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";
import PayablesReceivables from "./pages/PayablesReceivables";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HashRouter>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/accounts/new" element={<NewAccount />} />
                  <Route path="/accounts/:id" element={<AccountDetail />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/transactions/new" element={<NewTransaction />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/branches" element={<Branches />} />
                  <Route path="/branches/:id" element={<BranchDetail />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/audit" element={<AuditLogs />} />
                  <Route path="/payables-receivables" element={<PayablesReceivables />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </HashRouter>
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};


export default App;
