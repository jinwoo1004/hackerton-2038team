using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using MonitoringAgent.Worker.Models;

namespace MonitoringAgent.Worker.Services;

public enum ServerReason
{
    Ok,
    NotConfigured,
    Unauthorized,
    Unreachable,
    Timeout,
    RateLimited,
    TooLarge,
    ServerError,
    BadResponse,
    Canceled,
    Unknown,
}

public readonly record struct ApiResult(bool Ok, ServerReason Reason, int Status = 0, string? Message = null)
{
    public static ApiResult Success(int status = 200) => new(true, ServerReason.Ok, status);
}

public sealed class IngestApiClient : IDisposable
{
    public const string TokenHeader = "X-Agent-Token";
    private const int GzipThreshold = 1024;

    public static readonly string AgentVersion =
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

    private readonly HttpClient _http;
    private readonly Func<AgentOptions> _options;
    private readonly ILogger _logger;
    private readonly int _maxAttempts;

    public IngestApiClient(Func<AgentOptions> options, ILogger logger, int maxAttempts = 3, TimeSpan? timeout = null)
    {
        _options = options;
        _logger = logger;
        _maxAttempts = Math.Max(1, maxAttempts);
        _http = new HttpClient(new SocketsHttpHandler
        {
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            AutomaticDecompression = DecompressionMethods.All,
        })
        {
            Timeout = timeout ?? TimeSpan.FromSeconds(Math.Max(3, options().TimeoutSeconds)),
        };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd($"MonitoringAgent/{AgentVersion}");
    }

    public async Task<(ApiResult Result, HeartbeatResponse? Body)> HeartbeatAsync(HeartbeatPayload payload, CancellationToken ct)
    {
        HeartbeatResponse? body = null;
        var result = await PostAsync("/api/ingest/heartbeat", Serialize(payload), ct, async response =>
        {
            body = await JsonSerializer.DeserializeAsync<HeartbeatResponse>(
                await response.Content.ReadAsStreamAsync(ct), AgentJson.Options, ct);
        });
        return (result, body);
    }

    public Task<ApiResult> SendLogsAsync(IReadOnlyList<LogItem> entries, CancellationToken ct)
        => PostAsync("/api/ingest/logs", Serialize(new LogBatch { Entries = entries.ToList() }), ct);

    public Task<ApiResult> SendMetricsAsync(IReadOnlyList<MetricItem> points, CancellationToken ct)
        => PostAsync("/api/ingest/metrics", Serialize(new MetricBatch { Points = points.ToList() }), ct);

    public Task<ApiResult> SendRawAsync(string path, byte[] json, CancellationToken ct)
        => PostAsync(path, json, ct);

    public static byte[] Serialize<T>(T value) => JsonSerializer.SerializeToUtf8Bytes(value, AgentJson.Options);

    private async Task<ApiResult> PostAsync(string path, byte[] json, CancellationToken ct,
        Func<HttpResponseMessage, Task>? onSuccess = null)
    {
        var options = _options();
        if (!options.IsConfigured)
        {
            return new ApiResult(false, ServerReason.NotConfigured);
        }
        if (!Uri.TryCreate(options.ServerBase + path, UriKind.Absolute, out var uri))
        {
            return new ApiResult(false, ServerReason.BadResponse, Message: "서버 주소 형식이 올바르지 않습니다.");
        }

        var last = new ApiResult(false, ServerReason.Unknown);
        for (var attempt = 1; attempt <= _maxAttempts; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, uri) { Content = Body(json) };
                request.Headers.Add(TokenHeader, options.Token);
                using var response = await _http.SendAsync(request, ct);
                if (response.IsSuccessStatusCode)
                {
                    if (onSuccess is not null)
                    {
                        await onSuccess(response);
                    }
                    return ApiResult.Success((int)response.StatusCode);
                }

                last = new ApiResult(false, Map(response.StatusCode), (int)response.StatusCode,
                    await ReadMessageAsync(response, ct));
                _logger.LogWarning("전송 실패 {Path} status={Status} attempt={Attempt}/{Max} {Message}",
                    path, last.Status, attempt, _maxAttempts, last.Message);

                // 토큰 문제나 요청 형식 문제는 다시 보내도 같은 결과라 바로 멈춘다
                if (last.Reason is ServerReason.Unauthorized or ServerReason.BadResponse or ServerReason.TooLarge)
                {
                    return last;
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return new ApiResult(false, ServerReason.Canceled);
            }
            catch (TaskCanceledException)
            {
                last = new ApiResult(false, ServerReason.Timeout);
                _logger.LogWarning("전송 시간 초과 {Path} attempt={Attempt}/{Max}", path, attempt, _maxAttempts);
            }
            catch (HttpRequestException ex)
            {
                last = new ApiResult(false, ServerReason.Unreachable, Message: ex.Message);
                _logger.LogWarning("서버 연결 실패 {Path} attempt={Attempt}/{Max} {Message}", path, attempt, _maxAttempts, ex.Message);
            }
            catch (Exception ex)
            {
                last = new ApiResult(false, ServerReason.Unknown, Message: ex.Message);
                _logger.LogWarning("전송 예외 {Path} {Message}", path, ex.Message);
            }

            if (attempt < _maxAttempts)
            {
                var wait = last.Reason == ServerReason.RateLimited ? 10 : Math.Pow(2, attempt);
                try { await Task.Delay(TimeSpan.FromSeconds(wait), ct); }
                catch (OperationCanceledException) { return new ApiResult(false, ServerReason.Canceled); }
            }
        }
        return last;
    }

    private static HttpContent Body(byte[] json)
    {
        if (json.Length < GzipThreshold)
        {
            var plain = new ByteArrayContent(json);
            plain.Headers.ContentType = new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };
            return plain;
        }
        using var buffer = new MemoryStream();
        using (var gz = new GZipStream(buffer, CompressionLevel.Fastest, leaveOpen: true))
        {
            gz.Write(json);
        }
        var content = new ByteArrayContent(buffer.ToArray());
        content.Headers.ContentType = new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };
        content.Headers.ContentEncoding.Add("gzip");
        return content;
    }

    private static async Task<string?> ReadMessageAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            if (string.IsNullOrWhiteSpace(text))
            {
                return null;
            }
            using var doc = JsonDocument.Parse(text);
            return doc.RootElement.TryGetProperty("message", out var m) ? m.GetString() : null;
        }
        catch
        {
            return null;
        }
    }

    private static ServerReason Map(HttpStatusCode status) => status switch
    {
        HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => ServerReason.Unauthorized,
        HttpStatusCode.TooManyRequests => ServerReason.RateLimited,
        HttpStatusCode.RequestEntityTooLarge => ServerReason.TooLarge,
        >= HttpStatusCode.InternalServerError => ServerReason.ServerError,
        _ => ServerReason.BadResponse,
    };

    public void Dispose() => _http.Dispose();
}
