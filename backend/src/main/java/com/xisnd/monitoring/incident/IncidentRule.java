package com.xisnd.monitoring.incident;

public enum IncidentRule {
    AGENT_DOWN("에이전트 연결 끊김"),
    CPU_HIGH("CPU 사용률 높음"),
    MEMORY_HIGH("메모리 사용률 높음"),
    DISK_HIGH("디스크 사용률 높음"),
    ERROR_BURST("오류 로그 급증"),
    FATAL_LOG("치명 로그 발생"),
    NEW_ERROR("처음 보는 오류"),
    ERROR_SPIKE("오류 추세 이상"),
    CPU_SPIKE("CPU 추세 이상");

    private final String label;

    IncidentRule(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
