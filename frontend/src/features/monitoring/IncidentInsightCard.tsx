"use client";

import { useState } from "react";
import { BrainCircuit, MessageSquareText } from "lucide-react";
import { demoApi } from "@/services/demoApi";
import { Button } from "@/shared/ui/Button";
import { useToast } from "@/shared/ui/Toast";
import type { Incident, SlackPreview } from "@/types";

export function IncidentInsightCard({ incident }: { incident: Incident }) {
  const [preview, setPreview] = useState<SlackPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const insight = incident.insight;
  if (!insight) return null;
  const responseTime = `${insight.baselineResponseMs == null ? "미수집" : `${insight.baselineResponseMs}ms`} → ${insight.currentResponseMs == null ? "미수집" : `${insight.currentResponseMs}ms`}`;
  async function showPreview() {
    if (preview) { setPreview(null); return; }
    setLoading(true);
    try { setPreview(await demoApi.preview(incident.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "미리보기를 읽지 못했습니다."); }
    finally { setLoading(false); }
  }
  return (
    <section className="mt-3 rounded-xl border border-line bg-toss-soft p-4" aria-label="AI 장애 징후 설명">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-ink-900"><BrainCircuit size={16} className="text-primary-600" /> AI 장애 징후 설명</h3>
        <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500">{insight.source === "OPENAI" ? "OpenAI" : "로컬 근거 기반 설명"}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-700">{insight.summary}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        {[["대상 서버", insight.serverName], ["응답시간", responseTime], ["Timeout / 오류", `${insight.timeoutCount} / ${insight.errorCount}건`], ["위험도", insight.severity === "CRITICAL" ? "위험" : "주의"]].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white p-2.5"><dt className="text-[11px] font-semibold text-ink-400">{label}</dt><dd className="mt-1 break-words text-[12px] font-bold text-ink-900">{value}</dd></div>
        ))}
      </dl>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {[["관찰 근거", insight.evidence], ["가능 원인", insight.causes], ["권장 조치", insight.actions]].map(([title, items]) => (
          <div key={title as string}><h4 className="text-[12px] font-bold text-ink-800">{title}</h4><ul className="mt-1 space-y-1">{(items as string[]).map((text, i) => <li key={i} className="text-[12px] leading-relaxed text-ink-500">• {text}</li>)}</ul></div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3"><Button variant="secondary" size="sm" onClick={showPreview} loading={loading}><MessageSquareText size={14} />{preview ? "미리보기 닫기" : "Slack 메시지 미리보기"}</Button><span className="text-[11px] text-ink-400">발생 당시 관찰 데이터 · 원인은 확인이 필요한 가설입니다</span></div>
      {preview && <div className="mt-3 rounded-lg border border-line bg-white p-3" aria-live="polite"><p className="mb-2 text-[12px] font-bold text-primary-600">Slack 미리보기 · 외부 발송 아님</p><p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink-700">{preview.message}</p></div>}
    </section>
  );
}
