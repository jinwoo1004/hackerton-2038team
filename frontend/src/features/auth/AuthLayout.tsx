"use client";

import Link from "next/link";
import { Activity, FileSearch, ShieldCheck } from "lucide-react";
import { APP, COMPANY } from "@/shared/config/app";
import { cn } from "@/shared/lib/cn";
import { LogoMark } from "@/shared/ui/Logo";

const POINTS = [
  {
    icon: FileSearch,
    title: "소스와 규칙을 함께",
    desc: "프로젝트 규칙 문서와 소스를 등록해 분석 정확도를 높입니다.",
  },
  {
    icon: Activity,
    title: "운영 상태를 한 화면에",
    desc: "코드 품질부터 오류·로그·성능까지 하나의 흐름으로 확인합니다.",
  },
  {
    icon: ShieldCheck,
    title: "프로젝트 단위 관리",
    desc: "여러 프로젝트를 각각의 기준으로 나눠서 모니터링합니다.",
  },
];

export function AuthLayout({
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-100 px-4 py-10 sm:px-6">
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.28)] lg:min-h-[520px]",
          wide ? "max-w-[1040px]" : "max-w-[940px]",
        )}
      >
        <BrandPanel />

        <section
          className={cn(
            "flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:shrink-0 lg:px-10",
            wide ? "lg:w-1/2" : "lg:w-[46%]",
          )}
        >
          <div className={cn("mx-auto w-full", wide ? "max-w-[400px]" : "max-w-[320px]")}>
            <div className="flex flex-col items-center text-center">
              <Link href="/" aria-label={`${APP.name} 홈`}>
                <LogoMark size={64} tile />
              </Link>
              <h1 className="mt-4 text-[19px] font-extrabold tracking-tight text-ink-900">{title}</h1>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-400">{description}</p>
            </div>

            <div className="mt-7">{children}</div>
            {footer && <div className="mt-5">{footer}</div>}
          </div>
        </section>
      </div>

      <p className="mt-6 px-4 text-center text-[12px] text-ink-300">{COMPANY.copyright}</p>
    </div>
  );
}

function BrandPanel() {
  return (
    <section className="relative hidden overflow-hidden bg-primary-900 lg:flex lg:w-[54%] lg:flex-col lg:justify-center lg:px-12 xl:px-14">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(70% 60% at 12% 8%, rgba(59,130,246,0.42) 0%, rgba(59,130,246,0) 62%), radial-gradient(60% 55% at 92% 96%, rgba(37,99,235,0.38) 0%, rgba(37,99,235,0) 66%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(80% 80% at 40% 40%, #000 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(80% 80% at 40% 40%, #000 0%, transparent 100%)",
        }}
        aria-hidden
      />

      <div className="relative">
        <div className="mb-10 flex items-center gap-3">
          <LogoMark size={44} tile />
          <span className="text-[16px] font-extrabold tracking-tight text-white">{APP.name}</span>
        </div>
        <h2 className="text-[27px] font-extrabold leading-[1.32] tracking-tight text-white xl:text-[29px]">
          프로젝트 코드부터 운영 로그까지,
          <br />
          <span className="text-primary-300">하나의 흐름으로 봅니다</span>
        </h2>

        <ul className="mt-9 space-y-5">
          {POINTS.map((p) => (
            <li key={p.title} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-primary-200 backdrop-blur-sm">
                <p.icon size={18} strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-white">{p.title}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-white/60">{p.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <svg
        className="absolute inset-y-0 right-[-1px] h-full w-[52px] text-white"
        viewBox="0 0 52 600"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M52,0 L22,0 C44,130 42,190 14,300 C-14,410 44,470 22,600 L52,600 Z" fill="currentColor" />
      </svg>
    </section>
  );
}
