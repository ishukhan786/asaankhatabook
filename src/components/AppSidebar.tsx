import {
  Building2,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings as SettingsIcon,
  Shield,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AsaanKhataLogo } from "@/components/Logo";
import { motion } from "framer-motion";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: string;
  dot?: boolean;
  adminOnly?: boolean;
  managerOrAdmin?: boolean;
  colorClass?: string;
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
        { title: t("Dashboard"), url: "/", icon: LayoutDashboard, exact: true, colorClass: "text-indigo-500 dark:text-indigo-400" },
        { title: t("Accounts"), url: "/accounts", icon: Users, colorClass: "text-amber-500 dark:text-amber-400" },
        { title: t("Transactions"), url: "/transactions", icon: Receipt, dot: true, colorClass: "text-emerald-500 dark:text-emerald-400" },
        { title: t("PayablesReceivables"), url: "/payables-receivables", icon: Wallet, colorClass: "text-teal-500 dark:text-teal-400" },
        { title: t("Reports"), url: "/reports", icon: FileBarChart, colorClass: "text-purple-500 dark:text-purple-400" },
      ],
    },
    {
      label: "Administration",
      items: [
        { title: t("AdminPanel"), url: "/admin", icon: Shield, adminOnly: true, exact: true, colorClass: "text-rose-500 dark:text-rose-400" },
        { title: t("Users"), url: "/admin/users", icon: UserCog, managerOrAdmin: true, colorClass: "text-cyan-500 dark:text-cyan-400" },
        { title: t("AuditLogs"), url: "/admin/audit", icon: History, adminOnly: true, colorClass: "text-slate-500 dark:text-slate-450" },
        { title: t("Branches"), url: "/branches", icon: Building2, adminOnly: true, colorClass: "text-sky-500 dark:text-sky-400" },
        { title: t("Settings"), url: "/settings", icon: SettingsIcon, colorClass: "text-pink-500 dark:text-pink-400" },
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

      <SidebarHeader className="bg-transparent px-4 py-5 z-10 relative shrink-0">
        <motion.div
          layout
          className={cn("flex items-center", collapsed ? "justify-center" : "gap-4")}
        >
          <AsaanKhataLogo size={42} showText={!collapsed} />
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="premium-sidebar-scroll bg-transparent px-3 py-2 z-10 relative flex-1 overflow-y-auto min-h-0">


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
                      <SidebarMenuButton asChild tooltip={item.title} className="h-12 rounded-xl p-0 hover:bg-transparent">
                        <NavLink
                          to={item.url}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group/item relative flex h-12 w-full items-center rounded-xl text-sm font-medium outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/60",
                            collapsed ? "justify-center px-0" : "gap-3 px-3",
                          )}
                          style={active ? {
                            background: "transparent",
                            borderColor: "transparent",
                            boxShadow: "inset 3px 0 0 hsl(var(--sidebar-primary))",
                          } : {
                            borderColor: "transparent",
                          }}
                        >
                          {/* Hover glass overlay */}
                          <div className="absolute inset-0 rounded-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 pointer-events-none"
                            style={{
                              background: "var(--glass-bg)",
                              backdropFilter: "blur(12px)",
                              borderColor: "var(--glass-border)",
                            }}
                          />
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 relative z-10",
                              active 
                                ? "bg-sidebar-accent/10 border border-sidebar-border/20 shadow-inner scale-110" 
                                : "opacity-75 group-hover/item:opacity-100 group-hover/item:scale-110",
                              item.colorClass || "text-muted-foreground"
                            )}
                          >
                            <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.5 : 2} />
                          </span>
                          {!collapsed && (
                            <>
                              <span className={cn("min-w-0 flex-1 truncate transition-colors relative z-10 leading-snug py-0.5", active ? "font-bold tracking-wide text-sidebar-foreground" : "font-medium text-muted-foreground group-hover/item:text-sidebar-foreground")}>
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

      <SidebarFooter className="pt-2 pb-2 px-3 z-10 relative shrink-0" style={{ background: "transparent" }}>
        {/* Footer top border */}
        <div className="absolute top-0 left-3 right-3 h-px" style={{ background: "var(--glass-border)" }} />

        <Button
          onClick={signOut}
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn(
            "mt-2 h-9.5 rounded-xl text-muted-foreground transition-all duration-300 hover:bg-destructive/15 hover:text-destructive hover:shadow-[0_0_15px_-5px_rgba(var(--destructive),0.4)] dark:text-slate-400",
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
