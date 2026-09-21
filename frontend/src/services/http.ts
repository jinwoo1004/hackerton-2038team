import { API_BASE_URL } from "@/shared/config/app";

const TOKEN_KEY = "mp.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export const UNAUTHORIZED_EVENT = "mp:unauthorized";

function handleUnauthorized(path: string, status: number) {
  if (status !== 401 || path.startsWith("/api/auth/login") || path.startsWith("/api/auth/signup")) return;
  if (!getToken()) return;
  setToken(null);
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  json?: unknown;
  body?: BodyInit;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((headers as Record<string, string>) ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("서버에 연결하지 못했습니다. 네트워크 상태를 확인해주세요.", 0);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    handleUnauthorized(path, res.status);
    const message =
      (data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : null) ?? `요청을 처리하지 못했습니다. (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

// 업로드 진행률 때문에 XHR 사용
export function upload<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError("업로드에 실패했습니다.", 0));
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = xhr.responseText;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(data as T);
      } else {
        handleUnauthorized(path, xhr.status);
        const message =
          data && typeof data === "object" && "message" in data && typeof data.message === "string"
            ? data.message
            : `업로드에 실패했습니다. (${xhr.status})`;
        reject(new ApiError(message, xhr.status));
      }
    };
    xhr.send(formData);
  });
}
