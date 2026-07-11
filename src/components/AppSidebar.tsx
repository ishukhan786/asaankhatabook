import {
  Bell,
  Building2,
  ChevronDown,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  Receipt,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Shield,
  UserCog,
  Users,
  Wallet,
  Sparkles,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AsaanKhataLogo } from "@/components/Logo";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: string;
  dot?: boolean;
  adminOnly?: boolean;
  managerOrAdmin?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

export function AppSidebar() {
  const { state } = useSidebar();
  const { t, i18n } = useTranslation();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role, signOut, profile, loading } = useAuth();

  const isActive = (url: string, exact?: boolean) => (exact || url === "/" ? pathname === url : pathname.startsWith(url));

  const sections: NavSection[] = [
    {
      label: "Main Navigation",
      items: [
        { title: t("Dashboard"), url: "/", icon: LayoutDashboard, exact: true },
        { title: t("Accounts"), url: "/accounts", icon: Users },
        { title: t("Transactions"), url: "/transactions", icon: Receipt, dot: true },
      ],
    },
    {
      label: "Financial Management",
      items: [
        { title: t("PayablesReceivables"), url: "/payables-receivables", icon: Wallet, badge: "Live" },
        { title: t("Expenses"), url: "/expenses", icon: Receipt },
        { title: "Recurring", url: "/recurring-transactions", icon: RefreshCw },
        { title: t("Reports"), url: "/reports", icon: FileBarChart },
      ],
    },
    {
      label: "Administration",
      items: [
        { title: t("AdminPanel"), url: "/admin", icon: Shield, adminOnly: true, exact: true },
        { title: t("Users"), url: "/admin/users", icon: UserCog, managerOrAdmin: true },
        { title: t("AuditLogs"), url: "/admin/audit", icon: History, adminOnly: true },
        { title: t("Branches"), url: "/branches", icon: Building2, adminOnly: true },
        { title: t("Settings"), url: "/settings", icon: SettingsIcon },
      ],
    },
  ];

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (item.adminOnly ? role === "admin" : true) &&
          (item.managerOrAdmin ? role === "admin" || role === "branch_manager" : true),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar
      collapsible="icon"
      side={i18n.language === "ur" ? "right" : "left"}
      className="border-r border-sidebar-border text-sidebar-foreground shadow-2xl overflow-hidden"
      style={{
        background: "var(--sidebar-glass-bg)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderRight: "1px solid var(--sidebar-glass-border)",
        boxShadow: "var(--sidebar-glass-shadow)",
      }}
    >
      {/* Liquid glass shimmer overlay */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{
        background: "var(--sidebar-glass-overlay)",
        opacity: 0.6
      }} />
      {/* Top iridescent border line */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px z-10" style={{
        background: "linear-gradient(90deg, transparent 0%, hsl(184 80% 60% / 0.5) 30%, hsl(0 0% 100% / 0.7) 50%, hsl(38 95% 60% / 0.5) 70%, transparent 100%)"
      }} />

      <SidebarHeader className="bg-transparent px-4 py-5 z-10 relative">
        <motion.div
          layout
          className={cn("flex items-center", collapsed ? "justify-center" : "gap-4")}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <AsaanKhataLogo size={42} showText={!collapsed} />
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="premium-sidebar-scroll bg-transparent px-3 py-2 z-10 relative">
        {!collapsed && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="relative mb-5 mx-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search navigation"
              placeholder="Quick search..."
              onClick={() => window.dispatchEvent(new Event("open-search"))}
              className="h-10 rounded-xl pl-10 text-sm placeholder:text-muted-foreground outline-none transition-all duration-300 cursor-pointer"
              style={{
                background: "var(--glass-bg)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid var(--glass-border)",
                boxShadow: "0 1px 0 hsl(0 0% 100% / 0.6) inset, 0 2px 8px -2px hsl(184 80% 22% / 0.1)",
              }}
              readOnly
            />
            <kbd className="pointer-events-none absolute right-2.5 top-[50%] -translate-y-[50%] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">Ctrl</span>K
            </kbd>
          </motion.div>
        )}

        <div className="space-y-6">
          {visibleSections.map((section) => (
            <nav key={section.label} aria-label={section.label} className="space-y-2">
              {!collapsed && (
                <div className="px-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1 dark:text-slate-500/80">
                  {section.label}
                </div>
              )}
              <SidebarMenu className="gap-1">
                {section.items.map((item) => {
                  const active = isActive(item.url, item.exact);
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title} className="h-11 rounded-xl p-0 hover:bg-transparent">
                        <NavLink
                          to={item.url}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex h-11 w-full items-center overflow-hidden rounded-xl border text-sm font-medium outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/60",
                            collapsed ? "justify-center px-0" : "gap-3 px-3",
                          )}
                          style={active ? {
                            background: "var(--glass-bg-hover)",
                            backdropFilter: "blur(16px)",
                            WebkitBackdropFilter: "blur(16px)",
                            borderColor: "var(--glass-border)",
                            boxShadow: "inset 2px 0 0 hsl(var(--primary)), 0 0 0 1px hsl(0 0% 100% / 0.5) inset, 0 4px 12px -4px hsl(184 80% 22% / 0.15)",
                          } : {
                            borderColor: "transparent",
                          }}
                        >
                          {active && (
                            <motion.div
                              layoutId="sidebar-active-glow"
                              className="absolute inset-0 pointer-events-none"
                              style={{ background: "linear-gradient(105deg, hsl(184 80% 60% / 0.08) 0%, hsl(0 0% 100% / 0.12) 50%, transparent 100%)" }}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}
                          {/* Hover glass overlay */}
                          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                            style={{
                              background: "var(--glass-bg)",
                              backdropFilter: "blur(12px)",
                              borderColor: "var(--glass-border)",
                            }}
                          />
                          <motion.span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 relative z-10",
                              active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
                            )}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.5 : 2} />
                          </motion.span>
                          {!collapsed && (
                            <>
                              <span className={cn("min-w-0 flex-1 truncate transition-colors relative z-10", active ? "font-bold tracking-wide text-sidebar-foreground" : "font-medium text-muted-foreground group-hover:text-sidebar-foreground")}>
                                {item.title}
                              </span>
                              {item.badge && (
                                <span className="relative z-10 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                  style={{
                                    background: "var(--glass-bg)",
                                    border: "1px solid var(--glass-border)",
                                    color: "hsl(var(--primary))",
                                  }}
                                >
                                  {item.badge}
                                </span>
                              )}
                              {item.dot && <span className="relative z-10 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />}
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          ))}
        </div>
      </SidebarContent>

      <SidebarFooter className="pt-3 pb-4 px-3 z-10 relative" style={{ background: "transparent" }}>
        {/* Footer top border */}
        <div className="absolute top-0 left-3 right-3 h-px" style={{ background: "var(--glass-border)" }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group flex w-full items-center rounded-xl text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/50",
                collapsed ? "justify-center p-2" : "gap-3 p-2.5",
              )}
              style={{
                background: "var(--glass-bg)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid var(--glass-border)",
                boxShadow: "0 1px 0 hsl(0 0% 100% / 0.7) inset, 0 4px 12px -4px hsl(184 80% 22% / 0.12)",
              }}
              aria-label="Open user menu"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sidebar-border bg-sidebar dark:border-white/10 dark:bg-[#09111c]">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                ) : (
                  <UserCog className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-sidebar-foreground dark:text-slate-300 dark:group-hover:text-white" />
                )}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-sidebar-foreground transition-colors dark:text-slate-200 dark:group-hover:text-white">{profile?.full_name ?? "User"}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-sidebar-foreground dark:bg-white/10 dark:text-slate-400 dark:group-hover:text-slate-300">
                        {role?.replace("_", " ") ?? "Guest"}
                      </span>
                      {loading && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180 group-hover:text-sidebar-foreground dark:text-slate-500 dark:group-hover:text-slate-300" />
                </>
              )}
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56 backdrop-blur-2xl shadow-2xl rounded-xl" style={{ background: "var(--glass-bg-hover)", border: "1px solid var(--glass-border)", boxShadow: "var(--glass-glow-hover)" }}>
            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border dark:bg-white/10" />
            <DropdownMenuItem onClick={() => toast.info("Notifications system is coming soon!")} className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground cursor-pointer rounded-lg m-1 transition-colors dark:focus:bg-white/10 dark:focus:text-white">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")} className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground cursor-pointer rounded-lg m-1 transition-colors dark:focus:bg-white/10 dark:focus:text-white">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={signOut}
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn(
            "mt-3 h-11 rounded-xl text-muted-foreground transition-all duration-300 hover:bg-destructive/15 hover:text-destructive hover:shadow-[0_0_15px_-5px_rgba(var(--destructive),0.4)] dark:text-slate-400",
            collapsed ? "w-full" : "w-full justify-start px-3",
          )}
        >
          <LogOut className={cn("h-[18px] w-[18px]", !collapsed && "mr-2.5")} strokeWidth={2} />
          {!collapsed && <span className="font-semibold text-sm">{t("SignOut")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
