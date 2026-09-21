"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { PageLoader } from "@/shared/ui/Loading";
import { cn } from "@/shared/lib/cn";
import { CrumbProvider } from "./CrumbContext";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { SidebarProvider, useSidebar } from "./SidebarContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <PageLoader />;

  return (
    <SidebarProvider>
      <CrumbProvider>
        <div className="flex min-h-screen bg-white">
          <Sidebar />
          <MobileDrawer />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 bg-white">
              <div key={pathname} className="container-page animate-pop-in px-4 py-5 sm:px-6 sm:py-7">
                {children}
              </div>
            </main>
          </div>
        </div>
      </CrumbProvider>
    </SidebarProvider>
  );
}

function MobileDrawer() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  if (!mobileOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/40" onClick={() => setMobileOpen(false)} />
      <div className="absolute left-0 top-0 h-full animate-slide-in-left">
        <Sidebar mobile />
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-bold text-ink-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div>}
    </div>
  );
}

export function MobileActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur sm:hidden [&>button]:h-12 [&>button]:flex-1 [&>a]:h-12 [&>a]:flex-1">
      {children}
    </div>
  );
}
