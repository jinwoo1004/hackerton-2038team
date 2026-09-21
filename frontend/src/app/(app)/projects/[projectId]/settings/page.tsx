"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { projectApi } from "@/services/projectApi";
import { useProject } from "@/features/project/ProjectContext";
import { TECH_GROUPS } from "@/features/project/techOptions";
import { Button } from "@/shared/ui/Button";
import { Card, CardBody, CardHeader } from "@/shared/ui/Card";
import { ChipSelect } from "@/shared/ui/ChipSelect";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Field, Input, Textarea } from "@/shared/ui/Input";
import { useToast } from "@/shared/ui/Toast";
import { EMPTY_TECH } from "@/features/project/wizard/types";
import type { ProjectTechnology, TechCategory } from "@/types";

export default function ProjectSettingsPage() {
  const { project, patch } = useProject();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [description, setDescription] = useState("");
  const [tech, setTech] = useState<Record<TechCategory, string[]>>(EMPTY_TECH);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setNickname(project.nickname ?? "");
    setDescription(project.description ?? "");
    setTech({
      LANGUAGE: project.technologies.filter((t) => t.category === "LANGUAGE").map((t) => t.name),
      FRAMEWORK: project.technologies.filter((t) => t.category === "FRAMEWORK").map((t) => t.name),
      DATABASE: project.technologies.filter((t) => t.category === "DATABASE").map((t) => t.name),
      INFRASTRUCTURE: project.technologies
        .filter((t) => t.category === "INFRASTRUCTURE")
        .map((t) => t.name),
    });
  }, [project]);

  if (!project) return null;

  async function save() {
    if (!project) return;
    if (!name.trim()) {
      setNameError("프로젝트 이름을 입력해주세요.");
      return;
    }
    setNameError("");
    setSaving(true);
    try {
      const technologies: ProjectTechnology[] = (
        Object.entries(tech) as [TechCategory, string[]][]
      ).flatMap(([category, names]) => names.map((n) => ({ category, name: n })));

      const updated = await projectApi.update(project.id, {
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        description: description.trim() || undefined,
        technologies,
      });
      patch(updated);
      toast.success("프로젝트 정보를 저장했습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!project) return;
    try {
      await projectApi.remove(project.id);
      toast.success("프로젝트를 삭제했습니다.");
      router.replace("/projects");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    }
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <Card>
        <CardHeader title="기본 정보" description="목록과 상세 화면에 표시되는 정보입니다." />
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="프로젝트 이름" required error={nameError}>
              <Input value={name} invalid={!!nameError} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="프로젝트 닉네임">
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </Field>
          </div>
          <Field label="프로젝트 코드" hint="코드는 생성 후 변경할 수 없습니다.">
            <Input value={project.projectCode} disabled className="font-mono" />
          </Field>
          <Field label="프로젝트 설명">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="기술 스택" description="선택한 기술을 기준으로 소스와 로그를 해석합니다." />
        <CardBody className="space-y-6">
          {TECH_GROUPS.map((group) => (
            <div key={group.category}>
              <h4 className="mb-2.5 text-[13px] font-bold text-ink-700">{group.label}</h4>
              <ChipSelect
                options={[
                  ...group.options,
                  ...tech[group.category].filter((n) => !group.options.includes(n)),
                ]}
                value={tech[group.category]}
                onChange={(next) => setTech((prev) => ({ ...prev, [group.category]: next }))}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="hidden justify-end sm:flex">
        <Button onClick={save} loading={saving}>
          변경사항 저장
        </Button>
      </div>

      <Card className="border-danger/25">
        <CardHeader title="프로젝트 삭제" description="삭제하면 등록된 파일과 분석 이력도 함께 사라집니다." />
        <CardBody>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            프로젝트 삭제
          </Button>
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 backdrop-blur sm:hidden">
        <Button size="lg" onClick={save} loading={saving} className="w-full">
          변경사항 저장
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="프로젝트를 삭제할까요?"
        description={`${project.name} 프로젝트와 등록된 파일·분석 이력이 모두 삭제됩니다. 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        danger
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
