package com.xisnd.monitoring.agent;

import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.security.CurrentUser;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agent-installer")
public class AgentInstallerController {

    private final Path installer;

    public AgentInstallerController(@Value("${app.agent.installer-path:../agent/dist/MonitoringAgentSetup.exe}") String path) {
        this.installer = Path.of(path).toAbsolutePath().normalize();
    }

    @GetMapping
    public InstallerInfo info() throws IOException {
        CurrentUser.id();
        if (!Files.isRegularFile(installer)) {
            return new InstallerInfo(false, null, null, null);
        }
        LocalDateTime updated = LocalDateTime.ofInstant(Files.getLastModifiedTime(installer).toInstant(), ZoneId.systemDefault());
        return new InstallerInfo(true, installer.getFileName().toString(), Files.size(installer), updated);
    }

    @GetMapping("/download")
    public ResponseEntity<Resource> download() {
        CurrentUser.id();
        if (!Files.isRegularFile(installer)) {
            throw ApiException.notFound("설치 파일이 아직 준비되지 않았습니다.");
        }
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(installer.getFileName().toString()).build().toString())
                .body(new FileSystemResource(installer));
    }

    public record InstallerInfo(boolean available, String fileName, Long sizeBytes, LocalDateTime updatedAt) {
    }
}
