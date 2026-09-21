"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Pencil, User } from "lucide-react";
import { authApi } from "@/services/authApi";
import { useAuth } from "@/features/auth/AuthProvider";
import { SectionCard } from "@/features/settings/SettingsTabs";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Input";
import { useToast } from "@/shared/ui/Toast";

export function ProfileCard() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.company ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = name !== (user?.name ?? "") || company !== (user?.company ?? "") || department !== (user?.department ?? "");

  function cancel() {
    setName(user?.name ?? "");
    setCompany(user?.company ?? "");
    setDepartment(user?.department ?? "");
    setError("");
    setEditing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({ name: name.trim(), company: company.trim(), department: department.trim() });
      refreshUser(updated);
      toast.success("내 정보를 저장했습니다.");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={User}
      title="계정 정보"
      description="기본 프로필 정보를 관리합니다."
      action={
        !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-[13.5px] font-bold text-primary-600 transition hover:border-primary-600 hover:bg-primary-600 hover:text-white"
          >
            <Pencil size={15} strokeWidth={2.4} />
            프로필 편집
          </button>
        )
      }
    >
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="이름" required error={error}>
            <Input
              value={name}
              readOnly={!editing}
              invalid={!!error}
              className={editing ? undefined : "bg-toss-soft"}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
          </Field>
          <Field label="이메일" hint="이메일은 변경할 수 없습니다.">
            <Input value={user?.email ?? ""} disabled readOnly />
          </Field>
          <Field label="회사명">
            <Input value={company} readOnly={!editing} placeholder={editing ? "선택" : "-"} className={editing ? undefined : "bg-toss-soft"} onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <Field label="부서명">
            <Input value={department} readOnly={!editing} placeholder={editing ? "선택" : "-"} className={editing ? undefined : "bg-toss-soft"} onChange={(e) => setDepartment(e.target.value)} />
          </Field>
        </div>
        {editing && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cancel}>
              취소
            </Button>
            <Button type="submit" loading={saving} disabled={!dirty}>
              저장
            </Button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  invalid,
  autoComplete,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid?: boolean;
  autoComplete: string;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        invalid={invalid}
        className="pr-11"
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function PasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "현재 비밀번호를 입력해주세요.";
    if (next.length < 8) found.next = "새 비밀번호는 8자 이상으로 입력해주세요.";
    if (next !== confirm) found.confirm = "새 비밀번호가 일치하지 않습니다.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      toast.success("비밀번호를 변경했습니다.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "비밀번호를 변경하지 못했습니다.";
      if (message.includes("현재 비밀번호")) setErrors({ current: message });
      else toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard icon={Lock} tone="violet" title="비밀번호 변경" description="계정의 보안을 위해 8자 이상으로 설정해주세요.">
      <form onSubmit={save} className="space-y-5">
        <Field label="현재 비밀번호" required error={errors.current}>
          <PasswordInput autoComplete="current-password" value={current} placeholder="현재 비밀번호를 입력하세요." invalid={!!errors.current} onChange={setCurrent} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="새 비밀번호" required error={errors.next}>
            <PasswordInput autoComplete="new-password" value={next} placeholder="새 비밀번호를 입력하세요." invalid={!!errors.next} onChange={setNext} />
          </Field>
          <Field label="새 비밀번호 확인" required error={errors.confirm}>
            <PasswordInput autoComplete="new-password" value={confirm} placeholder="새 비밀번호를 다시 입력하세요." invalid={!!errors.confirm} onChange={setConfirm} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!current || !next || !confirm}>
            비밀번호 변경
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
