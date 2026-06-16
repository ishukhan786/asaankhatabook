import {
  Bell,
  Building2,
  ChevronDown,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  Receipt,
  Search,
  Settings as SettingsIcon,
  Shield,
  UserCog,
  Users,
  Wallet,
  Sparkles,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
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
        { title: t("Expenses"), url: "/expenses", icon: Wallet },
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
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl dark:bg-gradient-to-b dark:from-[#09111c] dark:to-[#04080c]"
    >
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-10%] left-[-20%] w-[150%] h-[50%] bg-primary/5 rounded-[100%] blur-[80px] pointer-events-none overflow-hidden" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[150%] h-[50%] bg-primary/5 dark:bg-blue-500/5 rounded-[100%] blur-[100px] pointer-events-none overflow-hidden" />

      <SidebarHeader className="bg-transparent px-4 py-6 z-10">
        <motion.div
          layout
          className={cn("flex items-center", collapsed ? "justify-center" : "gap-4")}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 shadow-[0_0_25px_-5px_rgba(var(--primary),0.6)] border border-sidebar-border overflow-hidden group">
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Wallet className="h-6 w-6 text-white drop-shadow-md z-10" strokeWidth={2} />
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[2.5px] border-sidebar bg-emerald-400 z-20 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="min-w-0">
              <div className="truncate font-display text-xl font-bold tracking-tight text-sidebar-foreground dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:to-white/70">
                AsaanKhata
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Ledger Suite</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="premium-sidebar-scroll bg-transparent px-3 py-2 z-10">
        {!collapsed && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="relative mb-6 mx-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-400" />
            <Input
              aria-label="Search navigation"
              placeholder="Quick search..."
              className="h-11 rounded-2xl border-sidebar-border bg-sidebar-accent/60 pl-10 text-sm text-sidebar-foreground placeholder:text-muted-foreground shadow-inner outline-none transition-all duration-300 focus-visible:bg-sidebar-accent focus-visible:ring-1 focus-visible:ring-sidebar-ring/50 focus-visible:border-sidebar-ring/50 hover:bg-sidebar-accent dark:border-white/5 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-400 dark:focus-visible:bg-white/[0.05] dark:hover:bg-white/[0.05]"
            />
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
                      <SidebarMenuButton asChild tooltip={item.title} className="h-12 rounded-2xl p-0 hover:bg-transparent">
                        <NavLink
                          to={item.url}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex h-12 w-full items-center overflow-hidden rounded-2xl border border-transparent text-sm font-medium outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/60",
                            collapsed ? "justify-center px-0" : "gap-3 px-3",
                            active
                              ? "bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border-sidebar-border text-sidebar-foreground shadow-[inset_2px_0_0_0_hsl(var(--primary))] dark:border-white/5 dark:text-white"
                              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white",
                          )}
                        >
                          {active && (
                            <motion.div
                              layoutId="sidebar-active-glow"
                              className="absolute inset-0 bg-primary/5 pointer-events-none"
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}
                          <motion.span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 relative z-10",
                              active ? "text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.8)]" : "text-muted-foreground group-hover:text-sidebar-accent-foreground dark:text-slate-400 dark:group-hover:text-white",
                            )}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                          </motion.span>
                          {!collapsed && (
                            <>
                              <span className={cn("min-w-0 flex-1 truncate transition-colors relative z-10", active ? "font-bold tracking-wide" : "font-medium")}>
                                {item.title}
                              </span>
                              {item.badge && (
                                <span className="relative z-10 rounded-full bg-gradient-to-r from-primary/30 to-blue-500/30 border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.2)]">
                                  {item.badge}
                                </span>
                              )}
                              {item.dot && <span className="relative z-10 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]" />}
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

      <SidebarFooter className="bg-gradient-to-t from-sidebar to-transparent pt-6 pb-4 px-3 z-10 dark:from-[#04080c]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group flex w-full items-center rounded-2xl border border-sidebar-border bg-sidebar-accent/50 backdrop-blur-md text-left outline-none transition-all hover:bg-sidebar-accent hover:shadow-lg focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] dark:hover:border-white/10",
                collapsed ? "justify-center p-2" : "gap-3 p-3",
              )}
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
          <DropdownMenuContent side="right" align="end" className="w-56 border-sidebar-border bg-popover text-popover-foreground backdrop-blur-xl shadow-2xl rounded-xl dark:border-white/10 dark:bg-[#09111c]/95 dark:text-slate-200">
            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground dark:text-slate-400">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border dark:bg-white/10" />
            <DropdownMenuItem className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground cursor-pointer rounded-lg m-1 transition-colors dark:focus:bg-white/10 dark:focus:text-white">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground cursor-pointer rounded-lg m-1 transition-colors dark:focus:bg-white/10 dark:focus:text-white">
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
