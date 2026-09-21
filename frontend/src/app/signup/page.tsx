"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Input";
import { PageLoader } from "@/shared/ui/Loading";
import { useToast } from "@/shared/ui/Toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  company: string;
  department: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, signup } = useAuth();

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    company: "",
    department: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/projects");
  }, [loading, user, router]);

  if (loading || user) return <PageLoader />;

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate() {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "이름을 입력해주세요.";
    if (!form.email.trim()) next.email = "이메일을 입력해주세요.";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "이메일 형식이 올바르지 않습니다.";
    if (!form.password) next.password = "비밀번호를 입력해주세요.";
    else if (form.password.length < 8) next.password = "비밀번호는 8자 이상이어야 합니다.";
    if (!form.passwordConfirm) next.passwordConfirm = "비밀번호를 한 번 더 입력해주세요.";
    else if (form.password !== form.passwordConfirm) next.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        company: form.company.trim() || undefined,
        department: form.department.trim() || undefined,
      });
      toast.success("가입이 완료되었습니다.");
      router.replace("/projects");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      wide
      title="회원가입"
      description="계정을 만들고 첫 프로젝트를 등록해보세요."
      footer={
        <p className="text-center text-[13px] text-ink-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-primary-600 hover:underline">
            로그인
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="이름" required error={errors.name}>
          <Input
            autoComplete="name"
            placeholder="홍길동"
            value={form.name}
            invalid={!!errors.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <Field label="이메일" required error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={form.email}
            invalid={!!errors.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="비밀번호" required error={errors.password} hint={errors.password ? undefined : "8자 이상"}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="8자 이상"
              value={form.password}
              invalid={!!errors.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </Field>
          <Field label="비밀번호 확인" required error={errors.passwordConfirm}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="다시 입력"
              value={form.passwordConfirm}
              invalid={!!errors.passwordConfirm}
              onChange={(e) => set("passwordConfirm", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="회사명">
            <Input placeholder="선택" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="부서명">
            <Input placeholder="선택" value={form.department} onChange={(e) => set("department", e.target.value)} />
          </Field>
        </div>

        {formError && (
          <p role="alert" className="rounded-lg bg-toss-red-soft px-3.5 py-2.5 text-[13px] font-medium text-toss-red">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          가입하기
        </Button>
      </form>
    </AuthLayout>
  );
}
