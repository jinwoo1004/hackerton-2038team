"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, Moon, Plus, Send, XCircle } from "lucide-react";
import { alertApi } from "@/services/alertApi";
import { projectApi } from "@/services/projectApi";
import { INCIDENT_RULES } from "@/features/monitoring/meta";
import { cn } from "@/shared/lib/cn";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { Card, CardHeader } from "@/shared/ui/Card";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ErrorState } from "@/shared/ui/EmptyState";
import { Field, Input, Select } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import { Skeleton } from "@/shared/ui/Skeleton";
import { SlackLogo } from "@/shared/ui/SlackLogo";
import { Segmented, Switch } from "@/shared/ui/Switch";
import { useToast } from "@/shared/ui/Toast";
import type {
  AlertChannel,
  AlertDelivery,
  AlertRule,
  AlertRuleRequest,
  IncidentRule,
  IncidentSeverity,
  Project,
} from "@/types";

type LoadState = "loading" | "ready" | "error";

const KIND_LABEL: Record<AlertDelivery["kind"], string> = {
  OPENED: "발생",
  ESCALATED: "격상",
  RESOLVED: "해결",
  TEST: "테스트",
};

const RULE_LABEL = Object.fromEntries(INCIDENT_RULES.map((r) => [r.value, r.label])) as Record<IncidentRule, string>;

export default function AlertSettingsPage() {
  const toast = useToast();
  const [state, setState] = useState<LoadState>("loading");
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [deliveries, setDeliveries] = useState<AlertDelivery[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [channelEdit, setChannelEdit] = useState<AlertChannel | "new" | null>(null);
  const [ruleEdit, setRuleEdit] = useState<AlertRule | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: "channel" | "rule"; id: number; name: string } | null>(null);
  const [testing, setTesting] = useState<number | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setState("loading");
    Promise.all([alertApi.channels(), alertApi.rules(), alertApi.deliveries(), projectApi.list()])
      .then(([c, r, d, p]) => {
        setChannels(c);
        setRules(r);
        setDeliveries(d);
        setProjects(p);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (silent) return;
        setError(err instanceof Error ? err.message : "알림 설정을 불러오지 못했습니다.");
        setState("error");
      });
  }, []);

  useEffect(() => load(), [load]);

  async function test(channel: AlertChannel) {
    setTesting(channel.id);
    try {
      const result = await alertApi.test(channel.id);
      if (result.success) toast.success(`${channel.name} 채널로 테스트 알림을 보냈습니다.`);
      else toast.error(result.error ?? "테스트 알림을 보내지 못했습니다.");
      load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "테스트 알림을 보내지 못했습니다.");
    } finally {
      setTesting(null);
    }
  }

  async function toggleChannel(channel: AlertChannel, enabled: boolean) {
    setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, enabled } : c)));
    try {
      await alertApi.updateChannel(channel.id, { name: channel.name, enabled });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "변경하지 못했습니다.");
      load(true);
    }
  }

  async function toggleRule(rule: AlertRule, enabled: boolean) {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
    try {
      await alertApi.updateRule(rule.id, toRequest(rule, { enabled }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "변경하지 못했습니다.");
      load(true);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === "channel") await alertApi.removeChannel(pendingDelete.id);
      else await alertApi.removeRule(pendingDelete.id);
      toast.success("삭제했습니다.");
      load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    }
  }

  return (
    <>
      {state === "loading" && (
        <div className="max-w-4xl space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {state === "error" && <ErrorState title="알림 설정을 불러오지 못했습니다." description={error} onRetry={() => load()} />}

      {state === "ready" && (
        <div className="max-w-4xl space-y-6">
          <Card className="overflow-hidden">
            <CardHeader
              title="알림 채널"
              icon={<SlackLogo size={20} />}
              description="이상이 생기면 이 채널로 메시지를 보냅니다. 지금은 Slack 을 지원합니다."
              actions={
                <Button size="sm" onClick={() => setChannelEdit("new")}>
                  <Plus size={15} strokeWidth={2.5} />
                  채널 추가
                </Button>
              }
            />
            {channels.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white">
                  <SlackLogo size={24} />
                </span>
                <p className="mt-3 text-[14px] font-bold text-ink-900">연결된 채널이 없습니다</p>
                <p className="mt-1 max-w-md text-[12px] leading-relaxed text-ink-400">
                  Slack 채널의 Incoming Webhook 주소를 등록하면 담당자에게 바로 알림이 갑니다.
                </p>
              </div>
            ) : (
              <ul>
                {channels.map((c) => (
                  <li key={c.id} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-center">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white">
                      <SlackLogo size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-ink-900">{c.name}</p>
                      <p className="truncate font-mono text-[12px] text-ink-400">{c.target}</p>
                      <p className="mt-1 text-[12px]">
                        {c.lastError ? (
                          <span className="text-toss-red">최근 실패: {c.lastError}</span>
                        ) : c.lastSentAt ? (
                          <span className="text-ink-400">최근 발송 {formatRelative(c.lastSentAt)}</span>
                        ) : (
                          <span className="text-ink-400">아직 보낸 알림이 없습니다</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" loading={testing === c.id} onClick={() => test(c)}>
                        {testing !== c.id && <Send size={14} />}
                        테스트 발송
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setChannelEdit(c)}>
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-ink-400 hover:bg-toss-red-soft hover:text-toss-red"
                        onClick={() => setPendingDelete({ kind: "channel", id: c.id, name: c.name })}
                      >
                        삭제
                      </Button>
                      <Switch checked={c.enabled} onChange={(v) => toggleChannel(c, v)} label={`${c.name} 사용`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="알림 규칙"
              description="어떤 이상을 어느 채널로 보낼지 정합니다. 같은 이상은 10분 안에 다시 보내지 않습니다."
              actions={
                <Button size="sm" onClick={() => setRuleEdit("new")} disabled={channels.length === 0}>
                  <Plus size={15} strokeWidth={2.5} />
                  규칙 추가
                </Button>
              }
            />
            {rules.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white">
                  <BellRing size={22} strokeWidth={2} />
                </span>
                <p className="mt-3 text-[14px] font-bold text-ink-900">
                  {channels.length === 0 ? "먼저 알림 채널을 추가해주세요" : "알림 규칙이 없습니다"}
                </p>
                <p className="mt-1 max-w-md text-[12px] leading-relaxed text-ink-400">
                  규칙이 없으면 이상이 생겨도 화면과 이벤트에만 기록되고 메시지는 보내지 않습니다.
                </p>
              </div>
            ) : (
              <ul>
                {rules.map((r) => (
                  <li key={r.id} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-ink-900">
                        {r.name}
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                            r.minSeverity === "CRITICAL" ? "bg-toss-red-soft text-toss-red" : "bg-toss-amber-soft text-toss-amber",
                          )}
                        >
                          {r.minSeverity === "CRITICAL" ? "심각만" : "주의 이상"}
                        </span>
                      </p>
                      <p className="mt-1 text-[12px] text-ink-500">
                        {r.projectName ?? "모든 프로젝트"} → <span className="font-semibold text-ink-700">{r.channelName ?? "삭제된 채널"}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        {(r.rules.length ? r.rules : (["ALL"] as const)).map((key) => (
                          <span key={key} className="rounded-md bg-ink-100 px-1.5 py-0.5 font-semibold text-ink-600">
                            {key === "ALL" ? "모든 유형" : RULE_LABEL[key]}
                          </span>
                        ))}
                        {r.notifyResolved && (
                          <span className="rounded-md bg-toss-green-soft px-1.5 py-0.5 font-semibold text-toss-green">해결 알림</span>
                        )}
                        {r.quietStart && r.quietEnd && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 font-semibold text-ink-600">
                            <Moon size={11} />
                            {r.quietStart.slice(0, 5)}~{r.quietEnd.slice(0, 5)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setRuleEdit(r)}>
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-ink-400 hover:bg-toss-red-soft hover:text-toss-red"
                        onClick={() => setPendingDelete({ kind: "rule", id: r.id, name: r.name })}
                      >
                        삭제
                      </Button>
                      <Switch checked={r.enabled} onChange={(v) => toggleRule(r, v)} label={`${r.name} 사용`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="최근 발송 기록" description="최근 30건" />
            {deliveries.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-ink-400">아직 보낸 알림이 없습니다.</p>
            ) : (
              <ul>
                {deliveries.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-0">
                    {d.success ? (
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-toss-green" />
                    ) : (
                      <XCircle size={17} className="mt-0.5 shrink-0 text-toss-red" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink-900">{d.title}</p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-400">
                        {d.channelName} · {KIND_LABEL[d.kind]}
                        {d.error && <span className="text-toss-red"> · {d.error}</span>}
                      </p>
                    </div>
                    <time className="shrink-0 text-[12px] tabular-nums text-ink-400" title={formatDateTime(d.sentAt)}>
                      {formatRelative(d.sentAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <ChannelModal
        target={channelEdit}
        onClose={() => setChannelEdit(null)}
        onSaved={() => {
          setChannelEdit(null);
          load(true);
        }}
      />

      <RuleModal
        target={ruleEdit}
        channels={channels}
        projects={projects}
        onClose={() => setRuleEdit(null)}
        onSaved={() => {
          setRuleEdit(null);
          load(true);
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete?.kind === "channel" ? "알림 채널을 삭제할까요?" : "알림 규칙을 삭제할까요?"}
        description={
          pendingDelete?.kind === "channel"
            ? `${pendingDelete.name} 채널과 이 채널을 쓰는 규칙이 함께 삭제됩니다.`
            : pendingDelete
              ? `${pendingDelete.name} 규칙이 삭제됩니다.`
              : undefined
        }
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}

function toRequest(rule: AlertRule, patch: Partial<AlertRuleRequest> = {}): AlertRuleRequest {
  return {
    name: rule.name,
    projectId: rule.projectId ?? null,
    channelId: rule.channelId,
    minSeverity: rule.minSeverity,
    rules: rule.rules,
    notifyResolved: rule.notifyResolved,
    quietStart: rule.quietStart ?? null,
    quietEnd: rule.quietEnd ?? null,
    enabled: rule.enabled,
    ...patch,
  };
}

function ChannelModal({
  target,
  onClose,
  onSaved,
}: {
  target: AlertChannel | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = target && target !== "new" ? target : null;
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setName(editing?.name ?? "");
    setUrl("");
    setErrors({});
  }, [target, editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!name.trim()) found.name = "채널 이름을 입력해주세요.";
    if (!editing && !url.trim()) found.url = "Webhook 주소를 입력해주세요.";
    if (url.trim() && !url.trim().startsWith("https://hooks.slack.com/")) {
      found.url = "https://hooks.slack.com/services/ 로 시작하는 주소를 입력해주세요.";
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const body = { name: name.trim(), type: "SLACK" as const, webhookUrl: url.trim() || undefined };
      if (editing) await alertApi.updateChannel(editing.id, body);
      else await alertApi.createChannel(body);
      toast.success(editing ? "채널을 수정했습니다." : "채널을 추가했습니다. 테스트 발송으로 연결을 확인해보세요.");
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "저장하지 못했습니다.";
      if (message.includes("Webhook")) setErrors({ url: message });
      else toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={editing ? "알림 채널 수정" : "Slack 채널 추가"}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="channel-form" loading={saving}>
            저장
          </Button>
        </>
      }
    >
      <form id="channel-form" onSubmit={submit} className="space-y-5">
        <Field label="채널 이름" required error={errors.name}>
          <Input value={name} placeholder="예: 운영팀 알림" maxLength={60} invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Incoming Webhook 주소"
          required={!editing}
          error={errors.url}
          hint={editing ? "바꿀 때만 입력하세요. 저장된 주소는 보안을 위해 가려서 보여드립니다." : undefined}
        >
          <Input
            value={url}
            placeholder="https://hooks.slack.com/services/..."
            invalid={!!errors.url}
            onChange={(e) => setUrl(e.target.value)}
            className="font-mono text-[13px]"
          />
        </Field>
        <div className="rounded-xl bg-toss-soft px-4 py-3 text-[12px] leading-relaxed text-ink-500">
          Slack 앱 설정에서 Incoming Webhooks 를 켜고, 알림을 받을 채널을 골라 만든 주소를 붙여넣으세요.
        </div>
      </form>
    </Modal>
  );
}

const SEVERITIES = [
  { value: "WARNING", label: "주의 이상" },
  { value: "CRITICAL", label: "심각만" },
] as const;

function RuleModal({
  target,
  channels,
  projects,
  onClose,
  onSaved,
}: {
  target: AlertRule | "new" | null;
  channels: AlertChannel[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = target && target !== "new" ? target : null;
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [channelId, setChannelId] = useState<string>("");
  const [minSeverity, setMinSeverity] = useState<IncidentSeverity>("WARNING");
  const [selected, setSelected] = useState<IncidentRule[]>([]);
  const [notifyResolved, setNotifyResolved] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setName(editing?.name ?? "운영 알림");
    setProjectId(editing?.projectId ? String(editing.projectId) : "");
    setChannelId(String(editing?.channelId ?? channels[0]?.id ?? ""));
    setMinSeverity(editing?.minSeverity ?? "WARNING");
    setSelected(editing?.rules ?? []);
    setNotifyResolved(editing?.notifyResolved ?? true);
    setQuiet(!!editing?.quietStart);
    setQuietStart(editing?.quietStart?.slice(0, 5) ?? "22:00");
    setQuietEnd(editing?.quietEnd?.slice(0, 5) ?? "08:00");
    setError("");
  }, [target, editing, channels]);

  function toggleRule(rule: IncidentRule) {
    setSelected((prev) => (prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("규칙 이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    const body: AlertRuleRequest = {
      name: name.trim(),
      projectId: projectId ? Number(projectId) : null,
      channelId: Number(channelId),
      minSeverity,
      rules: selected,
      notifyResolved,
      quietStart: quiet ? quietStart : null,
      quietEnd: quiet ? quietEnd : null,
      enabled: editing?.enabled ?? true,
    };
    try {
      if (editing) await alertApi.updateRule(editing.id, body);
      else await alertApi.createRule(body);
      toast.success(editing ? "규칙을 수정했습니다." : "규칙을 추가했습니다.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={editing ? "알림 규칙 수정" : "알림 규칙 추가"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="rule-form" loading={saving}>
            저장
          </Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="규칙 이름" required error={error}>
            <Input value={name} maxLength={80} invalid={!!error} onChange={(e) => { setName(e.target.value); setError(""); }} />
          </Field>
          <Field label="보낼 채널" required>
            <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="대상 프로젝트">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">모든 프로젝트</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="심각도">
            <Segmented options={SEVERITIES} value={minSeverity} onChange={setMinSeverity} className="w-full [&>button]:flex-1" />
          </Field>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-ink-700">이상 유형</p>
          <p className="mt-0.5 text-[12px] text-ink-400">고르지 않으면 모든 유형을 보냅니다.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {INCIDENT_RULES.map((r) => {
              const on = selected.includes(r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleRule(r.value)}
                  className={cn(
                    "rounded-xl border px-3.5 py-2.5 text-left transition",
                    on ? "border-primary-500 bg-primary-50" : "border-line bg-white hover:border-ink-300",
                  )}
                >
                  <span className={cn("block text-[13px] font-bold", on ? "text-primary-700" : "text-ink-900")}>{r.label}</span>
                  <span className="block text-[11px] text-ink-400">{r.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line">
          <label className="flex items-center justify-between gap-4 px-4 py-3">
            <span>
              <span className="block text-[13px] font-semibold text-ink-900">해결되면 알려주기</span>
              <span className="block text-[12px] text-ink-400">이상이 사라지면 해결 메시지를 한 번 더 보냅니다.</span>
            </span>
            <Switch checked={notifyResolved} onChange={setNotifyResolved} label="해결 알림" />
          </label>
          <div className="px-4 py-3">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-[13px] font-semibold text-ink-900">조용한 시간</span>
                <span className="block text-[12px] text-ink-400">이 시간에는 심각 알림만 보냅니다.</span>
              </span>
              <Switch checked={quiet} onChange={setQuiet} label="조용한 시간" />
            </label>
            {quiet && (
              <div className="mt-3 flex items-center gap-2">
                <Input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="w-36" />
                <span className="text-ink-400">~</span>
                <Input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="w-36" />
              </div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
