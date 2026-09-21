package com.xisnd.monitoring.alert;

import com.xisnd.monitoring.incident.Incident;
import java.util.Optional;

// LLM 요약을 붙일 자리. 구현 빈이 없으면 요약 없이 보낸다
public interface IncidentInsight {

    Optional<String> summarize(Incident incident);
}
