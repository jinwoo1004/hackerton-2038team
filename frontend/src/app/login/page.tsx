"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Info, UserPlus } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { EmailField } from "@/features/auth/EmailField";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { PageLoader } from "@/shared/ui/Loading";
import { APP, USE_MOCK } from "@/shared/config/app";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(USE_MOCK ? "/overview" : "/projects");
  }, [loading, user, router]);

  if (loading || user) return <PageLoader />;

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "아이디를 입력해주세요.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "이메일 형식이 올바르지 않습니다.";
    if (!password) next.password = "비밀번호를 입력해주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.replace(USE_MOCK ? "/overview" : "/projects");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function enterDemo() {
    setSubmitting(true);
    setFormError("");
    try {
      await login({ email: "admin@xisnd.com", password: "test1234" });
      router.replace("/overview");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "데모를 열지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={APP.name}
      description={APP.tagline}
      footer={
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-ink-300">또는</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Link
            href="/signup"
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white text-sm font-bold text-ink-900 transition hover:bg-ink-100"
          >
            <UserPlus size={16} className="text-ink-400" />
            새 계정 만들기
          </Link>

          <Link
            href="/login"
            className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-ink-400 transition hover:text-ink-700"
          >
            <Info size={13} />
            비밀번호 찾기
          </Link>

          {USE_MOCK && (
            <div className="mt-5 rounded-xl border border-dashed border-line bg-ink-100/70 px-4 py-3 text-center">
              <p className="text-[12px] font-bold text-ink-600">데모 모드</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                여러 업무 시스템의 운영 현황과 분석 결과를 시연 데이터로 둘러보세요.
                <br />
                <span className="font-mono text-[11px] text-ink-600">admin@xisnd.com / test1234</span>
              </p>
            </div>
          )}
        </>
      }
    >
      {USE_MOCK && (
        <div className="mb-6 rounded-2xl bg-primary-50 p-5">
          <p className="text-[15px] font-bold text-ink-900">통합 시스템 운영 현황을 한눈에</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">프로젝트별 지표, 장애 대응, 분석 보고서까지.<br />회원가입 없이 준비된 데모를 확인하세요.</p>
          <Button type="button" loading={submitting} onClick={enterDemo} className="mt-4 h-11 w-full">데모 둘러보기 <ArrowRight size={16} /></Button>
          <p className="mt-2 text-[11px] text-ink-400">모든 운영 수치와 AI 설명은 합성 시연 데이터입니다.</p>
        </div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="login-email" className="sr-only">
            이메일
          </label>
          <EmailField id="login-email" value={email} onChange={setEmail} invalid={!!errors.email} />
          {errors.email && <p className="mt-1.5 text-xs font-medium text-danger">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="login-password" className="sr-only">
            비밀번호
          </label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="비밀번호"
              value={password}
              invalid={!!errors.password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs font-medium text-danger">{errors.password}</p>}
        </div>

        {formError && (
          <p role="alert" className="rounded-lg bg-toss-red-soft px-3.5 py-2.5 text-[13px] font-medium text-toss-red">
            {formError}
          </p>
        )}

        <Button type="submit" loading={submitting} className="h-11 w-full text-[15px]">
          로그인
        </Button>
      </form>
    </AuthLayout>
  );
}
