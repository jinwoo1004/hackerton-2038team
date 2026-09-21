import { USE_MOCK } from "@/shared/config/app";
import type { ProjectFile, ProjectFileType } from "@/types";
import { request, upload } from "./http";
import { mockApi } from "./mock/store";

function fakeProgress(onProgress?: (p: number) => void): Promise<void> {
  if (!onProgress) return Promise.resolve();
  return new Promise((resolve) => {
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 22 + 8;
      if (p >= 100) {
        clearInterval(id);
        onProgress(100);
        resolve();
      } else {
        onProgress(Math.round(p));
      }
    }, 160);
  });
}

export const fileApi = {
  list(projectId: number): Promise<ProjectFile[]> {
    if (USE_MOCK) return mockApi.listFiles(projectId);
    return request<ProjectFile[]>(`/api/projects/${projectId}/files`);
  },

  async upload(
    projectId: number,
    file: File,
    fileType: ProjectFileType,
    onProgress?: (percent: number) => void,
  ): Promise<ProjectFile> {
    if (USE_MOCK) {
      await fakeProgress(onProgress);
      return mockApi.addFile(projectId, file, fileType);
    }
    const form = new FormData();
    form.append("file", file);
    form.append("fileType", fileType);
    return upload<ProjectFile>(`/api/projects/${projectId}/files`, form, onProgress);
  },

  remove(projectId: number, fileId: number): Promise<void> {
    if (USE_MOCK) return mockApi.deleteFile(fileId);
    return request<void>(`/api/projects/${projectId}/files/${fileId}`, { method: "DELETE" });
  },
};
