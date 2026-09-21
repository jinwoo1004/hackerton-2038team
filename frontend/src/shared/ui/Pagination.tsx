import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";

const BTN = "flex h-10 min-w-[40px] items-center justify-center rounded-xl border px-3 text-[14px] font-bold tabular-nums transition";

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const start = Math.max(0, Math.min(page - 2, pages - 5));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  return (
    <nav className="flex items-center gap-1.5" aria-label="페이지">
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className={cn(BTN, "border-line bg-white text-ink-500 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40")}
      >
        <ChevronLeft size={16} />
      </button>
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === page ? "page" : undefined}
          onClick={() => onPage(n)}
          className={cn(BTN, n === page ? "border-primary-600 bg-primary-600 text-white" : "border-line bg-white text-ink-700 hover:bg-ink-100")}
        >
          {n + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="다음 페이지"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
        className={cn(BTN, "border-line bg-white text-ink-500 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40")}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export function PageSizeSelect({ value, onChange, options = [10, 20, 50] }: { value: number; onChange: (n: number) => void; options?: number[] }) {
  return (
    <label className="relative">
      <span className="sr-only">페이지당 개수</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 appearance-none rounded-xl border border-line bg-white pl-4 pr-10 text-[13px] font-semibold text-ink-700 outline-none transition hover:border-ink-300 focus:border-primary-500"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}개씩 보기
          </option>
        ))}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
    </label>
  );
}
