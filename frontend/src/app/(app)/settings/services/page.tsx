"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Cable, ChevronRight, Cpu, Database, Link2, RefreshCw, Server, Sparkles, type LucideIcon } from "lucide-react";
import { telemetryApi } from "@/services/agentApi";
import { alertApi } from "@/services/alertApi";
import { dashboardApi } from "@/services/dashboardApi";
import { ServiceBadge } from "@/features/dashboard/ServiceBadge";
import { SectionCard, TONE, type Tone } from "@/features/settings/SettingsTabs";
import { API_BASE_URL, USE_MOCK } from "@/shared/config/app";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/format";
import { SlackLogo } from "@/shared/ui/SlackLogo";
import type { AlertChannel, MonitoringOverview, SystemStatus } from "@/types";

const SERVICE_ICON: Record<string, { icon: LucideIcon; tone: Tone }> = {
  api: { icon: Server, tone: "blue" },
  db: { icon: Database, tone: "violet" },
  analysis: { icon: Sparkles, tone: "orange" },
  agent: { icon: Cable, tone: "green" },
};

export default function ServicesSettingsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [channels, setChannels] = useState<AlertChannel[] | null>(null);
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(() => {
    setChecking(true);
    dashboardApi
      .systemStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    check();
    alertApi.channels().then(setChannels).catch(() => setChannels([]));
    telemetryApi.overview().then(setOverview).catch(() => {});
  }, [check]);

  const slackOn = (channels ?? []).filter((c) => c.enabled).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard
        icon={Link2}
        tone="green"
        title="서비스 연결 상태"
        description="화면은 백엔드만 호출하고, 분석은 백엔드가 분석 서비스에 맡깁니다."
        action={
          <button
            type="button"
            onClick={check}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-[13.5px] font-bold text-primary-600 transition hover:border-primary-600 hover:bg-primary-600 hover:text-white"
          >
            <RefreshCw size={15} strokeWidth={2.4} className={cn(checking && "animate-spin")} />
            다시 확인
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line px-4 py-3 text-[13px]">
          <span className="font-semibold text-ink-500">백엔드 주소</span>
          <span className="break-all font-mono text-ink-900">{USE_MOCK ? "브라우저 저장소" : API_BASE_URL}</span>
          {status && <span className="ml-auto text-[12px] tabular-nums text-ink-400">확인 {formatDateTime(status.checkedAt)}</span>}
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {(status?.services ?? []).map((s) => {
            const meta = SERVICE_ICON[s.key] ?? { icon: Cpu, tone: "slate" as Tone };
            const Icon = meta.icon;
            return (
              <li key={s.key} className="flex items-center gap-3.5 px-4 py-3.5">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white", TONE[meta.tone].tile)}>
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink-900">{s.name}</span>
                  <span className="block truncate text-[12px] text-ink-400" title={s.detail ?? undefined}>
                    {s.detail ?? "-"}
                    {s.latencyMs != null && s.status === "UP" ? ` · 응답 ${s.latencyMs}ms` : ""}
                  </span>
                </span>
                <ServiceBadge status={s.status} />
              </li>
            );
          })}
          {!status && <li className="px-4 py-8 text-center text-[13px] text-ink-400">상태를 확인하는 중입니다.</li>}
        </ul>
      </SectionCard>

      <aside className="space-y-4">
        <IntegrationLink
          href="/settings/alerts"
          icon={<SlackLogo size={22} />}
          title="Slack"
          description={channels == null ? "확인 중" : channels.length ? `채널 ${channels.length}개 · 사용 중 ${slackOn}개` : "연결된 채널이 없습니다"}
          on={slackOn > 0}
        />
        <IntegrationLink
          href="/monitoring"
          icon={<Cable size={21} className="text-[#059669]" />}
          title="수집 에이전트"
          description={overview ? `온라인 ${overview.agentsOnline}대 / 등록 ${overview.agentsTotal}대` : "확인 중"}
          on={(overview?.agentsOnline ?? 0) > 0}
        />
        <p className="px-1 text-[12.5px] leading-relaxed text-ink-400 [word-break:keep-all]">
          Naver Works, SMS, Redmine 연동은 다음 단계에서 추가됩니다.
        </p>
      </aside>
    </div>
  );
}

function IntegrationLink({ href, icon, title, description, on }: { href: string; icon: React.ReactNode; title: string; description: string; on: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-3.5 rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:border-primary-300">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-white">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-extrabold text-ink-900">
          {title}
          <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white", on ? "bg-toss-green" : "bg-ink-400")}>{on ? "연결됨" : "미연결"}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-ink-500">{description}</span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
    </Link>
  );
}
