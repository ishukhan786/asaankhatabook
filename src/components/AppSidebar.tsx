import { LayoutDashboard, Users, Receipt, FileBarChart, Building2, Wallet, LogOut, Shield, UserCog, Lock, Settings as SettingsIcon, History } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role, signOut, profile, loading } = useAuth();

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const items = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Accounts", url: "/accounts", icon: Users },
    { title: "Transactions", url: "/transactions", icon: Receipt },
    { title: "Expenses", url: "/expenses", icon: Wallet },
    { title: "Reports", url: "/reports", icon: FileBarChart },
    { title: "Settings", url: "/settings", icon: SettingsIcon },
    // Admin Items
    { title: "Admin Panel", url: "/admin", icon: Shield, admin: true, exact: true },
    { title: "Users", url: "/admin/users", icon: UserCog, admin: true },
    { title: "Audit Logs", url: "/admin/audit", icon: History, admin: true },
    { title: "Branches", url: "/branches", icon: Building2, admin: true },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-amber shrink-0">
            <Wallet className="w-5 h-5 text-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-display font-bold text-sidebar-foreground text-base leading-tight">AsaanKhata</div>
              <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Ledger Suite</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const show = !item.admin || role === "admin";
                if (!show) return null;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={item.exact ? pathname === item.url : isActive(item.url)} 
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary data-[active=true]:font-semibold"
                    >
                      <NavLink to={item.url} className="flex items-center gap-3">
                        <item.icon className={`h-4 w-4 ${item.admin ? "text-primary" : ""}`} />
                        {!collapsed && (
                          <div className="flex items-center justify-between w-full">
                            <span>{item.title}</span>
                            {item.admin && <Shield className="w-2.5 h-2.5 opacity-50" />}
                          </div>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="px-2 py-1.5 rounded-lg bg-sidebar-accent/50 border border-sidebar-border/50">
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest font-bold">Session</div>
                {loading && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
              </div>
              <div className="flex items-center gap-2.5 mt-1">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-sidebar-foreground truncate">
                    {profile?.full_name ?? "User"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {role === "admin" ? "Admin" : role === "branch_user" ? "Branch" : "Guest"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        ) : (
          <Button onClick={signOut} variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}


