"use client";

import { useRef } from "react";
import { cn } from "@/shared/lib/cn";

export function DragScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; left: number } | null>(null);
  const moved = useRef(false);

  return (
    <div
      ref={ref}
      className={cn("overflow-x-auto", className)}
      onPointerDown={(e) => {
        moved.current = false;
        if (e.pointerType !== "mouse" || !ref.current || ref.current.scrollWidth <= ref.current.clientWidth) return;
        start.current = { x: e.clientX, left: ref.current.scrollLeft };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s || !ref.current) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 4) moved.current = true;
        if (moved.current) ref.current.scrollLeft = s.left - dx;
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerLeave={() => {
        start.current = null;
      }}
      onClickCapture={(e) => {
        // 끌어서 옮긴 직후에는 링크가 눌리지 않게 한다
        if (moved.current) e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}
