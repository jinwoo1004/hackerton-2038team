# 반복 가능한 시연 입력

이 디렉터리의 소스, 규칙, 로그 및 지표는 모두 합성 데이터입니다. 원본 운영 로그나 보호된 규격 문서 본문을 배포하지 않습니다.

`wallpad-source.zip`과 `rules.md`, `rules.pdf`, `rules.xlsx`, `rules.docx`는 같은 규칙을 여러 형식으로 업로드하여 파싱과 finding 근거를 비교하는 입력입니다. 의도적으로 금지 호출, 긴 함수, 긴 줄, 함수명 규칙 위반을 포함합니다. 이 소스를 실제 서비스에서 실행하지 않습니다.

`scenario.json`은 풀스택과 프런트 단독 시연이 공유하는 수치 명세입니다. 시계열 시각은 실행 시점을 기준으로 이동하지만 지표와 시나리오 수치는 일정합니다.

첨부된 두 운영 로그에서는 `$version`, `$cmd`, `$copy`, `$target` 구분자와 `copy format ERROR` 패턴을 확인했습니다. 시연 로그는 이 형태를 참고해 새로 작성했습니다. 첨부 규격 파일은 확장자가 DOCX이지만 OLE `EncryptedPackage` 구조여서 일반 문서 파서로 본문을 읽을 수 없습니다. 이 파일을 읽었다거나 규칙을 추출했다고 주장하지 않습니다.

재생성: reportlab·python-docx·openpyxl이 설치된 문서 도구용 Python에서 `python scripts/build-demo-fixtures.py`를 실행합니다. 실행 환경 준비에는 재생성이 필요 없으며 이미 생성된 입력을 사용합니다.

`manifest.json`에는 입력 8개의 SHA-256을 기록합니다. `.gitattributes`가 바이너리와 텍스트 개행을 보존하며, Windows 체크아웃 후에도 해시가 모두 일치함을 확인했습니다.
