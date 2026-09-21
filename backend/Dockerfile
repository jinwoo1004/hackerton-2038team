# Build from repository root: docker build -f backend/Dockerfile -t monitoring-backend .
FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /build
COPY backend/gradlew backend/build.gradle backend/settings.gradle ./
COPY backend/gradle/wrapper/gradle-wrapper.jar backend/gradle/wrapper/gradle-wrapper.properties ./gradle/wrapper/
COPY backend/src/main/java/ ./src/main/java/
COPY backend/src/main/resources/application.yml backend/src/main/resources/application-deployed.yml backend/src/main/resources/application-mysql.yml ./src/main/resources/
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew && ./gradlew --no-daemon bootJar

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 monitoring && useradd --uid 10001 --gid 10001 --no-create-home monitoring \
    && mkdir -p /app /data/storage && chown -R 10001:10001 /app /data/storage
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/build/libs/monitoring-backend-0.0.1-SNAPSHOT.jar /app/backend.jar
ENV APP_RUNTIME=deployed LLM_PROVIDER=openai_api SPRING_PROFILES_ACTIVE=deployed APP_STORAGE_LOCATION=/data/storage PORT=8080
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl --fail --silent --output /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1
ENTRYPOINT ["java", "-Dfile.encoding=UTF-8", "-jar", "/app/backend.jar"]
