"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { projectApi } from "@/services/projectApi";
import type { Project } from "@/types";

type LoadState = "loading" | "ready" | "error";

interface ProjectContextValue {
  project: Project | null;
  state: LoadState;
  error: string;
  reload: () => void;
  refresh: () => void;
  patch: (next: Partial<Project>) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  projectId,
  children,
}: {
  projectId: number;
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setState("loading");
    projectApi
      .get(projectId)
      .then((p) => {
        setProject(p);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "프로젝트를 불러오지 못했습니다.");
        setState("error");
      });
  }, [projectId]);

  useEffect(reload, [reload]);

  // 화면 전환 없이 최신 상태만 반영
  const refresh = useCallback(() => {
    projectApi.get(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  const patch = useCallback((next: Partial<Project>) => {
    setProject((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  const value = useMemo(
    () => ({ project, state, error, reload, refresh, patch }),
    [project, state, error, reload, refresh, patch],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject 는 ProjectProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
