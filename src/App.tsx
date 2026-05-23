import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import AppLayout from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Accounts = lazy(() => import("./pages/Accounts"));
const NewAccount = lazy(() => import("./pages/NewAccount"));
const AccountDetail = lazy(() => import("./pages/AccountDetail"));
const Transactions = lazy(() => import("./pages/Transactions"));
const NewTransaction = lazy(() => import("./pages/NewTransaction"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Branches = lazy(() => import("./pages/Branches"));
const BranchDetail = lazy(() => import("./pages/BranchDetail"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const PayablesReceivables = lazy(() => import("./pages/PayablesReceivables"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
              </Suspense>
            </AuthProvider>
          </HashRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};


export default App;
