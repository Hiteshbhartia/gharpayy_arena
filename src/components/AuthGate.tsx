import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export function AuthGate() {
  const { status, apiEnabled, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isPublic = PUBLIC_PATHS.has(location.pathname);

  useEffect(() => {
    if (status === "loading") return;

    if (!apiEnabled && !isPublic) {
      navigate({ to: "/login", replace: true });
      return;
    }

    if (status === "authenticated" && isPublic) {
      navigate({ to: "/", replace: true });
      return;
    }

    if (status === "unauthenticated" && !isPublic) {
      navigate({
        to: "/login",
        replace: true,
        search: { redirect: location.pathname },
      });
    }
  }, [status, isPublic, apiEnabled, navigate, location.pathname]);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest">Loading arena…</span>
        </div>
      </div>
    );
  }

  if (isPublic) {
    return <Outlet />;
  }

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <AppShell />;
}
