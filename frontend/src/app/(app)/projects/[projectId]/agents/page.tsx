"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, KeyRound, Plus, Server } from "lucide-react";
import { agentApi, type InstallerInfo } from "@/services/agentApi";
import { AgentCard } from "@/features/monitoring/AgentCard";
import { useProject } from "@/features/project/ProjectContext";
import { API_BASE_URL, USE_MOCK } from "@/shared/config/app";
import { cn } from "@/shared/lib/cn";
import { formatBytes } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ErrorState } from "@/shared/ui/EmptyState";
import { Field, Input } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import { Skeleton } from "@/shared/ui/Skeleton";
import { useToast } from "@/shared/ui/Toast";
import type { Agent, AgentCreated } from "@/types";

type LoadState = "loading" | "ready" | "error";

const REFRESH_MS = 15_000;

const STEPS = [
  { title: "에이전트 등록", text: "이름을 정하면 이 서버 전용 토큰을 발급해드려요." },
  { title: "서버에 설치", text: "설치 파일을 실행하고 서버 주소와 토큰을 붙여넣어요." },
  { title: "자동 수집", text: "로그 폴더를 고르면 로그와 CPU·메모리·디스크가 모이기 시작해요." },
];

export default function ProjectAgentsPage() {
  const { project } = useProject();
  const toast = useToast();
  const [state, setState] = useState<LoadState>("loading");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [installer, setInstaller] = useState<InstallerInfo>({ available: false });
  const [error, setError] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Agent | null>(null);

  const projectId = project?.id;

  const load = useCallback(
    (silent = false) => {
      if (!projectId) return;
      if (!silent) setState("loading");
      agentApi
        .list(projectId)
        .then((list) => {
          setAgents(list);
          setState("ready");
        })
        .catch((err: unknown) => {
          if (silent) return;
          setError(err instanceof Error ? err.message : "에이전트 목록을 불러오지 못했습니다.");
          setState("error");
        });
    },
    [projectId],
  );

  useEffect(() => {
    load();
    agentApi.installer().then(setInstaller).catch(() => {});
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!project) return null;

  async function remove(agent: Agent) {
    try {
      await agentApi.remove(project!.id, agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
      toast.success(`${agent.name} 에이전트를 삭제했습니다.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    }
  }

  if (state === "error") {
    return <ErrorState title="에이전트 목록을 불러오지 못했습니다." description={error} onRetry={() => load()} />;
  }

  const online = agents.filter((a) => a.state === "ONLINE").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-ink-900">수집 에이전트</p>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {agents.length
              ? `${agents.length}대 중 ${online}대가 로그와 자원 사용량을 보내고 있습니다.`
              : "서버에 설치하면 로그와 자원 사용량이 자동으로 모입니다."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {installer.available && installer.fileName && <InstallerButton info={installer} />}
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus size={16} strokeWidth={2.5} />
            에이전트 등록
          </Button>
        </div>
      </div>

      {state === "loading" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-toss-soft/60 px-6 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white text-primary-600 shadow-soft">
              <Server size={24} strokeWidth={1.7} />
            </span>
            <p className="mt-5 text-[20px] font-extrabold tracking-tight text-ink-900">서버를 연결해볼까요?</p>
            <p className="mt-1.5 text-[14px] text-ink-500">세 단계면 실시간 로그와 서버 상태를 볼 수 있어요.</p>
          </div>
          <ol className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-white p-5 text-left">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-[13px] font-extrabold text-white">
                  {i + 1}
                </span>
                <p className="mt-3 text-[15px] font-bold text-ink-900">{s.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex justify-center">
            <Button size="lg" onClick={() => setRegisterOpen(true)}>
              에이전트 등록하기
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      <RegisterAgentModal
        open={registerOpen}
        projectId={project.id}
        installer={installer}
        suggestedName={`${project.projectCode.toLowerCase()}-server-${agents.length + 1}`}
        onClose={() => setRegisterOpen(false)}
        onCreated={(created) => setAgents((prev) => [...prev, created.agent])}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="에이전트를 삭제할까요?"
        description={
          pendingDelete
            ? `${pendingDelete.name} 의 토큰이 폐기되고 지금까지 받은 로그와 지표도 함께 삭제됩니다. 서버에 설치된 프로그램은 따로 제거해주세요.`
            : undefined
        }
        confirmLabel="삭제"
        danger
        onConfirm={async () => {
          if (pendingDelete) await remove(pendingDelete);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function InstallerButton({ info, className }: { info: InstallerInfo; className?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        try {
          await agentApi.downloadInstaller(info.fileName!);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "설치 파일을 받지 못했습니다.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {!busy && <Download size={16} />}
      설치 파일 받기
      {info.sizeBytes ? <span className="font-medium text-ink-400">{formatBytes(info.sizeBytes)}</span> : null}
    </Button>
  );
}

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-[12px] font-semibold text-ink-500">{label}</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-toss-soft px-3.5 py-2.5">
        <span className={cn("min-w-0 flex-1 break-all text-[13px] text-ink-900", mono && "font-mono")}>{value}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
            copied ? "bg-toss-green-soft text-toss-green" : "bg-white text-ink-600 hover:bg-ink-100",
          )}
        >
          {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
    </div>
  );
}

function RegisterAgentModal({
  open,
  projectId,
  installer,
  suggestedName,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: number;
  installer: InstallerInfo;
  suggestedName: string;
  onClose: () => void;
  onCreated: (created: AgentCreated) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<AgentCreated | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const suggestedRef = useRef(suggestedName);
  suggestedRef.current = suggestedName;

  // 발급 직후 목록이 늘며 추천 이름이 바뀌어도 토큰 화면이 초기화되지 않게 열릴 때만 비운다
  useEffect(() => {
    if (!open) return;
    setName(suggestedRef.current);
    setError("");
    setCreated(null);
    setShowConfig(false);
  }, [open]);

  const server = USE_MOCK ? "http://백엔드-주소:8080" : API_BASE_URL;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("에이전트 이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const result = await agentApi.create(projectId, name.trim());
      setCreated(result);
      onCreated(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "에이전트를 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const config = created
    ? JSON.stringify(
        {
          server,
          token: created.token,
          logs: [{ path: "C:\\app\\logs\\*.log" }],
          metricsIntervalSeconds: 15,
        },
        null,
        2,
      )
    : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={created ? "에이전트를 등록했어요" : "에이전트 등록"}
      description={created ? created.agent.name : "서버마다 하나씩 등록해주세요."}
      width="max-w-xl"
      footer={
        created ? (
          <Button onClick={onClose}>확인했어요</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" form="register-agent" loading={saving}>
              토큰 발급
            </Button>
          </>
        )
      }
    >
      {!created ? (
        <form id="register-agent" onSubmit={submit} className="space-y-4">
          <Field label="에이전트 이름" required error={error} hint="화면과 알림에 표시됩니다. 서버 이름을 쓰면 알아보기 쉬워요.">
            <Input
              value={name}
              autoFocus
              maxLength={80}
              invalid={!!error}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
          </Field>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl bg-toss-amber-soft px-4 py-3 text-[13px] leading-relaxed text-ink-800">
            <KeyRound size={17} className="mt-0.5 shrink-0 text-toss-amber" />
            토큰은 지금 한 번만 보여드려요. 창을 닫기 전에 복사해두세요. 잃어버리면 에이전트를 다시 등록하면 됩니다.
          </div>

          <CopyField label="에이전트 토큰" value={created.token} />
          <CopyField label="서버 주소" value={server} />

          <ol className="space-y-3">
            {[
              "서버에서 설치 파일을 관리자 권한으로 실행합니다.",
              "서버 주소와 토큰을 붙여넣습니다.",
              "수집할 로그 폴더를 고르면 바로 수집을 시작합니다.",
            ].map((text, i) => (
              <li key={text} className="flex items-start gap-3 text-[14px] text-ink-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[12px] font-extrabold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{text}</span>
              </li>
            ))}
          </ol>

          {installer.available && installer.fileName && <InstallerButton info={installer} className="w-full" />}

          <div className="rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-semibold text-ink-700"
            >
              설정 파일로 직접 설치하기
              <span className="text-ink-400">{showConfig ? "접기" : "펼치기"}</span>
            </button>
            {showConfig && (
              <div className="border-t border-line px-4 py-3">
                <p className="text-[12px] leading-relaxed text-ink-500">
                  <span className="font-mono">C:\ProgramData\MonitoringAgent\agent.json</span> 에 저장하고 서비스를 다시 시작하세요.
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-900 px-3.5 py-3 text-[12px] leading-relaxed text-ink-100">
                  <code>{config}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
