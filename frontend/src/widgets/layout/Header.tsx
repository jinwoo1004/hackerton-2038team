"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, PanelLeft } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { useCrumb } from "./CrumbContext";
import { useSidebar } from "./SidebarContext";

const EXTRA_CRUMBS: Record<string, { label: string; href?: string }[]> = {
  "/projects/new": [{ label: "프로젝트", href: "/projects" }, { label: "새 프로젝트" }],
  "/settings/alerts": [{ label: "설정", href: "/settings" }, { label: "알림 설정" }],
  "/settings/services": [{ label: "설정", href: "/settings" }, { label: "서비스 연동" }],
  "/settings/security": [{ label: "설정", href: "/settings" }, { label: "보안 설정" }],
};

export function Header() {
  const pathname = usePathname() ?? "";
  const { collapsed, toggle, setMobileOpen } = useSidebar();
  const { crumb } = useCrumb();

  let items = EXTRA_CRUMBS[pathname];
  if (!items) {
    const match = [...NAV_ITEMS]
      .sort((a, b) => b.href.length - a.href.length)
      .find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`));
    if (match) {
      items =
        pathname === match.href
          ? [{ label: match.label }]
          : [{ label: match.label, href: match.href }, { label: crumb ?? "상세" }];
    } else {
      items = [{ label: crumb ?? "" }];
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-5">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 md:hidden"
      >
        <Menu size={20} />
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 md:inline-flex"
      >
        <PanelLeft size={18} />
      </button>

      <nav aria-label="현재 위치" className="flex min-w-0 items-center gap-1.5 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight size={14} className="shrink-0 text-ink-300" />}
              {c.href && !last ? (
                <Link href={c.href} className="shrink-0 text-ink-400 transition-colors hover:text-ink-900">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "truncate font-semibold text-ink-900" : "shrink-0 text-ink-400"}>
                  {c.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    </header>
  );
}
