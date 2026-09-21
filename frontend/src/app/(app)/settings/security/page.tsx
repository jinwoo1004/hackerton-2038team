"use client";

import { useEffect, useState } from "react";
import { LogOut, MonitorSmartphone } from "lucide-react";
import { getToken } from "@/services/http";
import { useAuth } from "@/features/auth/AuthProvider";
import { PasswordCard } from "@/features/settings/AccountForms";
import { SectionCard } from "@/features/settings/SettingsTabs";
import { formatDateTime } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

function tokenTimes(token: string | null): { issued: string | null; expires: string | null } {
  try {
    const payload = JSON.parse(atob((token ?? "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const at = (s?: number) => (s ? new Date(s * 1000).toISOString() : null);
    return { issued: at(payload.iat), expires: at(payload.exp) };
  } catch {
    return { issued: null, expires: null };
  }
}

function browserName(ua: string) {
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "브라우저";
}

export default function SecuritySettingsPage() {
  const { user, logout } = useAuth();
  const [session, setSession] = useState<{ issued: string | null; expires: string | null; browser: string }>({
    issued: null,
    expires: null,
    browser: "-",
  });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setSession({ ...tokenTimes(getToken()), browser: browserName(navigator.userAgent) });
  }, []);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <PasswordCard />
      </div>
      <aside>
        <SectionCard icon={MonitorSmartphone} tone="orange" title="로그인 세션" description="지금 이 브라우저의 로그인 정보입니다.">
          <dl className="divide-y divide-line rounded-xl border border-line text-[13.5px]">
            {[
              ["계정", user?.email ?? "-"],
              ["브라우저", session.browser],
              ["로그인", session.issued ? formatDateTime(session.issued) : "-"],
              ["만료 예정", session.expires ? formatDateTime(session.expires) : "-"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-ink-400">{k}</dt>
                <dd className="truncate font-semibold tabular-nums text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400 [word-break:keep-all]">
            만료되면 자동으로 로그아웃되고 다시 로그인해야 합니다.
          </p>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setConfirming(true)}>
            <LogOut size={16} />
            이 브라우저에서 로그아웃
          </Button>
        </SectionCard>
      </aside>
      <ConfirmDialog
        open={confirming}
        title="로그아웃할까요?"
        description="다시 이용하려면 이메일과 비밀번호로 로그인해야 합니다."
        confirmLabel="로그아웃"
        danger
        onConfirm={logout}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
