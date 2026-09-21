import { cn } from "@/shared/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="mt-4 h-6 w-40" />
      <Skeleton className="mt-2 h-4 w-28" />
      <div className="mt-4 flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4 shadow-soft">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="mt-3 h-7 w-24" />
    </div>
  );
}
