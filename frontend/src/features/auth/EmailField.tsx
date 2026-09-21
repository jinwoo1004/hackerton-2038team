"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EMAIL_DOMAINS } from "@/shared/config/app";
import { cn } from "@/shared/lib/cn";

const CUSTOM = "__custom__";

export function EmailField({
  value,
  onChange,
  invalid,
  id,
}: {
  value: string;
  onChange: (email: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  const [domain, setDomain] = useState<string>(EMAIL_DOMAINS[0]);
  const custom = domain === CUSTOM;

  function changeDomain(next: string) {
    setDomain(next);
    const local = value.split("@")[0] ?? "";
    onChange(next === CUSTOM ? local : local ? `${local}@${next}` : "");
  }

  const localPart = value.split("@")[0] ?? "";

  function handleInput(raw: string) {
    const next = raw.trim();
    if (custom) {
      onChange(next);
      return;
    }
    // 전체 주소가 들어오면 직접 입력으로 전환
    if (next.includes("@")) {
      setDomain(CUSTOM);
      onChange(next);
      return;
    }
    onChange(next ? `${next}@${domain}` : "");
  }

  return (
    <div
      className={cn(
        "flex h-11 w-full items-center rounded-lg border bg-white transition focus-within:ring-2",
        invalid
          ? "border-danger/60 focus-within:border-danger focus-within:ring-danger/15"
          : "border-line focus-within:border-primary-400 focus-within:ring-primary-100",
      )}
    >
      <input
        id={id}
        type={custom ? "email" : "text"}
        autoComplete={custom ? "email" : "username"}
        placeholder={custom ? "name@company.com" : "아이디"}
        value={custom ? value : localPart}
        aria-invalid={invalid || undefined}
        onChange={(e) => handleInput(e.target.value)}
        className="h-full min-w-0 flex-1 rounded-l-lg bg-transparent px-3.5 text-sm text-ink-900 outline-none placeholder:text-ink-300"
      />

      <span className="h-5 w-px shrink-0 bg-line" aria-hidden />

      <span className="relative flex h-full shrink-0 items-center">
        <select
          value={domain}
          aria-label="이메일 도메인"
          onChange={(e) => changeDomain(e.target.value)}
          className="h-full cursor-pointer appearance-none rounded-r-lg bg-transparent py-0 pl-3 pr-8 text-sm font-medium text-ink-600 outline-none"
        >
          {EMAIL_DOMAINS.map((d) => (
            <option key={d} value={d}>
              @{d}
            </option>
          ))}
          <option value={CUSTOM}>직접 입력</option>
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
      </span>
    </div>
  );
}
