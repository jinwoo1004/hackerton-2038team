import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm",
  secondary: "bg-white text-ink-700 border border-line hover:bg-ink-100 active:bg-ink-200",
  ghost: "bg-transparent text-ink-600 hover:bg-ink-100 active:bg-ink-200",
  subtle: "bg-primary-50 text-primary-700 hover:bg-primary-100",
  danger: "bg-danger text-white hover:brightness-95 active:brightness-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
};

const iconSizes: Record<Size, string> = {
  sm: "h-9 w-9 p-0",
  md: "h-10 w-10 p-0",
  lg: "h-12 w-12 p-0",
};

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function buttonClass({
  variant = "primary",
  size = "md",
  iconOnly = false,
  className,
}: {
  variant?: Variant;
  size?: Size;
  iconOnly?: boolean;
  className?: string;
} = {}) {
  return cn(BASE, variants[variant], iconOnly ? iconSizes[size] : sizes[size], className);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size = "md", loading = false, iconOnly, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass({ variant, size, iconOnly, className })}
      {...props}
    >
      {loading && <Loader2 size={size === "lg" ? 18 : 16} className="animate-spin" />}
      {children}
    </button>
  );
});

interface LinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  iconOnly?: boolean;
}

export function LinkButton({ variant, size = "md", iconOnly, className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass({ variant, size, iconOnly, className })} {...props} />;
}
