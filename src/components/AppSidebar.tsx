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
      className="border-r-0 bg-[#071821] text-white"
    >
      <SidebarHeader className="border-b border-white/10 bg-[#071821] px-4 py-4">
        <motion.div
          layout
          className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-[#071821] shadow-[0_16px_40px_-18px_rgba(245,158,11,0.9)] ring-1 ring-amber-300/40">
            <Wallet className="h-5 w-5" strokeWidth={2.4} />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#071821] bg-emerald-400" />
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="min-w-0">
              <div className="truncate font-display text-[17px] font-bold leading-tight text-white">AsaanKhata</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ledger Suite</div>
            </motion.div>
          )}
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="premium-sidebar-scroll bg-[#071821] px-3 py-4">
        {!collapsed && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              aria-label="Search navigation"
              placeholder="Search navigation"
              className="h-10 rounded-2xl border-white/10 bg-white/[0.045] pl-9 text-sm text-white placeholder:text-slate-500 shadow-inner outline-none transition focus-visible:ring-1 focus-visible:ring-cyan-400/50"
            />
          </motion.div>
        )}

        <div className="space-y-5">
          {visibleSections.map((section) => (
            <nav key={section.label} aria-label={section.label} className="space-y-2">
              {!collapsed && (
                <div className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{section.label}</div>
              )}
              <SidebarMenu className="gap-1.5">
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
                            "group relative flex h-12 w-full items-center overflow-hidden rounded-2xl border border-transparent text-sm font-medium outline-none transition duration-200 ease-out focus-visible:ring-2 focus-visible:ring-amber-400/60",
                            collapsed ? "justify-center px-0" : "gap-3 px-3",
                            active
                              ? "border-amber-400/20 bg-amber-500/[0.12] text-white shadow-[0_14px_34px_-24px_rgba(245,158,11,0.95)]"
                              : "text-slate-300 hover:border-white/10 hover:bg-cyan-300/[0.07] hover:text-white",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="sidebar-active-indicator"
                              className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.8)]"
                              transition={{ duration: 0.2, ease: "easeOut" }}
                            />
                          )}
                          <motion.span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                              active ? "bg-amber-400/15 text-amber-300" : "text-slate-400 group-hover:text-cyan-200",
                            )}
                            whileHover={{ x: collapsed ? 0 : 2 }}
                            transition={{ duration: 0.18 }}
                          >
                            <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                          </motion.span>
                          {!collapsed && (
                            <>
                              <span className={cn("min-w-0 flex-1 truncate", active && "font-semibold")}>{item.title}</span>
                              {item.badge && (
                                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">
                                  {item.badge}
                                </span>
                              )}
                              {item.dot && <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.9)]" />}
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

      <SidebarFooter className="border-t border-white/10 bg-[#071821] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group flex w-full items-center rounded-2xl border border-white/10 bg-white/[0.045] text-left outline-none transition hover:border-cyan-300/20 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-amber-400/60",
                collapsed ? "justify-center p-2" : "gap-3 p-3",
              )}
              aria-label="Open user menu"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-300/10">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-5 w-5 text-cyan-100" />
                )}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b1f2a] bg-emerald-400" />
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{profile?.full_name ?? "User"}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-200">
                        {role?.replace("_", " ") ?? "Guest"}
                      </span>
                      {loading && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500 transition group-data-[state=open]:rotate-180 group-hover:text-slate-300" />
                </>
              )}
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem>
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
            "mt-2 h-11 rounded-2xl text-slate-300 transition duration-200 hover:bg-red-500/10 hover:text-red-300",
            collapsed ? "w-full" : "w-full justify-start px-3",
          )}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && <span>{t("SignOut")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
