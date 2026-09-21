# Frontend — Monitoring Platform

Next.js 14 (App Router) · TypeScript · Tailwind CSS · lucide-react

디자인 언어는 사내 `moava-b2b-site` / `moava-b2b-app` 과 동일한 토큰 체계
(`ink` / `line` / `primary` / `toss` 팔레트, Pretendard, `rounded-2xl` 카드, `shadow-soft`)를 쓰고,
브랜드 축만 Blue 계열로 맞췄다.

## 실행

```bash
npm install
npm run dev          # http://localhost:3200
npm run build
npm run type-check
```

`.env.local` (없으면 목 모드):

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## 구조

```
src/
├─ app/                     # 라우팅
│  ├─ login, signup         # 인증 화면(셸 밖)
│  └─ (app)/                # 로그인 이후 공통 레이아웃
│     └─ projects/
│        ├─ new             # 5단계 생성 마법사
│        └─ [projectId]/    # 개요 · analysis · files · settings
├─ features/
│  ├─ auth/                 # AuthProvider, AuthLayout
│  └─ project/              # ProjectCard, ProjectContext, wizard/*
├─ widgets/layout/          # AppShell, Sidebar, Header, nav 정의
├─ shared/
│  ├─ ui/                   # Button, Input, Card, Modal, Toast, Stepper, FileDropzone ...
│  ├─ lib/                  # cn, format
│  └─ config/               # 서비스명·API 주소·업로드 한도 상수
├─ services/                # authApi, projectApi, fileApi, analysisApi + http 클라이언트
└─ types/                   # 백엔드 응답 계약
```

## 두 가지 규칙

1. **컴포넌트에서 fetch 를 직접 부르지 않는다.** 모든 호출은 `services/*Api.ts` 를 거친다.
2. **모든 조회 화면은 4가지 상태를 갖는다** — Loading(Skeleton) / Success / Empty / Error(재시도).

## 목(mock) 모드

`NEXT_PUBLIC_API_BASE_URL` 이 비어 있으면 `services/mock/store.ts` 의 로컬스토리지 어댑터가 동작한다.
실제 API 와 같은 타입을 반환하므로, 백엔드를 붙이는 순간 화면 코드는 그대로 둔다.

데모 계정: `admin@xisnd.com` / `test1234`

## 반응형

| 구간 | 레이아웃 |
| --- | --- |
| ~767px | 헤더 + 드로어 메뉴, 1단 폼, 하단 고정 액션바, FAB |
| 768~1279px | 사이드바 + 본문, 2단 그리드 |
| 1280px~ | 사이드바 + 본문, 3~4단 그리드 |

데스크톱에서 우측 상단에 두는 주요 액션은 모바일에서 하단 고정 바로 내린다(엄지 위치).
