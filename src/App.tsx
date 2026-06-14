import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import AppLayout from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const Auth = lazyWithRetry(() => import("./pages/Auth"), "auth");
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "dashboard");
const Accounts = lazyWithRetry(() => import("./pages/Accounts"), "accounts");
const NewAccount = lazyWithRetry(() => import("./pages/NewAccount"), "new-account");
const AccountDetail = lazyWithRetry(() => import("./pages/AccountDetail"), "account-detail");
const Transactions = lazyWithRetry(() => import("./pages/Transactions"), "transactions");
const NewTransaction = lazyWithRetry(() => import("./pages/NewTransaction"), "new-transaction");
const Expenses = lazyWithRetry(() => import("./pages/Expenses"), "expenses");
const Reports = lazyWithRetry(() => import("./pages/Reports"), "reports");
const Settings = lazyWithRetry(() => import("./pages/Settings"), "settings");
const Branches = lazyWithRetry(() => import("./pages/Branches"), "branches");
const BranchDetail = lazyWithRetry(() => import("./pages/BranchDetail"), "branch-detail");
const AdminPanel = lazyWithRetry(() => import("./pages/AdminPanel"), "admin-panel");
const AdminUsers = lazyWithRetry(() => import("./pages/AdminUsers"), "admin-users");
const AuditLogs = lazyWithRetry(() => import("./pages/AuditLogs"), "audit-logs");
const PayablesReceivables = lazyWithRetry(() => import("./pages/PayablesReceivables"), "payables-receivables");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "not-found");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageFallback = () => (
  <div className="p-4 md:p-8 space-y-4">
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HashRouter>
            <AuthProvider>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/auth/*" element={<Auth />} />
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
              </Suspense>
            </AuthProvider>
          </HashRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
