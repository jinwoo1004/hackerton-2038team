import { cn } from "@/shared/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-white shadow-soft", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-ink-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function InfoRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-line py-3 last:border-0 sm:flex-row sm:items-start sm:gap-4",
        className,
      )}
    >
      <dt className="shrink-0 text-[13px] font-semibold text-ink-500 sm:w-36">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-ink-900">{children}</dd>
    </div>
  );
}
