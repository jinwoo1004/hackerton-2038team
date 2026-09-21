import Image from "next/image";
import { cn } from "@/shared/lib/cn";
import { APP } from "@/shared/config/app";

export const LOGO_SRC = "/images/logo/logo_mark.png";

export function LogoMark({
  className,
  size = 28,
  tile = false,
}: {
  className?: string;
  size?: number;
  tile?: boolean;
}) {
  if (!tile) {
    return (
      <Image
        src={LOGO_SRC}
        alt=""
        width={size}
        height={size}
        priority
        className={cn("shrink-0 select-none", className)}
        aria-hidden
      />
    );
  }
  const inner = Math.round(size * 0.66);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[28%] bg-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.28)] ring-1 ring-black/[0.04]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Image src={LOGO_SRC} alt="" width={inner} height={inner} priority className="select-none" />
    </span>
  );
}

export function Logo({
  className,
  size = 28,
  showName = true,
}: {
  className?: string;
  size?: number;
  showName?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      {showName && (
        <span className="text-[15px] font-extrabold tracking-tight text-ink-900">{APP.name}</span>
      )}
    </span>
  );
}
