import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center glass-card p-12 rounded-3xl max-w-md w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary-glow" />
        <h1 className="mb-4 text-7xl font-display font-black text-gradient bg-clip-text text-transparent bg-gradient-to-br from-primary to-primary/50">404</h1>
        <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
        <p className="mb-8 text-muted-foreground">The page you are looking for doesn't exist or has been moved.</p>
        <Link to="/" className="inline-flex items-center justify-center h-11 px-8 rounded-xl bg-primary text-primary-foreground font-semibold hover:brightness-110 transition-all shadow-lg shadow-primary/25">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
