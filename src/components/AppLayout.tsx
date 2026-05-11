import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

export default function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { user, loading } = useAuth();
  const { i18n } = useTranslation();

  const toggleLang = () => {
    const next = i18n.language === "ur" ? "en" : "ur";
    i18n.changeLanguage(next);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-3 w-64">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground hidden sm:block font-medium">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
              </div>
               <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-3 gap-2 hover:bg-primary/10 transition-colors"
                onClick={toggleLang}
              >
                <Languages className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold">{i18n.language === "ur" ? "English" : "اردو"}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full h-9 w-9 hover:bg-primary/10 transition-colors"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-primary" />}
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
