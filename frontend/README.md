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

기본 실행은 백엔드 없는 시연 모드다. 로그인 화면에서 **데모 둘러보기**를 누르면 준비된 여러 업무 시스템·분석 이력·운영 그래프를 확인할 수 있다. 상태는 현재 브라우저에 저장되며 다른 방문자와 공유되지 않는다. 운영 수치와 AI 설명은 합성 시연 데이터다.

`.env.local` (설정이 없어도 기본값 `mock`):

```
NEXT_PUBLIC_DATA_MODE=mock
```

## Vercel 배포 (52g Studio / g-20)

기존 `g-20` 프로젝트에 `jinwoo1004/hackerton-2038team` 저장소를 연결한다. Root Directory는 `frontend`, Framework는 Next.js다. **Include source files outside of the Root Directory in the Build Step**을 켜야 `prebuild`가 저장소의 `demo-fixtures`를 복사할 수 있다. 설치·빌드 명령은 `vercel.json`을 사용한다.

Production과 Preview 모두 `NEXT_PUBLIC_DATA_MODE=mock`으로 배포한다. 기본값도 `mock`이므로 환경변수 없이 빌드할 수 있다. `NEXT_PUBLIC_API_BASE_URL`과 서버 secret은 필요 없다. 오래된 API 주소가 남아 있어도 mock 모드는 무시하며 백엔드·OpenAI·OAuth를 호출하지 않는다. 상단의 **시연 데이터 · DEMO** 표시로 실제 운영 데이터와 구분한다.

### 실제 백엔드 연결을 다시 사용할 때

`NEXT_PUBLIC_DATA_MODE=api`를 명시하고 `NEXT_PUBLIC_API_BASE_URL`에 Spring Boot 주소를 지정한다(로컬 예: `http://localhost:18080`, Vercel 예: `https://api.example.com`). Vercel의 api 모드는 공개 HTTPS origin이 없으면 빌드에 실패한다. 실제 AI 인증은 서버의 `APP_RUNTIME=deployed`, `LLM_PROVIDER=openai_api` 설정에서만 처리한다.

백엔드 CORS 허용 목록에는 실제 Vercel 도메인을 명시한다. 임의 preview 도메인을 와일드카드로 허용하지 않으며, 승인한 preview origin을 서버에 추가한 뒤 확인한다. 큰 파일은 브라우저에서 백엔드로 직접 업로드하여 Vercel Function의 요청 본문 제한을 거치지 않는다. 제공 서버의 배포 명령과 환경변수는 [전체 배포 안내](../docs/DEPLOYMENT.md)를 참고한다.

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

`NEXT_PUBLIC_DATA_MODE=mock`(기본값)이면 `services/mock/store.ts`의 브라우저 저장소 어댑터가 동작한다.
실제 API와 같은 타입을 반환하므로, 나중에 `api` 모드를 선택해도 기존 화면을 사용할 수 있다.

데모 계정: `admin@xisnd.com` / `test1234`

## 반응형

| 구간 | 레이아웃 |
| --- | --- |
| ~767px | 헤더 + 드로어 메뉴, 1단 폼, 하단 고정 액션바, FAB |
| 768~1279px | 사이드바 + 본문, 2단 그리드 |
| 1280px~ | 사이드바 + 본문, 3~4단 그리드 |

데스크톱에서 우측 상단에 두는 주요 액션은 모바일에서 하단 고정 바로 내린다(엄지 위치).
