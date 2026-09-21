# Vercel 프런트엔드 + 별도 서버 배포

배포 구성은 Vercel의 Next.js 프런트엔드와 별도 Linux 서버의 Spring Boot·FastAPI·MySQL이다. 지정된 Vercel 로그인은 `hackathon01@52g.team`, workspace는 `52g Studio`(Enterprise), 프로젝트는 `g-20`, Git 저장소는 `jinwoo1004/hackerton-2038team`이다.

배포 서버·SSH 주소·backend DNS·Vercel frontend URL은 운영 환경의 실제 값으로 설정한다. 아래 환경 템플릿과 명령에는 특정 서버 주소나 도메인을 미리 넣지 않았다.

Vercel은 현재 Services/Container Images beta로 OCI 이미지를 실행할 수 있다. 다만 무트래픽 시 production은 5분, preview는 30초 뒤 축소되고 일반 Functions 제한을 적용한다. 현재 앱의 공유 영구 파일, 상시 스케줄러와 메모리 내 분석 작업 관리에는 별도 상시 서버 구성을 사용한다. 이는 현재 애플리케이션 구조에 따른 선택이다. [Vercel 공식 Container Images 문서](https://vercel.com/docs/functions/container-images)

## 구성과 경계

| 구성 요소 | 위치 / 실행 | 저장소와 노출 |
| --- | --- | --- |
| frontend | Vercel, Next.js | 정확한 HTTPS backend origin에 브라우저가 직접 요청 |
| backend | 서버, Java 17, 1 replica | `/data/storage` 읽기·쓰기, 기본 `127.0.0.1:8080`만 공개 |
| analysis | 서버, Python 3.11, 1 worker | 같은 `/data/storage` 읽기 전용, 내부8000, host port 없음 |
| mysql | 서버, MySQL 8.4 | named volume, 내부3306, host port 없음 |
| caddy | 선택한 TLS 구성 | 실제 backend DNS에 대해80/443 공개, backend로 전달 |

두 앱은 UID/GID `10001:10001`로 실행한다. 이미지에서 `/data/storage`의 소유권을 지정하고 같은 named volume을 공유한다. backend는 외부 OpenAI 연결용 네트워크와 private 네트워크에 연결하고, analysis와 mysql은 private 네트워크에만 연결한다. FastAPI는 `/health` 외 요청에 공유 인증값을 요구한다.

Dockerfile은 저장소 루트 context에서 필요한 파일만 `COPY`한다. `.dockerignore`는 로컬 OAuth·환경파일·키·도구·캐시·H2·업로드 저장소·Agent 배포 파일을 빌드 context에서 제외한다. 이미지에는 Windows 설치기를 넣지 않으므로 기본 설치기 info는 `available=false`, download는404다. 제공하려면 검증한 실제 EXE를 별도 read-only mount하고 `APP_AGENT_INSTALLER_PATH`를 그 컨테이너 경로로 지정한다.

## Vercel 설정

1. 공식 Vercel 화면에서 `hackathon01@52g.team`로 로그인하고 `52g Studio` workspace의 `g-20` 프로젝트를 선택한다.
2. `jinwoo1004/hackerton-2038team`을 연결하고 Framework Preset을 Next.js, Root Directory를 `frontend`로 지정한다.
3. **Include source files outside of the Root Directory in the Build Step**를 켠다. `postinstall`/`prebuild`가 루트의 `demo-fixtures`를 `public/demo`에 복사하므로 이 설정이 필요하다. 이 파일들은 공개해도 되는 합성 시연 입력이다. [Vercel 공식 monorepo 설정](https://vercel.com/docs/monorepos/monorepo-faq)
4. Install Command는 `npm ci`, Build Command는 `npm run build`, Output Directory는 Next.js 기본값을 사용한다.
5. `NEXT_PUBLIC_API_BASE_URL`을 **실제 배포된 backend의 HTTPS origin**으로 설정한다. 경로·query·credentials를 넣지 않는다. Production과 연결할 Preview 환경에 각각 지정하고 다시 빌드한다. 비어 있거나 localhost이면 Vercel 빌드가 실패하도록 되어 있다.
6. 실제 발급된 frontend HTTPS origin을 서버의 `APP_CORS_ALLOWED_ORIGINS`와 `APP_PUBLIC_URL`에 반영한다. CORS에는 끝 `/`를 넣지 않고, Preview를 허용할 때도 정확한 origin을 쉼표로 추가한다. 무제한 `*.vercel.app` wildcard를 쓰지 않는다.

Vercel frontend에는 OpenAI 키, JWT 서명값, DB 비밀번호, 분석 공유 인증값을 넣지 않는다. `NEXT_PUBLIC_`는 브라우저에 포함되는 공개 설정이다.

## 서버 준비와 환경값

아래 명령은 추후 확보할 Linux 서버에서 실행한다. Docker Engine·Compose v2, Git, Bash, GNU coreutils가 필요하다. 유료 서버나 도메인 생성은 자동으로 수행하지 않는다. DNS A/AAAA가 해당 서버를 가리키고80/443을 사용할 수 있어야 Caddy가 인증서를 발급할 수 있다. [Caddy 자동 HTTPS 조건](https://caddyserver.com/docs/automatic-https)

저장소를 원하는 배포 경로에 clone한 후 해당 루트로 이동한다. SSH 연결과 서버 방화벽 변경은 실제 서버 정보가 확정된 뒤 수행한다.

```bash
git clone https://github.com/jinwoo1004/hackerton-2038team.git
cd hackerton-2038team
export DEPLOY_ENV_FILE="$HOME/.config/monitoring-2038/deployment.env"
install -d -m 700 "$(dirname -- "$DEPLOY_ENV_FILE")"
test -e "$DEPLOY_ENV_FILE" || install -m 600 deploy/.env.example "$DEPLOY_ENV_FILE"
```

외부 환경파일의 비어 있는 항목을 서버의 비밀값 관리 방법이나 편집기로 채운다. populated 환경파일은 저장소 밖에 두고 커밋하지 않는다. Compose가 읽으며 shell `source`나 `eval`로 실행하지 않는다.

| 변수 | 값 / 의미 |
| --- | --- |
| `OPENAI_MODEL` | 사용자가 명시한 배포용 모델 이름, 자동 선택 없음 |
| `OPENAI_API_KEY` | 해당 배포가 사용할 실제 API key |
| `APP_JWT_SECRET` | 고유한 무작위 서명값, 최소32bytes, 다양한 문자 사용 |
| `APP_ANALYSIS_SHARED_SECRET` | 고유한 무작위32자 이상 값. Compose가 FastAPI `ANALYSIS_SHARED_SECRET`에도 같은 값 전달 |
| `DB_USERNAME` / `DB_PASSWORD` | MySQL 앱 계정과 고유 비밀번호. 템플릿 username은 `monitoring` |
| `MYSQL_ROOT_PASSWORD` | 별도 고유 root 비밀번호 |
| `APP_CORS_ALLOWED_ORIGINS` | 정확한 frontend HTTPS origin 목록 |
| `APP_PUBLIC_URL` | 알림 링크에 사용할 실제 frontend HTTPS URL |
| `BACKEND_HOST` | 실제 backend DNS hostname, scheme/path 없음. TLS 구성에 필수 |
| `BACKEND_PORT` | host loopback 포트, 기본8080. 컨테이너 내부는8080 |
| `LLM_TIMEOUT_SECONDS` | 1~60, 템플릿30초 |

Compose는 backend의 `APP_RUNTIME=deployed`, `LLM_PROVIDER=openai_api`, `SPRING_PROFILES_ACTIVE=deployed`를 명시한다. 로컬 Codex OAuth 파일·토큰·`CODEX_HOME`은 컨테이너에 전달하지 않는다. DB 연결은 내부 `mysql:3306/monitoring`, 분석 연결은 `http://analysis:8000`, 두 앱 저장소는 `/data/storage`로 고정한다. 누락된 필수 환경값은 Compose 또는 앱 시작 단계에서 실패한다.

## 한 명령 실행

실제 DNS와 환경파일을 채웠다면 저장소 루트에서 실행한다.

```bash
DEPLOY_ENV_FILE="$HOME/.config/monitoring-2038/deployment.env" bash deploy/up.sh tls
```

`up.sh`는 외부 환경파일 위치를 확인하고 `docker compose config --quiet`로 검증한 뒤 build·기동·health 대기를 수행한다. 비밀값이 포함되는 전체 `docker compose config` 출력은 기록하지 않는다. 이미지 tag는 현재 Git commit ID이며 `DEPLOY_IMAGE_TAG`로 명시할 수도 있다.

이미 서버의 HTTPS reverse proxy가 있다면 loopback 구성으로 시작하고 기존 proxy가 `127.0.0.1:8080`으로 전달하게 한다.

```bash
DEPLOY_ENV_FILE="$HOME/.config/monitoring-2038/deployment.env" bash deploy/up.sh loopback
```

loopback 주소 자체는 Vercel 브라우저가 사용할 API 주소가 아니다. 공개 HTTPS proxy가 준비된 뒤 그 origin을 `NEXT_PUBLIC_API_BASE_URL`로 설정해야 한다. 기본 파일은 `deploy/compose.yml`, Caddy를 추가하는 파일은 `deploy/compose.tls.yml`이다. Compose는 MySQL·analysis health가 성공한 뒤 backend를 시작하도록 설정한다. [Compose 기동 순서](https://docs.docker.com/compose/how-tos/startup-order/)

기동 후 서버 내부와 실제 HTTPS endpoint의 `/api/health`, 정확한 CORS, 회원가입/로그인, 업로드·분석, API key 기반 AI 응답을 확인한다. 재시작 후 DB와 업로드 파일이 남는지도 확인한다. 실제 AI 요청은 배포 API 사용량에 반영된다. 운영에서는 `demo` 프로파일이나 demo seed API를 사용하지 않는다.

## DB·업로드 백업

MySQL 데이터와 업로드 volume은 컨테이너를 재생성해도 유지된다. 새 volume의 소유권 승계는 실제 서버에서 확인한다. 기존 volume은 이미지 디렉터리를 가리므로 UID10001의 접근 권한이 잘못되면 원인을 수정해야 한다. [Docker volume 동작](https://docs.docker.com/engine/storage/volumes/)

다음은 TLS 구성을 사용한 예다. 기존 proxy 구성은 두 번째 `-f`를 제외한다. 복구용 환경파일도 서버의 별도 비밀값 백업에 보관한다. 업로드 파일과 DB를 같은 시점으로 묶도록 점검 시간에 새 업로드를 중지하고 진행 중인 분석이 끝난 뒤 아래 순서를 실행한다.

```bash
export DEPLOY_ENV_FILE="$HOME/.config/monitoring-2038/deployment.env"
compose=(docker compose --project-name monitoring-2038 --env-file "$DEPLOY_ENV_FILE" -f deploy/compose.yml -f deploy/compose.tls.yml)
backup_dir="$HOME/.local/share/monitoring-2038/backups/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$backup_dir"
umask 077
"${compose[@]}" stop backend
"${compose[@]}" exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --user="$MYSQL_USER" --single-transaction --quick --no-tablespaces "$MYSQL_DATABASE"' > "$backup_dir/database.sql"
docker run --rm --network none --volumes-from "$("${compose[@]}" ps --all --quiet backend)":ro \
  --mount "type=bind,source=$backup_dir,target=/backup" \
  busybox:1.37 sh -c 'tar czf /backup/storage.tar.gz -C /data/storage .'
"${compose[@]}" start backend
```

백업 디렉터리를 서버 외부의 승인된 백업 위치로 복사하고 복구 연습으로 DB dump·파일·소유권을 확인한다. SQL dump에는 사용자 데이터가 포함되므로 공개 저장소에 넣지 않는다. MySQL root/user 비밀번호를 기존 환경파일에서 바꾸는 것만으로 이미 생성된 DB 계정 비밀번호가 변경되지는 않는다. 운영 중 변경은 DB 계정과 환경값을 함께 맞춘다.

## 변경과 롤백

배포 전 현재 commit, backend/analysis image tag, 환경값 버전, DB/업로드 백업을 기록한다. 현재 Hibernate 설정은 `ddl-auto=update`이므로 코드 rollback만으로 DB schema가 복원된다고 가정하지 않는다. 파괴적 schema 변경 전에는 migration/restore 절차를 먼저 검증한다.

새 commit으로 `up.sh`를 실행하면 새 tag의 이미지를 만든다. 이전 이미지가 남아 있고 schema가 호환되면 **이전 commit의 배포 설정**에서 이전 tag로 재기동한다.

```bash
export DEPLOY_IMAGE_TAG='<previous-verified-image-tag>'
docker compose --project-name monitoring-2038 --env-file "$DEPLOY_ENV_FILE" \
  -f deploy/compose.yml -f deploy/compose.tls.yml up -d --no-build --wait
```

호환되지 않는 DB 변경은 점검 시간에 검증된 백업을 복구한다. Vercel은 해당 backend 계약과 호환되는 이전 배포로 되돌린다. `docker compose down -v`나 volume 삭제는 데이터 제거이므로 일반 재배포·롤백 절차에 포함하지 않는다.

## 검증 범위

프런트엔드 13개·백엔드 72개·분석 서비스 23개 테스트와 타입 검사, JAR 및 프런트엔드 빌드를 확인했다. 소스 준비 검증과 실제 배포 상태를 분리한 결과는 [독립 검증 보고서](DEPLOYMENT-VERIFICATION.md)에 있다.

현재 개발 PC에는 Docker CLI/daemon이 없다. Compose의 base/TLS/병합 설정은 공식 Draft2020-12 schema를 통과했고, 파일 경로·private 네트워크·공유 저장소·제공자 경계와 Bash 문법, Docker 호출 전에 잘못된 환경파일을 거부하는3개 검사를 통과했다. 정적 검증 근거와 당시 파일 SHA256은 [deploy/verification.json](../deploy/verification.json)에 있다.

실제 이미지 build·`docker compose config/up`·컨테이너 기동·volume UID 승계·MySQL 연결·DNS/TLS·재시작·backup/restore는 실행하지 않았으며 서버에서 확인해야 한다. 아직 서버나 도메인을 배포한 것으로 기록하지 않는다.

서버 확보와 SSH/DNS, `hackathon01@52g.team`의 `52g Studio` 권한이 준비된 뒤 실제 배포 결과, frontend/backend URL, health·CORS·DB persistence 확인 결과를 이 문서에 추가한다. 값이 없는 상태에서 frontend mock 화면을 실제 배포 성공으로 처리하지 않는다.
