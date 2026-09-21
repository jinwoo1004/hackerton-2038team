"use client";

import { cloneElement, forwardRef, isValidElement, useId } from "react";
import { cn } from "@/shared/lib/cn";

const base =
  "h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-300 focus:ring-2 disabled:bg-ink-100 disabled:text-ink-400";
const normal = "border-line focus:border-primary-400 focus:ring-primary-100";
const invalid = "border-danger/60 focus:border-danger focus:ring-danger/15";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid: isInvalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(base, isInvalid ? invalid : normal, className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid: isInvalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(base, "h-auto min-h-[96px] py-2.5 leading-relaxed", isInvalid ? invalid : normal, className)}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(base, normal, "cursor-pointer pr-9", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  // id가 없으면 라벨과 자동 연결
  const control =
    isValidElement<{ id?: string }>(children) && !children.props.id
      ? cloneElement(children, { id })
      : children;

  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {control}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}
