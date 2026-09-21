import { SettingsTabs } from "@/features/settings/SettingsTabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <section className="mb-6">
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink-900 sm:text-[32px]">설정</h1>
        <p className="mt-2 text-[14px] text-ink-500">내 계정과 알림, 서비스 연동 정보를 관리합니다.</p>
      </section>
      <SettingsTabs />
      {children}
    </>
  );
}
