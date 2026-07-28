import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/clerk-react";
import { GlobalSearch } from "./GlobalSearch";

export default function AppLayout() {
  const { theme, setTheme } = useTheme();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        navigate("/transactions/new");
      }
    };
    
    const onOpenSearch = () => setSearchOpen(true);

    document.addEventListener("keydown", down);
    window.addEventListener("open-search", onOpenSearch);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open-search", onOpenSearch);
    };
  }, [navigate]);

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
          <header 
            className="h-14 flex items-center gap-3 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 pl-4 pr-4 md:pr-[140px] select-none"
            style={{ WebkitAppRegion: 'drag' } as CSSProperties}
          >
            <SidebarTrigger style={{ WebkitAppRegion: 'no-drag' } as CSSProperties} />
            <div className="flex-1" />
            <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
              <div className="text-xs text-muted-foreground hidden sm:block font-medium">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full h-9 w-9 hover:bg-primary/10 transition-colors"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-primary" />}
              </Button>
              <div className="flex items-center justify-center pl-2 border-l border-border/50 ml-1">
                <UserButton />
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
      <GlobalSearch open={searchOpen} setOpen={setSearchOpen} />
    </SidebarProvider>
  );
}
