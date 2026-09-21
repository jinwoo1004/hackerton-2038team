"use client";

import { useEffect, useState } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function koreanDate(d: Date) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export function koreanTime(d: Date) {
  return `${d.getHours() < 12 ? "오전" : "오후"} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}
