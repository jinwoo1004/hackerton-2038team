"use client";

import { notFound, useParams } from "next/navigation";
import { ProjectProvider } from "@/features/project/ProjectContext";
import { ProjectDetailShell } from "@/features/project/ProjectDetailShell";

export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params?.projectId);
  if (!Number.isFinite(projectId)) notFound();

  return (
    <ProjectProvider projectId={projectId}>
      <ProjectDetailShell>{children}</ProjectDetailShell>
    </ProjectProvider>
  );
}
