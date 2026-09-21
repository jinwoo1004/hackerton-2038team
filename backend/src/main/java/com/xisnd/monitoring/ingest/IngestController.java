package com.xisnd.monitoring.ingest;

import com.xisnd.monitoring.ingest.IngestDtos.HeartbeatRequest;
import com.xisnd.monitoring.ingest.IngestDtos.HeartbeatResponse;
import com.xisnd.monitoring.ingest.IngestDtos.IngestResult;
import com.xisnd.monitoring.ingest.IngestDtos.LogBatchRequest;
import com.xisnd.monitoring.ingest.IngestDtos.MetricBatchRequest;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ingest")
@RequiredArgsConstructor
public class IngestController {

    public static final String TOKEN_HEADER = "X-Agent-Token";

    private final IngestService ingestService;

    @PostMapping("/heartbeat")
    public HeartbeatResponse heartbeat(@RequestHeader(value = TOKEN_HEADER, required = false) String token,
                                       @RequestBody(required = false) HeartbeatRequest request,
                                       HttpServletRequest http) {
        return ingestService.heartbeat(token, request, http.getRemoteAddr());
    }

    @PostMapping("/logs")
    public IngestResult logs(@RequestHeader(value = TOKEN_HEADER, required = false) String token,
                             @RequestBody(required = false) LogBatchRequest request) {
        return ingestService.logs(token, request);
    }

    @PostMapping("/metrics")
    public IngestResult metrics(@RequestHeader(value = TOKEN_HEADER, required = false) String token,
                                @RequestBody(required = false) MetricBatchRequest request) {
        return ingestService.metrics(token, request);
    }
}
