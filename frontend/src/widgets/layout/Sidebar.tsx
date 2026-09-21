"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { cn } from "@/shared/lib/cn";
import { LogoMark } from "@/shared/ui/Logo";
import { TeamBrand } from "@/shared/ui/TeamBrand";
import { NAV_ITEMS, type NavItem } from "./nav";
import { useSidebar } from "./SidebarContext";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname() ?? "";
  const { collapsed } = useSidebar();
  const isCollapsed = !mobile && collapsed;

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-line bg-white",
        mobile
          ? "h-full w-[276px]"
          : cn(
              "sticky top-0 z-[45] hidden h-screen transition-[width] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
              collapsed ? "w-[68px]" : "w-sidebar",
            ),
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-line",
          isCollapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Link href="/projects" aria-label="홈으로" className="min-w-0">
          {isCollapsed ? <LogoMark size={30} /> : <TeamBrand logoSize={28} compact />}
        </Link>
      </div>

      <div className={cn("flex-1 overflow-y-auto py-3", isCollapsed ? "px-2" : "px-3")}>
        {!isCollapsed && (
          <Link
            href="/projects/new"
            className="mb-3 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary-600 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <Plus size={16} strokeWidth={2.5} />새 프로젝트
          </Link>
        )}
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.key} item={item} active={isActive(pathname, item.href)} collapsed={isCollapsed} />
          ))}
        </nav>
      </div>

      <div className={cn("shrink-0 border-t border-line", isCollapsed ? "p-2" : "p-3")}>
        <UserMenu collapsed={isCollapsed} mobile={mobile} />
      </div>
    </aside>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;

  const inner = (
    <>
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active ? "text-primary-600" : "text-ink-400 group-hover:text-ink-700",
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.soon && (
            <span className="ml-auto rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-400">
              준비중
            </span>
          )}
        </>
      )}
    </>
  );

  const base = cn(
    "group flex items-center gap-2.5 rounded-lg text-sm transition-colors",
    collapsed ? "h-10 justify-center" : "h-10 px-3",
    active ? "bg-primary-50 font-bold text-primary-700" : "font-medium text-ink-700 hover:bg-ink-100",
  );

  if (item.soon) {
    return (
      <button
        type="button"
        disabled
        title={`${item.label} — 준비중`}
        className={cn(base, "w-full cursor-not-allowed text-ink-300 hover:bg-transparent")}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={base}
    >
      {inner}
    </Link>
  );
}

function UserMenu({ collapsed, mobile = false }: { collapsed: boolean; mobile?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = user?.name?.trim().charAt(0) ?? "?";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const panel = (
    <div
      role="menu"
      className={cn(
        "absolute z-[70] w-[236px] animate-pop-in overflow-hidden rounded-xl border border-line bg-white shadow-card",
        mobile ? "bottom-full left-0 mb-2 w-full" : "bottom-0 left-full ml-2",
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[13px] font-bold text-primary-700">
          {initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold text-ink-900">{user?.name}</span>
          <span className="block truncate text-[11px] text-ink-400">{user?.email}</span>
        </span>
      </div>
      <div className="p-1">
        <button
          type="button"
          role="menuitem"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink-700 transition hover:bg-toss-red-soft hover:text-toss-red"
        >
          <LogOut size={16} className="shrink-0 text-ink-400" />
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setOpen(false)} />
          {panel}
        </>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? user?.name ?? "" : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center rounded-lg text-left transition",
          collapsed ? "h-10 justify-center" : "gap-2.5 px-2 py-2",
          open ? "bg-ink-100" : "hover:bg-ink-100",
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-primary-50 font-bold text-primary-700",
            collapsed ? "h-7 w-7 text-[12px]" : "h-8 w-8 text-[13px]",
          )}
        >
          {initial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-ink-900">{user?.name}</span>
              <span className="block truncate text-[11px] text-ink-400">{user?.email}</span>
            </span>
            <ChevronRight
              size={15}
              className={cn("shrink-0 text-ink-400 transition-transform", open && "translate-x-0.5")}
            />
          </>
        )}
      </button>
    </div>
  );
}
