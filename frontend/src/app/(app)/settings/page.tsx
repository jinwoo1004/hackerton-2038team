"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, ChevronRight, FolderKanban, LogOut, Settings, Users } from "lucide-react";
import { dashboardApi } from "@/services/dashboardApi";
import { useAuth } from "@/features/auth/AuthProvider";
import { PasswordCard, ProfileCard } from "@/features/settings/AccountForms";
import { SETTINGS_TABS, TONE } from "@/features/settings/SettingsTabs";
import { cn } from "@/shared/lib/cn";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import type { Dashboard } from "@/types";

export default function SettingsPage() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <ProfileCard />
        <PasswordCard />
      </div>
      <aside className="space-y-4">
        <ProfileSummary />
        <QuickSettings />
        <LogoutCard />
      </aside>
    </div>
  );
}

function joined(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 가입`;
}

function ProfileSummary() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  useEffect(() => {
    dashboardApi.dashboard().then(setDashboard).catch(() => {});
  }, []);

  const initial = user?.name?.trim().charAt(0) ?? "?";
  const rows = [
    { icon: Building2, value: user?.company || "회사 정보 없음" },
    { icon: Users, value: user?.department || "부서 정보 없음" },
    { icon: CalendarDays, value: joined(user?.createdAt) },
  ];

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-[24px] font-extrabold text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.8)]">
          {initial}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[18px] font-extrabold text-ink-900">{user?.name}</p>
            <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold text-white", user?.role === "ADMIN" ? "bg-primary-600" : "bg-ink-400")}>
              {user?.role === "ADMIN" ? "관리자" : "사용자"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-ink-500">{user?.email}</p>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {rows.map(({ icon: Icon, value }) => (
          <li key={value} className="flex items-center gap-3 text-[14px] font-medium text-ink-700">
            <Icon size={18} className="shrink-0 text-ink-400" />
            <span className="truncate">{value}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/projects"
        className="group relative mt-5 flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] p-4 text-white shadow-[0_12px_28px_-14px_rgba(37,99,235,0.75)]"
      >
        <span className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/10" />
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
          <FolderKanban size={21} strokeWidth={2.2} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-white/85">내 활동</span>
          <span className="block text-[16px] font-extrabold tabular-nums">
            프로젝트 {dashboard?.projects.total ?? "-"}개 · 분석 {dashboard?.analyses.total ?? "-"}회
          </span>
          <span className="mt-0.5 block text-[12px] text-white/85">프로젝트 화면으로 이동합니다.</span>
        </span>
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 transition group-hover:translate-x-0.5">
          <ArrowRight size={15} strokeWidth={2.4} />
        </span>
      </Link>
    </section>
  );
}

function QuickSettings() {
  const items = SETTINGS_TABS.filter((t) => t.href !== "/settings");
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", TONE.slate.tile)}>
          <Settings size={20} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold text-ink-900">빠른 설정</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-400">자주 쓰는 설정으로 바로 이동합니다.</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {items.map(({ href, label, hint, icon: Icon, tone }) => (
          <li key={href}>
            <Link href={href} className="group flex items-center gap-3 py-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line transition group-hover:text-white",
                  TONE[tone].text,
                  TONE[tone].hover,
                )}
              >
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-ink-900">{label}</span>
                <span className="block truncate text-[12px] text-ink-400">{hint}</span>
              </span>
              <ChevronRight size={17} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LogoutCard() {
  const { logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-5 text-left shadow-soft transition hover:border-toss-red"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-toss-red text-white">
          <LogOut size={20} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold text-ink-900">로그아웃</span>
          <span className="block text-[12.5px] text-ink-400">이 브라우저에서 로그인을 끝냅니다.</span>
        </span>
        <ChevronRight size={17} className="shrink-0 text-ink-300 transition group-hover:text-toss-red" />
      </button>
      <ConfirmDialog
        open={confirming}
        title="로그아웃할까요?"
        description="다시 이용하려면 이메일과 비밀번호로 로그인해야 합니다."
        confirmLabel="로그아웃"
        danger
        onConfirm={logout}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
