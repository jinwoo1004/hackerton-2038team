package com.xisnd.monitoring.file;

import com.xisnd.monitoring.common.ApiException;
import com.xisnd.monitoring.config.StorageProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
public class FileStorageService {

    private static final Set<String> RULE_EXTENSIONS =
            Set.of("pdf", "md", "txt", "doc", "docx", "xlsx", "xls", "csv");
    private static final Set<String> SOURCE_EXTENSIONS = Set.of("zip");
    private static final Set<String> LOG_EXTENSIONS = Set.of("log", "txt", "out", "json", "csv", "gz", "zip");

    private final Path root;

    public FileStorageService(StorageProperties properties) {
        this.root = Paths.get(properties.location()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new IllegalStateException("파일 저장 디렉터리를 생성하지 못했습니다: " + root, e);
        }
    }

    public StoredFile store(String projectCode, FileType fileType, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("업로드할 파일이 없습니다.");
        }
        String originalName = sanitize(file.getOriginalFilename());
        String extension = extensionOf(originalName);
        validateExtension(fileType, extension);

        String storedName = UUID.randomUUID().toString().replace("-", "")
                + (extension.isEmpty() ? "" : "." + extension);
        Path directory = root.resolve(projectCode).resolve(fileType.name().toLowerCase(Locale.ROOT));
        Path target = directory.resolve(storedName);

        try {
            Files.createDirectories(directory);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("파일 저장 실패 — {}", target, e);
            throw ApiException.badRequest("파일을 저장하지 못했습니다.");
        }

        return new StoredFile(originalName, storedName, target.toString(), file.getSize(), file.getContentType());
    }

    public void delete(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return;
        }
        Path path = Paths.get(filePath).toAbsolutePath().normalize();
        // 저장 루트 밖은 삭제하지 않음
        if (!path.startsWith(root)) {
            log.warn("저장 루트 밖의 경로 삭제 시도를 무시했습니다 — {}", path);
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("파일 삭제 실패 — {}", path, e);
        }
    }

    private void validateExtension(FileType fileType, String extension) {
        if (fileType == FileType.RULE && !RULE_EXTENSIONS.contains(extension)) {
            throw ApiException.badRequest("규칙 문서는 PDF, Word, Markdown, Excel 형식만 업로드할 수 있습니다.");
        }
        if (fileType == FileType.SOURCE && !SOURCE_EXTENSIONS.contains(extension)) {
            throw ApiException.badRequest("프로젝트 소스는 ZIP 파일만 업로드할 수 있습니다.");
        }
        if (fileType == FileType.LOG && !LOG_EXTENSIONS.contains(extension)) {
            throw ApiException.badRequest("로그 파일은 LOG, TXT, OUT, JSON, CSV, GZ, ZIP 형식만 업로드할 수 있습니다.");
        }
    }

    private String sanitize(String filename) {
        if (filename == null || filename.isBlank()) {
            return "unnamed";
        }
        String name = Paths.get(filename).getFileName().toString();
        return name.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public record StoredFile(String originalFilename, String storedFilename, String filePath, long size,
                             String mimeType) {
    }
}
