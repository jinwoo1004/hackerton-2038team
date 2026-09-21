"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Link2, ShieldCheck, User, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export type Tone = "blue" | "green" | "violet" | "orange" | "slate";

export const TONE: Record<Tone, { tile: string; text: string; hover: string }> = {
  blue: { tile: "bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]", text: "text-[#2563EB]", hover: "group-hover:border-[#2563EB] group-hover:bg-[#2563EB]" },
  green: { tile: "bg-gradient-to-br from-[#10B981] to-[#047857]", text: "text-[#059669]", hover: "group-hover:border-[#059669] group-hover:bg-[#059669]" },
  violet: { tile: "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9]", text: "text-[#7C3AED]", hover: "group-hover:border-[#7C3AED] group-hover:bg-[#7C3AED]" },
  orange: { tile: "bg-gradient-to-br from-[#F97316] to-[#C2410C]", text: "text-[#EA580C]", hover: "group-hover:border-[#EA580C] group-hover:bg-[#EA580C]" },
  slate: { tile: "bg-gradient-to-br from-[#475569] to-[#1E293B]", text: "text-[#334155]", hover: "group-hover:border-[#334155] group-hover:bg-[#334155]" },
};

export const SETTINGS_TABS: { href: string; label: string; icon: LucideIcon; hint: string; tone: Tone }[] = [
  { href: "/settings", label: "계정 정보", icon: User, hint: "이름, 소속, 비밀번호", tone: "blue" },
  { href: "/settings/alerts", label: "알림 설정", icon: Bell, hint: "이상 알림 채널과 규칙", tone: "orange" },
  { href: "/settings/services", label: "서비스 연동", icon: Link2, hint: "백엔드, 분석 서비스, 에이전트 연결 상태", tone: "green" },
  { href: "/settings/security", label: "보안 설정", icon: ShieldCheck, hint: "비밀번호, 로그인 세션", tone: "violet" },
];

export function SettingsTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="mb-6 overflow-x-auto" aria-label="설정 메뉴">
      <ul className="flex gap-2">
        {SETTINGS_TABS.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-xl border px-4 text-[14px] font-bold transition",
                  active
                    ? "border-primary-600 bg-primary-600 text-white shadow-cta"
                    : "border-line bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
                )}
              >
                <Icon size={17} strokeWidth={2.2} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SectionCard({
  icon: Icon,
  tone = "blue",
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", TONE[tone].tile)}>
            <Icon size={20} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px] text-ink-400 [word-break:keep-all]">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
