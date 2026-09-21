package com.xisnd.monitoring.llm;

/** Only fixed safe messages cross the provider boundary. Never retain an upstream cause/body. */
public final class LlmException extends RuntimeException {
    public enum Code {
        CONFIG_INVALID(2, "AI 실행 환경과 제공자 설정을 확인하세요."),
        MODEL_REQUIRED(2, "선택한 AI 제공자의 모델을 명시하세요."),
        AUTH_FILE_LOCATION(2, "로컬 인증 파일은 저장소 밖의 절대 경로로 지정하세요."),
        API_KEY_REQUIRED(3, "배포 환경의 API 인증 설정을 확인하세요."),
        LOCAL_AUTH_REQUIRED(3, "로컬 로그인 명령을 다시 실행하세요."),
        API_AUTH_REJECTED(3, "배포 환경의 API 인증 설정을 확인하세요."),
        ACCESS_DENIED(4, "선택한 AI 서비스 또는 모델에 대한 접근 권한이 없습니다."),
        RATE_LIMITED(4, "AI 사용량 또는 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요."),
        MODEL_UNAVAILABLE(4, "설정한 AI 모델을 사용할 수 없습니다. 모델 이름과 접근 권한을 확인하세요."),
        TIMEOUT(4, "AI 응답 제한 시간을 초과했습니다."),
        CANCELLED(4, "AI 요청이 취소되었습니다."),
        TRANSPORT_ERROR(4, "AI 서비스에 연결하지 못했습니다."),
        HTTP_ERROR(4, "AI 서비스가 요청을 처리하지 못했습니다."),
        RESPONSE_TOO_LARGE(4, "AI 응답이 허용 크기를 초과했습니다."),
        INVALID_RESPONSE(4, "AI 응답 형식을 확인하지 못했습니다."),
        INCOMPLETE_RESPONSE(4, "AI 응답이 완료되기 전에 종료되었습니다."),
        MODEL_FAILED(4, "AI 생성이 정상적으로 완료되지 않았습니다."),
        MODEL_REFUSAL(4, "AI가 요청에 대한 응답을 제공하지 않았습니다."),
        UNEXPECTED_OUTPUT(4, "요청하지 않은 AI 출력이 반환되었습니다."),
        MOCK_UNAVAILABLE(4, "테스트용 AI 응답이 지정되지 않았습니다.");
        private final int exit;
        private final String message;
        Code(int exit, String message) { this.exit = exit; this.message = message; }
        public int exitCode() { return exit; }
        public String safeMessage() { return message; }
    }
    private final Code code;
    public LlmException(Code code) { super(code.safeMessage(), null, false, false); this.code = code; }
    public Code code() { return code; }
}
