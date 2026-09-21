"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function projectLinks(projectId: number) {
  return [
    { href: `/projects/${projectId}`, label: "프로젝트 보기" },
    { href: `/projects/${projectId}/analysis`, label: "분석 결과" },
    { href: `/projects/${projectId}/files`, label: "파일" },
    { href: `/projects/${projectId}/logs`, label: "로그" },
    { href: `/projects/${projectId}/agents`, label: "에이전트" },
    { href: `/projects/${projectId}/settings`, label: "설정" },
  ];
}

export function ProjectMenu({ projectId, name, className }: { projectId: number; name: string; className?: string }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  const items = projectLinks(projectId);

  return (
    <>
      <button
        type="button"
        aria-label={`${name} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPos(pos ? null : { top: r.bottom + 6, right: window.innerWidth - r.right });
        }}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900",
          pos && "bg-ink-100 text-ink-900",
          className,
        )}
      >
        <MoreHorizontal size={18} />
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setPos(null)} />
          <div
            role="menu"
            className="fixed z-[61] w-40 animate-pop-in overflow-hidden rounded-xl border border-line bg-white p-1 text-left shadow-card"
            style={{ top: pos.top, right: pos.right }}
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="block rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 transition hover:bg-ink-100 hover:text-ink-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
